"""Cadência de follow-up automática.

Lê automações do tipo `cadencia_followup`. Cada uma tem `config`:
{
  "passos": [
    {"dias_apos_ultima_atividade": 3, "template_id": 12},
    {"dias_apos_ultima_atividade": 7, "template_id": 14},
    {"dias_apos_ultima_atividade": 14, "template_id": 15}
  ],
  "filtro": {                  # opcional — quais contatos elegíveis
    "decisor": true,
    "fonte": "lusha",
    "empresa_owner_id": null
  },
  "smtp_user_id": 1            # opcional — qual user "envia" (usa Gmail dele
                               # se conectado, senão SMTP global; default: owner
                               # do contato → owner da empresa → admin)
}

Para cada contato com email:
- Pega `data` da última atividade do contato (ou do criado_at do contato).
- Se passou exatamente N dias e ainda não enviamos esse passo → envia o template.
- Marcamos via Atividade(tipo=email) — daí "última atividade" muda e o próximo
  passo segue a partir dessa data.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, or_

from app.models.atividade import Atividade, AtividadeStatus, TipoAtividade
from app.models.automacao import Automacao, AutomacaoKind
from app.models.contato import Contato
from app.models.empresa import Empresa
from app.models.user import User
from app.services import google_oauth as gauth
from app.services.smtp import SMTPError, enviar_email, render_template

log = logging.getLogger("cadencia")


def _last_activity_date(db, contato: Contato) -> datetime:
    last = (
        db.query(Atividade.created_at)
        .filter(Atividade.contato_id == contato.id)
        .order_by(Atividade.created_at.desc())
        .first()
    )
    return last[0] if last else (contato.created_at or datetime.now(timezone.utc))


def _already_sent_step(db, contato: Contato, automacao_id: int, step_idx: int) -> bool:
    """Procura uma Atividade de email cujo título carregue o marker desta automação+passo."""
    marker = f"[cad:{automacao_id}:{step_idx}]"
    exists = (
        db.query(Atividade.id)
        .filter(
            Atividade.contato_id == contato.id,
            Atividade.tipo == TipoAtividade.email,
            Atividade.titulo.like(f"%{marker}%"),
        )
        .first()
    )
    return bool(exists)


def _eligible_contatos(db, filtro: dict | None) -> list[Contato]:
    q = db.query(Contato).filter(Contato.email.isnot(None), Contato.email != "")
    if not filtro:
        return q.limit(500).all()
    if filtro.get("decisor") is True:
        q = q.filter(Contato.decisor.is_(True))
    if filtro.get("fonte"):
        q = q.filter(Contato.fonte == filtro["fonte"])
    if filtro.get("empresa_owner_id"):
        q = q.join(Empresa, Empresa.id == Contato.empresa_id).filter(
            Empresa.owner_id == int(filtro["empresa_owner_id"])
        )
    return q.limit(500).all()


def _select_sender(db, contato: Contato, smtp_user_id: int | None) -> User | None:
    if smtp_user_id:
        u = db.get(User, smtp_user_id)
        if u and u.is_active:
            return u
    if contato.owner_id:
        u = db.get(User, contato.owner_id)
        if u and u.is_active:
            return u
    if contato.empresa_id:
        emp = db.get(Empresa, contato.empresa_id)
        if emp and emp.owner_id:
            u = db.get(User, emp.owner_id)
            if u and u.is_active:
                return u
    # Fallback: primeiro admin ativo
    return db.query(User).filter(User.is_active.is_(True)).order_by(User.id).first()


def _send(db, sender: User, contato: Contato, empresa: Empresa | None, template: Automacao,
          automacao_id: int, step_idx: int) -> tuple[bool, str]:
    """Envia o template renderizado. Retorna (ok, descricao)."""
    vars_ = {
        "nome": (contato.nome or "").split()[0] if contato.nome else "",
        "nome_completo": contato.nome or "",
        "cargo": contato.cargo or "",
        "email": contato.email or "",
        "empresa": (empresa.razao_social or empresa.nome_fantasia) if empresa else "",
        "remetente": sender.nome,
        "remetente_email": sender.email,
    }
    assunto, corpo = render_template(template.assunto or "(sem assunto)", template.corpo or "", vars_)
    try:
        if sender.google_refresh_token:
            res = gauth.send_via_gmail(db, sender, contato.email, assunto, corpo)
            via = res.get("via", "gmail_api")
        else:
            res = enviar_email(contato.email, assunto, corpo)
            via = "smtp"
    except (gauth.GoogleOAuthError, SMTPError) as e:
        return False, str(e)

    marker = f"[cad:{automacao_id}:{step_idx}]"
    atv = Atividade(
        tipo=TipoAtividade.email,
        titulo=f"Cadência {step_idx+1}: {assunto[:180]} {marker}",
        descricao=corpo[:4000],
        status=AtividadeStatus.concluida,
        data_atividade=datetime.now(timezone.utc),
        empresa_id=contato.empresa_id,
        contato_id=contato.id,
        user_id=sender.id,
        resultado=f"cadência via {via}",
    )
    db.add(atv)
    return True, f"enviado via {via}"


def run_cadencia_job() -> dict:
    """Executa todas as cadências ativas. Retorna resumo agregado."""
    from app.core.database import SessionLocal

    resumo = {"automacoes_processadas": 0, "envios_ok": 0, "envios_erro": 0, "elegiveis": 0}
    now = datetime.now(timezone.utc)

    with SessionLocal() as db:
        cads = (
            db.query(Automacao)
            .filter(
                Automacao.kind == AutomacaoKind.cadencia_followup,
                Automacao.ativo.is_(True),
            )
            .all()
        )
        for cad in cads:
            resumo["automacoes_processadas"] += 1
            cfg = cad.config or {}
            passos = cfg.get("passos") or []
            if not passos:
                continue
            sender_uid = cfg.get("smtp_user_id")
            elegiveis = _eligible_contatos(db, cfg.get("filtro"))
            resumo["elegiveis"] += len(elegiveis)
            for contato in elegiveis:
                ult = _last_activity_date(db, contato)
                idade_dias = (now - ult).days
                # Determina o próximo passo elegível (não enviado ainda) cujo
                # threshold já passou.
                for idx, passo in enumerate(passos):
                    if _already_sent_step(db, contato, cad.id, idx):
                        continue
                    if idade_dias < int(passo.get("dias_apos_ultima_atividade", 0)):
                        break  # ainda cedo, não tenta os próximos
                    template_id = passo.get("template_id")
                    if not template_id:
                        continue
                    template = db.get(Automacao, int(template_id))
                    if not template or template.kind != AutomacaoKind.template_email:
                        log.warning("Cadência %s passo %s: template_id %s inválido", cad.id, idx, template_id)
                        continue
                    sender = _select_sender(db, contato, sender_uid)
                    if not sender:
                        log.warning("Cadência %s: nenhum sender disponível", cad.id)
                        continue
                    empresa = db.get(Empresa, contato.empresa_id) if contato.empresa_id else None
                    ok, desc = _send(db, sender, contato, empresa, template, cad.id, idx)
                    if ok:
                        resumo["envios_ok"] += 1
                    else:
                        resumo["envios_erro"] += 1
                        log.warning("Cadência %s contato %s falhou: %s", cad.id, contato.id, desc)
                    db.commit()
                    break  # 1 envio por contato por execução (anti-spam)
            cad.executada_n_vezes = (cad.executada_n_vezes or 0) + 1
            cad.ultima_execucao = now
            db.commit()
    log.info("Cadência rodou: %s", resumo)
    return resumo
