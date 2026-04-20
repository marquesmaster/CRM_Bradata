"""Configuração de prospecção PNCP — Bradata.

Estratégia de prospect: buscamos contratos PNCP do tipo bodyshop / staff
augmentation / fábrica de software. Os fornecedores que ganham esses
contratos são integradoras de TI que **consomem talento** — leads naturais
para a Bradata vender bodyshop.

Carrega de config_prospect.json (override). Se não existir, usa DEFAULTS.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

CONFIG_FILE = Path("config_prospect.json")


DEFAULTS: dict[str, Any] = {
    "ufs": [
        "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
        "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
        "RS", "RO", "RR", "SC", "SP", "SE", "TO",
    ],
    "tipos_documento": "contrato",
    "status": "vigente",
    "tam_pagina": 500,
    "max_paginas": 10,
    # KEYWORDS focadas em bodyshop / staff augmentation / fábrica de software
    "keywords": [
        # Genéricas — alocação / staff augmentation
        "alocação de postos de trabalho",
        "alocação de profissionais",
        "alocação de mão de obra de TI",
        "terceirização de serviços de TI",
        "outsourcing de TI",
        "outsourcing de serviços de TI",
        "contratação de serviços continuados de TI",
        "serviços técnicos especializados em tecnologia da informação",
        "postos de serviço",
        "disponibilização de profissionais",
        "mão de obra especializada em TI",
        "serviços de natureza continuada de TI",
        "contratação de horas de serviço técnico",
        "Unidade de Serviço Técnico",
        "UST",
        "homem-hora",
        "consultoria em TI",
        "body shop",
        "bodyshop",
        # Fábrica / desenvolvimento
        "fábrica de software",
        "fábrica de projetos",
        "sustentação de sistemas",
        "desenvolvimento de software",
        "desenvolvimento de sistemas",
        "manutenção de sistemas",
        "sustentação de aplicações",
        "suporte a sistemas",
        # Funções específicas
        "desenvolvedor Java",
        "desenvolvedor Python",
        "desenvolvedor .NET",
        "desenvolvedor Front-end",
        "desenvolvedor Back-end",
        "desenvolvedor Fullstack",
        "desenvolvedor Mobile",
        "desenvolvedor React",
        "desenvolvedor Angular",
        "analista de sistemas",
        "analista de requisitos",
        "analista de negócios",
        "arquiteto de software",
        "arquiteto de soluções",
        "engenheiro de software",
        "DBA",
        "administrador de banco de dados",
        "analista de testes",
        "analista de qualidade de software",
        "QA",
        "Scrum Master",
        "Product Owner",
        "agile coach",
        "DevOps",
        "engenheiro DevOps",
        "analista de segurança da informação",
        "especialista em segurança da informação",
        "especialista em LGPD",
        "analista de infraestrutura de TI",
        "especialista em redes",
        "service desk",
        "field service",
        "especialista em Cloud",
        "especialista em AWS",
        "especialista em Azure",
        "analista de BI",
        "business intelligence",
        "cientista de dados",
        "engenheiro de dados",
        "arquiteto de dados",
        "UX designer",
        "UI designer",
        # Plataformas (ajuda a achar contratos específicos)
        "Power BI",
        "Salesforce",
        "ServiceNow",
        "SAP",
        "Qlik",
        "Tableau",
        "SharePoint",
        # Governança
        "governança de TI",
        "operação de TI",
    ],
    "palavras_exclusao": [
        "hardware", "impressora", "toner", "cabeamento", "vigilância",
        "limpeza", "obra", "engenharia civil", "merenda", "frota",
        "câmera", "monitoramento veicular", "videomonitoramento",
        "georreferenciamento", "agrimensura", "topografia", "medicina",
        "odontologia", "ambulância", "manutenção predial", "ar condicionado",
    ],
    "palavras_inclusao": [
        "alocação", "outsourcing", "bodyshop", "body shop", "staff augmentation",
        "fábrica de software", "desenvolvimento", "sustentação", "manutenção",
        "consultoria", "ti", "tic", "tecnologia da informação", "software",
        "sistema", "desenvolvedor", "analista", "arquiteto", "scrum", "agile",
        "devops", "qa", "testes", "ux", "ui", "cloud", "dados", "bi",
        "business intelligence", "service desk", "infraestrutura", "lgpd",
        "segurança da informação", "ust", "homem-hora", "hh",
    ],
    "modalidades_estrategicas": [4, 6, 8, 9],
    "prefiltro_threshold": 0,
    "valor_minimo": 50_000,
}


def load() -> dict[str, Any]:
    if CONFIG_FILE.exists():
        try:
            data = json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
            return {**DEFAULTS, **data}
        except (json.JSONDecodeError, OSError):
            pass
    return DEFAULTS.copy()


def save(data: dict[str, Any]) -> None:
    CONFIG_FILE.write_text(
        json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
    )
