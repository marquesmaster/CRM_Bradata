"""Classificador IA em BATCH — classifica N contratos em 1 chamada.

Para 1788 contratos em lotes de 30 = ~60 chamadas DeepSeek em vez de 1788.
Custo cai ~30x e demora ~30x menos.

Compatível com o modelo individual: grava nos mesmos campos
(ai_classificacao, ai_confianca, ai_motivo, ai_tipo_servico, ai_oportunidade).
"""
from __future__ import annotations

import json
import logging
import time
from datetime import datetime, timezone
from typing import Any

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.etl_run import EtlRun, EtlRunStatus
from app.models.pncp import PncpContrato
from app.services.ai_classifier import PERFIL_BRADATA, _provider_config

log = logging.getLogger("ai_classifier.batch")

# DeepSeek aceita até ~64k tokens de contexto; 30 contratos × ~300 chars
# fica bem abaixo (<15k tokens com overhead), seguro.
DEFAULT_BATCH_SIZE = 30


BATCH_INSTRUCTIONS = """
Você vai classificar MÚLTIPLOS contratos de uma só vez. Cada contrato tem
um "id" (copie-o de volta) e texto. Responda APENAS com JSON no formato:

{
  "resultados": [
    {
      "id": "<id_do_contrato>",
      "classificacao": "SIM" | "NAO",
      "confianca": 0.0,
      "motivo": "uma frase curta",
      "tipo_servico": "alocacao | fabrica_software | sustentacao | consultoria | outro",
      "oportunidade_bodyshop": "pitch sugerido ou vazio"
    },
    ...
  ]
}

Respeite EXATAMENTE o id recebido. Se não conseguir classificar, use
"NAO" com confianca 0.2 e motivo "dados insuficientes".
"""


@retry(
    retry=retry_if_exception_type((httpx.TransportError, httpx.HTTPStatusError)),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=8),
    reraise=True,
)
def _batch_chat(prompt: str) -> dict[str, Any] | None:
    provider, api_key, model, base_url = _provider_config()
    if not api_key:
        log.warning("AI provider %s sem API key — pulando batch", provider)
        return None
    url = (base_url or "https://api.openai.com/v1") + "/chat/completions"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": PERFIL_BRADATA + "\n\n" + BATCH_INSTRUCTIONS},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.0,
        "max_tokens": 4000,
        "response_format": {"type": "json_object"},
    }
    with httpx.Client(timeout=90) as client:
        r = client.post(url, headers=headers, json=payload)
    r.raise_for_status()
    content = r.json()["choices"][0]["message"]["content"]
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        log.warning("AI retornou JSON inválido: %s", content[:300])
        return None


def _build_batch_prompt(contratos: list[PncpContrato]) -> str:
    lines = [f"Classifique os {len(contratos)} contratos abaixo:\n"]
    for c in contratos:
        titulo = (c.titulo or "")[:150]
        descricao = (c.descricao or "")[:500]
        valor = f"R$ {c.valor_global:,.0f}" if c.valor_global else "s/v"
        lines.append(
            f'- id: "{c.id}"\n'
            f'  titulo: {titulo}\n'
            f'  descricao: {descricao}\n'
            f'  valor: {valor}\n'
            f'  modalidade: {c.modalidade_licitacao_nome or "—"}\n'
        )
    return "\n".join(lines)


def classificar_batch(contratos: list[PncpContrato]) -> dict[int, dict[str, Any]]:
    """Classifica um lote de contratos. Retorna {id_contrato: resultado}."""
    if not contratos:
        return {}
    prompt = _build_batch_prompt(contratos)
    result = _batch_chat(prompt)
    if not result:
        return {}

    out: dict[int, dict[str, Any]] = {}
    for item in result.get("resultados", []):
        try:
            cid = int(item.get("id"))
        except (TypeError, ValueError):
            continue
        out[cid] = {
            "classificacao": (item.get("classificacao") or "").upper() or None,
            "confianca": item.get("confianca"),
            "motivo": item.get("motivo"),
            "tipo_servico": item.get("tipo_servico"),
            "oportunidade_bodyshop": item.get("oportunidade_bodyshop"),
        }
    return out


def classificar_todos_pendentes(
    batch_size: int = DEFAULT_BATCH_SIZE,
    limit: int | None = None,
    triggered_by_id: int | None = None,
) -> dict:
    """Classifica todos os pncp_contratos com ai_classificacao IS NULL.

    Processa em lotes. Cria um EtlRun tipo='ai_batch' para rastreabilidade.
    """
    iniciado = datetime.now(timezone.utc)
    with SessionLocal() as db:
        # Cria o run
        run = EtlRun(
            tipo="ai_batch",
            status=EtlRunStatus.running,
            iniciado_em=iniciado,
            payload={"batch_size": batch_size, "limit": limit},
            triggered_by_id=triggered_by_id,
        )
        db.add(run)
        db.commit()
        run_id = run.id

        # Pega todos os contratos sem classificação
        q = db.query(PncpContrato).filter(PncpContrato.ai_classificacao.is_(None))
        if limit:
            q = q.limit(limit)
        pendentes = q.all()
        total = len(pendentes)

        run.contratos_a_processar = total
        db.commit()

        log.info("AI batch: %s contratos em lotes de %s", total, batch_size)

        processados_ok = 0
        erros = 0
        sim_count = 0

        for i in range(0, total, batch_size):
            lote = pendentes[i : i + batch_size]
            try:
                resultados = classificar_batch(lote)
                now = datetime.now(timezone.utc)
                for c in lote:
                    r = resultados.get(c.id)
                    if not r:
                        continue
                    c.ai_classificacao = r["classificacao"]
                    c.ai_confianca = r["confianca"]
                    c.ai_motivo = r["motivo"]
                    c.ai_tipo_servico = r["tipo_servico"]
                    c.ai_oportunidade = r["oportunidade_bodyshop"]
                    c.ai_processado_em = now
                    processados_ok += 1
                    if r["classificacao"] == "SIM":
                        sim_count += 1
                db.commit()
                run.contratos_ok = processados_ok
                run.ai_processados = processados_ok
                db.commit()
            except Exception as e:
                log.exception("Batch %s falhou: %s", i // batch_size + 1, e)
                erros += 1
                db.rollback()
            time.sleep(0.3)

        finalizado = datetime.now(timezone.utc)
        duracao = (finalizado - iniciado).total_seconds()
        resumo = {
            "total": total,
            "processados_ok": processados_ok,
            "classificados_sim": sim_count,
            "lotes_com_erro": erros,
            "batch_size": batch_size,
            "duracao_seg": duracao,
        }
        run.finalizado_em = finalizado
        run.duracao_seg = duracao
        run.status = EtlRunStatus.done if erros == 0 else EtlRunStatus.error
        run.contratos_ok = processados_ok
        run.contratos_com_erro = erros
        run.ai_processados = processados_ok
        safe = {k: (v.isoformat() if isinstance(v, datetime) else v) for k, v in resumo.items()}
        run.resumo = safe
        db.commit()

        log.info("AI batch finalizado: %s", resumo)
        return resumo
