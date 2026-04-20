"""Classificador IA: o contrato PNCP é um deal de bodyshop / staff augmentation?

Suporta DeepSeek (custo baixo) ou OpenAI (alta qualidade).
Cache em memória + opcional via banco para evitar re-classificação.
"""
from __future__ import annotations

import json
import logging
from typing import Any

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.core.config import settings

log = logging.getLogger("ai_classifier")


PERFIL_BRADATA = """
A Bradata é uma empresa de BODYSHOP / STAFF AUGMENTATION que aloca
profissionais de TI temporariamente em clientes (integradoras, consultorias,
órgãos públicos via integradoras). Queremos identificar empresas que
GANHARAM contratos públicos de TI cuja entrega exige TIME — porque essas
empresas precisam de talento e são prospects naturais.

CLASSIFIQUE como "SIM" se o contrato é predominantemente:
- alocação de profissionais (Java, Python, .NET, PO, Scrum, QA, DevOps, etc.)
- fábrica de software / desenvolvimento de sistemas
- sustentação / manutenção de sistemas (com pessoas, não automático)
- outsourcing de TI / serviços técnicos especializados em TI
- consultoria em tecnologia entregue por pessoas

CLASSIFIQUE como "NAO" se o contrato é sobre:
- hardware (notebooks, impressoras, switches, servidores)
- licenciamento de software (Microsoft, SAP, Oracle SaaS sem serviço humano)
- infraestrutura física, cabeamento, datacenter
- telefonia, telecomunicações
- manutenção predial, elétrica, ar condicionado, vigilância, limpeza
- compra de equipamentos
- contratos onde TI é acessório (objeto misto inseparável)

Em caso de dúvida → "NAO" (preferimos perder lead a poluir o pipeline).
"""

CLASSIFY_INSTRUCTIONS = """
Responda em JSON com:
{
  "classificacao": "SIM" | "NAO",
  "confianca": 0.0,
  "motivo": "uma frase",
  "tipo_servico": "alocacao | fabrica_software | sustentacao | consultoria | outro",
  "oportunidade_bodyshop": "frase com o pitch sugerido"
}
"""


def _provider_config() -> tuple[str, str, str, str | None]:
    provider = (settings.ai_provider or "deepseek").lower()
    if provider == "openai":
        return "openai", settings.openai_api_key, settings.openai_model, None
    return "deepseek", settings.deepseek_api_key, settings.deepseek_model, settings.deepseek_base_url


@retry(
    retry=retry_if_exception_type((httpx.TransportError, httpx.HTTPStatusError)),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=8),
    reraise=True,
)
def _chat_completion(prompt: str, system: str) -> dict[str, Any] | None:
    provider, api_key, model, base_url = _provider_config()
    if not api_key:
        log.warning("AI provider %s sem API key — pulando classificação", provider)
        return None

    url = (base_url or "https://api.openai.com/v1") + "/chat/completions"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.0,
        "max_tokens": 400,
        "response_format": {"type": "json_object"},
    }
    with httpx.Client(timeout=30) as client:
        r = client.post(url, headers=headers, json=payload)
    r.raise_for_status()
    content = r.json()["choices"][0]["message"]["content"]
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        log.warning("AI retornou JSON inválido: %s", content[:200])
        return None


def classificar_contrato(titulo: str, descricao: str, valor: float | None) -> dict[str, Any] | None:
    """Retorna {classificacao, confianca, motivo, tipo_servico, oportunidade_bodyshop}."""
    if not (titulo or descricao):
        return None
    valor_txt = f"R$ {valor:,.2f}" if valor else "não informado"
    prompt = (
        f"CONTRATO PNCP\n"
        f"Título: {titulo or '(vazio)'}\n"
        f"Descrição: {descricao or '(vazio)'}\n"
        f"Valor: {valor_txt}\n\n"
        f"{CLASSIFY_INSTRUCTIONS}"
    )
    return _chat_completion(prompt, PERFIL_BRADATA)
