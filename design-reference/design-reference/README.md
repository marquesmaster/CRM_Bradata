# CRM Bradata — código-fonte completo

Estrutura de uma single-page React com Babel inline.

```
CRM Bradata.html             # entrypoint
styles.css                   # styles compilados (theme + app)
src/
  theme.css                  # tokens, cores, tipografia, base
  app.css                    # classes específicas da aplicação
  data.jsx                   # mock data + DATA, ROLES, USERS, CURRENT_USER
  icons.jsx                  # ícones SVG inline (window.I)
  ui.jsx                     # primitivos compartilhados (window.UI)
  AIChat.jsx                 # painel Bradata AI (Claude Haiku)
  App.jsx                    # shell — sidebar, topbar, rotas, tweaks
  screens/
    Dashboard.jsx            # 3 variações via tweak
    PNCP.jsx                 # descoberta de contratos governo
    LeadDetail.jsx           # detalhe lead/empresa com score
    Pipeline.jsx             # kanban + lista + timeline
    Accounts.jsx             # lista mestre de contas
    Activities.jsx           # tarefas/atividades
    Reports.jsx              # relatórios de funil
    Users.jsx                # gestão de papéis
    Profile.jsx              # perfil do usuário logado
    Settings.jsx             # configurações
```

## Convenções

Cada screen file:
1. Importa de globals (window.DATA, window.I, window.UI)
2. Define seu(s) componente(s)
3. Expõe via `window.NomeDaTela = NomeDaTela;` no fim

Para usar em produção, migre para módulos ES (import/export) e quebre o data.jsx em arquivos por entidade. Os papéis em `ROLES` (master, admin, comum) devem virar política RBAC no backend.

## Tweaks expostos

`dashboardVariant`: executive | pulse | operator
`discoveryVariant`: cards | table | radar
`pipelineLayout`: kanban | list | timeline
`accent`: bradata | indigo | violet | emerald | amber | rose
`density`: comfy | cozy | compact
`radius`: sharp | normal | rounded
