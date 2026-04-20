# CRM Bradata

API do CRM da Bradata com integração PNCP (Portal Nacional de Contratações Públicas)
e gestão comercial completa: leads, empresas, contatos, pipeline, oportunidades,
atividades, tarefas e relatórios.

## Stack

- Python 3.12 + FastAPI
- SQLAlchemy 2 + Alembic + PostgreSQL
- APScheduler (job diário PNCP)
- JWT (python-jose) + bcrypt
- httpx + tenacity (cliente PNCP/CNPJ WS resiliente)

## Arquitetura

```
app/
├── core/          # config, database, security, deps
├── models/        # SQLAlchemy: User, Empresa, Contato, Lead, Oportunidade,
│                  #             Pipeline, Atividade, Tarefa, Nota, Historico,
│                  #             PncpContrato, PncpCompra, PncpCompraItem,
│                  #             PncpResultado
├── schemas/       # Pydantic v2 (request/response)
├── routers/       # auth, users, empresas, contatos, leads, pipelines,
│                  # oportunidades, atividades, tarefas, notas, pncp, relatorios
├── services/
│   ├── pncp/      # 4 etapas de ETL: search → contrato → compra → resultados
│   ├── cnpj_ws.py     # Enriquecimento de empresas via CNPJ WS
│   ├── empresa_service.py  # Classificador ICP (TI + faturamento)
│   └── bootstrap.py        # Admin e pipeline default
└── workers/       # scheduler (cron diário PNCP)
```

## ETL PNCP — 4 etapas

Cada etapa é idempotente (UPSERT) e pode ser rodada isolada ou em cadeia.

### 1. Busca de contratos — `/api/search/`

```
GET https://pncp.gov.br/api/search/?tipos_documento=contrato&ordenacao=-data
    &pagina=1&tam_pagina=500&status=vigente&q=software&ufs=SP
```

Salva em `pncp_contratos` usando `numero_controle_pncp` como chave.

### 2. Detalhe do contrato

```
GET https://pncp.gov.br/api/pncp/v1/orgaos/{cnpj}/contratos/{ano}/{seq}
```

Extrai o campo `numeroControlePncpCompra` (formato `cnpj-tipo-seq/ano`) e resolve
para o par `(cnpj, ano, sequencial)` removendo o componente "tipo".

### 3. Detalhe da compra (edital)

```
GET https://pncp.gov.br/api/consulta/v1/orgaos/{cnpj}/compras/{ano}/{seq}
```

Grava objeto da compra, valor estimado, homologado, modalidade, órgão, etc.

### 4. Itens + resultados (fornecedores)

```
GET /api/pncp/v1/orgaos/{cnpj}/compras/{ano}/{seq}/itens?pagina=1&tamanhoPagina=50
GET /api/pncp/v1/orgaos/{cnpj}/compras/{ano}/{seq}/itens/{numero_item}/resultados
```

Cada resultado vira/atualiza uma `Empresa` (CNPJ do fornecedor), que é classificada
imediatamente pelo ICP.

### Cron diário

Ativado por `SCHEDULER_ENABLED=true`. Configuração: `PNCP_DAILY_CRON_HOUR`,
`PNCP_DAILY_CRON_MINUTE` (America/Sao_Paulo).

## ICP (Ideal Customer Profile)

Empresa é ICP quando:
- CNAE principal (ou secundário) pertence à lista `ICP_CNAES_TI` **E**
- `faturamento_estimado >= ICP_MIN_FATURAMENTO` (padrão R$ 120.000.000).

Score: 0–100. Campos: `is_icp`, `icp_score`, `icp_motivo`.

## LinkedIn

Scraping direto do LinkedIn **viola o Termo de Uso** e expõe risco jurídico
(precedente *hiQ Labs v. LinkedIn* e evoluções). A API de Sales Navigator / Marketing
API requer parceria. O enriquecimento suportado é via:
- **CNPJ WS** (`publica.cnpj.ws`) — grátis (rate-limit), pago com token.
- Manual: campo `linkedin_url` em `empresas` e `contatos`.

## Endpoints principais

```
POST /api/v1/auth/login                  Login OAuth2 (form-data)
POST /api/v1/auth/login-json             Login JSON

GET  /api/v1/empresas                    Lista empresas (filtros)
POST /api/v1/empresas                    Cria empresa (manual / BDR)
POST /api/v1/empresas/{id}/enriquecer    Enriquece via CNPJ WS

GET  /api/v1/leads
POST /api/v1/leads
POST /api/v1/leads/{id}/converter        Converte lead em oportunidade

GET  /api/v1/oportunidades
POST /api/v1/oportunidades/{id}/fechar

GET  /api/v1/pipelines

POST /api/v1/pncp/etl/run                Dispara ETL completo em background
GET  /api/v1/pncp/contratos
POST /api/v1/pncp/contratos/{id}/compra  Processa compra+itens+resultados

GET  /api/v1/relatorios/dashboard
GET  /api/v1/relatorios/funil
GET  /api/v1/relatorios/bdr
GET  /api/v1/relatorios/icp
GET  /api/v1/relatorios/pncp/top-fornecedores
```

Documentação interativa: `http://localhost:8000/docs`.

## Como rodar

```bash
# 1. Local com Docker Compose
cp .env.example .env
docker compose up --build

# 2. Local com Python
cp .env.example .env
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

Credenciais default do admin (mudar em produção):
- Email: `admin@bradata.com.br`
- Senha: `ChangeMe!2026`

## ETL manual

```bash
python -m scripts.run_etl_manual --tipos contrato --ufs SP,RJ --keywords "software,TI"
```

## Modelo de dados (resumo)

- **users** → BDRs, vendedores, gestores, admin
- **empresas** → clientes/prospects (dedup por CNPJ), com flag `is_icp` e score
- **contatos** → pessoas na empresa (1:N), com `decisor`
- **leads** → estágio pré-oportunidade, converte para oportunidade
- **pipelines / pipeline_estagios** → configuração do funil
- **oportunidades** → pode vir de lead ou manual; tem estágio, valor, status
- **atividades** → histórico de interações (call/email/reunião/WhatsApp)
- **tarefas** → to-do com due_date e assignee
- **notas** → comentários livres vinculados a qualquer entidade
- **historico** → audit log
- **pncp_contratos / pncp_compras / pncp_compra_itens / pncp_resultados** → dados brutos do PNCP
