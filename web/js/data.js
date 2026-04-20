// Mock data — usado enquanto a integração com a API REST não está plugada.
// Para conectar ao backend, troque cada chave por fetch('/api/v1/...').
(function () {
  const fmt = {
    brl: (v) => (v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })),
    brlK: (v) => {
      if (v == null) return '—';
      if (v >= 1_000_000_000) return 'R$ ' + (v / 1_000_000_000).toFixed(1) + 'Bi';
      if (v >= 1_000_000) return 'R$ ' + (v / 1_000_000).toFixed(1) + 'M';
      if (v >= 1_000) return 'R$ ' + (v / 1_000).toFixed(0) + 'k';
      return 'R$ ' + v.toFixed(0);
    },
    num: (v) => (v == null ? '—' : v.toLocaleString('pt-BR')),
    cnpj: (c) => {
      if (!c) return '';
      const d = String(c).padStart(14, '0');
      return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12,14)}`;
    },
    date: (s) => (s ? new Date(s).toLocaleDateString('pt-BR') : '—'),
    relative: (s) => {
      if (!s) return '—';
      const ms = Date.now() - new Date(s).getTime();
      const min = Math.floor(ms / 60000);
      if (min < 60) return `há ${min} min`;
      const h = Math.floor(min / 60);
      if (h < 24) return `há ${h}h`;
      const d = Math.floor(h / 24);
      if (d < 30) return `há ${d}d`;
      return new Date(s).toLocaleDateString('pt-BR');
    },
  };

  const ROLES = {
    master: { id: 'master', label: 'Master', color: '#7C3AED', descr: 'Acesso total ao sistema, billing, time e configurações.', perms: ['Gerenciar todos os usuários', 'Configurar integrações', 'Acesso a billing', 'Promover/rebaixar Masters'] },
    admin:  { id: 'admin',  label: 'Admin',  color: '#0EA5E9', descr: 'Gerencia time, pipelines e relatórios. Sem acesso a billing.', perms: ['Convidar usuários', 'Editar pipelines', 'Ver relatórios completos', 'Configurar PNCP'] },
    comum:  { id: 'comum',  label: 'Usuário', color: '#10B981', descr: 'Trabalha leads e oportunidades atribuídos.', perms: ['Ver leads atribuídos', 'Criar atividades', 'Mover deals no próprio pipeline', 'Comentar e anotar'] },
  };

  const CURRENT_USER = {
    id: 'u1', name: 'Rafael Marques', email: 'rafael@bradata.com.br',
    role: 'master', team: 'Sales', status: 'ativo',
    createdAt: '2025-09-12', lastSeen: new Date().toISOString(),
    deals: 6, won: 3, revenue: 6_100_000,
  };

  const USERS = [
    CURRENT_USER,
    { id: 'u2', name: 'Amanda Costa', email: 'amanda@bradata.com.br', role: 'admin', team: 'Sales', status: 'ativo', createdAt: '2025-10-04', lastSeen: new Date(Date.now() - 1000 * 60 * 22).toISOString(), deals: 8, won: 5, revenue: 9_200_000 },
    { id: 'u3', name: 'Tiago Alencar', email: 'tiago@bradata.com.br', role: 'comum', team: 'SDR',   status: 'ativo', createdAt: '2025-11-12', lastSeen: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), deals: 4, won: 2, revenue: 3_400_000 },
    { id: 'u4', name: 'Bianca Lima',   email: 'bianca@bradata.com.br', role: 'comum', team: 'SDR',   status: 'pendente', createdAt: '2026-04-12', lastSeen: null, deals: 0, won: 0, revenue: 0 },
  ];

  const STAGES = [
    { id: 'prospect',     label: 'Prospecção',  color: '#3B82F6' },
    { id: 'qualificacao', label: 'Qualificação', color: '#06B6D4' },
    { id: 'proposta',     label: 'Proposta',     color: '#F59E0B' },
    { id: 'negociacao',   label: 'Negociação',   color: '#EF6C00' },
    { id: 'ganho',        label: 'Ganho',        color: '#10B981' },
  ];

  const COMPANIES = {
    c1: { id: 'c1', name: 'TIVIT', cnpj: '00742594000196', city: 'São Paulo', uf: 'SP', sector: 'Integradora', website: 'tivit.com', revenue: 1_400_000_000, employees: 7800, contractsPncp: 28, ativosGov: 12, score: 92, status: 'lead', stack: ['Java', 'AWS', 'Microservices', '.NET'], ticketMedio: 2_400_000, contactsN: 3 },
    c2: { id: 'c2', name: 'Stefanini', cnpj: '58069360000175', city: 'Jaguariúna', uf: 'SP', sector: 'Consultoria', website: 'stefanini.com', revenue: 4_200_000_000, employees: 32000, contractsPncp: 41, ativosGov: 18, score: 96, status: 'lead', stack: ['Java', 'SAP', 'Salesforce', 'Cloud'], ticketMedio: 3_100_000, contactsN: 3 },
    c3: { id: 'c3', name: 'CI&T', cnpj: '00609634000150', city: 'Campinas', uf: 'SP', sector: 'Consultoria', website: 'ciandt.com', revenue: 2_100_000_000, employees: 6800, contractsPncp: 9, ativosGov: 4, score: 88, status: 'prospect', stack: ['Node', 'React', 'AWS', 'AI'], ticketMedio: 1_800_000, contactsN: 2 },
    c4: { id: 'c4', name: 'Everis Brasil', cnpj: '00000000000100', city: 'São Paulo', uf: 'SP', sector: 'Integradora', website: 'nttdata.com', revenue: 980_000_000, employees: 4200, contractsPncp: 14, ativosGov: 9, score: 84, status: 'cliente', stack: ['SAP', 'Java', 'AI'], ticketMedio: 1_400_000, contactsN: 3 },
    c5: { id: 'c5', name: 'SERPRO', cnpj: '33683111000107', city: 'Brasília', uf: 'DF', sector: 'Estatal', website: 'serpro.gov.br', revenue: 3_200_000_000, employees: 9200, contractsPncp: 67, ativosGov: 67, score: 76, status: 'lead', stack: ['Java', 'Linux', 'Postgres'], ticketMedio: 4_200_000, contactsN: 2 },
  };

  const COMPANY_LIST = Object.values(COMPANIES);

  const DEALS = [
    { id: 'd1', title: 'Squad AI/ML — TCU',          company: 'c1', stage: 'proposta',     value: 1_200_000, prob: 60, owner: 'Amanda Costa',  closeDate: '2026-05-10', tags: ['squad','ai'] },
    { id: 'd2', title: 'Bodyshop Java — Stefanini',  company: 'c2', stage: 'negociacao',   value: 2_400_000, prob: 75, owner: 'Rafael Marques', closeDate: '2026-04-30', tags: ['bodyshop','java'] },
    { id: 'd3', title: 'Sustentação .NET — CI&T',     company: 'c3', stage: 'qualificacao', value:   650_000, prob: 30, owner: 'Tiago Alencar',  closeDate: '2026-06-15', tags: ['sustentação'] },
    { id: 'd4', title: 'Squad Mobile — TIVIT',       company: 'c1', stage: 'prospect',     value:   980_000, prob: 10, owner: 'Amanda Costa',  closeDate: '2026-07-20', tags: ['mobile'] },
    { id: 'd5', title: 'Outsourcing Cloud — Everis', company: 'c4', stage: 'ganho',        value: 1_800_000, prob: 100, owner: 'Rafael Marques', closeDate: '2026-04-08', tags: ['cloud'] },
    { id: 'd6', title: 'Bodyshop QA — SERPRO',       company: 'c5', stage: 'proposta',     value:   720_000, prob: 55, owner: 'Amanda Costa',  closeDate: '2026-05-22', tags: ['qa'] },
  ];

  const ACTIVITIES = [
    { id: 'a1', title: 'Call de descoberta — TIVIT', type: 'reuniao', owner: 'Amanda Costa', when: new Date(Date.now() + 1000*60*60*2).toISOString(), status: 'pendente', priority: 'alta' },
    { id: 'a2', title: 'Enviar proposta — Stefanini', type: 'email',  owner: 'Rafael Marques', when: new Date(Date.now() + 1000*60*30).toISOString(),     status: 'pendente', priority: 'alta' },
    { id: 'a3', title: 'Follow-up SERPRO',           type: 'whatsapp',owner: 'Amanda Costa', when: new Date(Date.now() + 1000*60*60*5).toISOString(),  status: 'pendente', priority: 'media' },
    { id: 'a4', title: 'Briefing CI&T',              type: 'reuniao', owner: 'Tiago Alencar', when: new Date(Date.now() + 1000*60*60*24).toISOString(), status: 'pendente', priority: 'media' },
    { id: 'a5', title: 'Recap Q1 com diretoria',     type: 'reuniao', owner: 'Rafael Marques', when: new Date(Date.now() - 1000*60*60*5).toISOString(),  status: 'concluida', priority: 'media' },
  ];

  const PNCP_CONTRACTS = [
    { id: 'p1', orgao: 'TCU',          numero: '0123/2026', objeto: 'Squad de IA/ML para análise de dados orçamentários', fornecedor: 'Everis Brasil', cnpj_fornecedor: '00000000000100', valor: 15_400_000, modalidade: 'Pregão Eletrônico', vigencia: '12 meses', publicado: new Date(Date.now() - 1000*60*60*22).toISOString() },
    { id: 'p2', orgao: 'INSS',         numero: '0456/2026', objeto: 'Sustentação de sistemas legados Java + integração e-Social', fornecedor: 'TIVIT', cnpj_fornecedor: '00742594000196', valor: 41_200_000, modalidade: 'Pregão Eletrônico', vigencia: '24 meses', publicado: new Date(Date.now() - 1000*60*60*48).toISOString() },
    { id: 'p3', orgao: 'BNDES',        numero: '0789/2026', objeto: 'Fábrica de software ágil — squads multidisciplinares', fornecedor: 'Stefanini', cnpj_fornecedor: '58069360000175', valor: 28_900_000, modalidade: 'Pregão Eletrônico', vigencia: '36 meses', publicado: new Date(Date.now() - 1000*60*60*72).toISOString() },
    { id: 'p4', orgao: 'SERPRO',       numero: '0234/2026', objeto: 'Outsourcing de profissionais DevOps + SRE', fornecedor: 'CI&T', cnpj_fornecedor: '00609634000150', valor: 9_800_000, modalidade: 'Inexigibilidade', vigencia: '12 meses', publicado: new Date(Date.now() - 1000*60*60*120).toISOString() },
    { id: 'p5', orgao: 'BACEN',        numero: '0345/2026', objeto: 'Alocação de profissionais Java/Spring Boot', fornecedor: 'TIVIT', cnpj_fornecedor: '00742594000196', valor: 12_500_000, modalidade: 'Pregão Eletrônico', vigencia: '12 meses', publicado: new Date(Date.now() - 1000*60*60*168).toISOString() },
  ];

  const NOTIFICATIONS = [
    { id: 'n1', kind: 'pncp_match', titulo: '3 novos contratos de bodyshop hoje', mensagem: 'TIVIT, Stefanini e CI&T', lida: false, when: new Date(Date.now() - 1000*60*8).toISOString() },
    { id: 'n2', kind: 'sla_risk',  titulo: 'SLA em risco — SERPRO', mensagem: 'Deal sem movimento há 5 dias', lida: false, when: new Date(Date.now() - 1000*60*60).toISOString() },
  ];

  window.DATA = { fmt, ROLES, CURRENT_USER, USERS, STAGES, COMPANIES, COMPANY_LIST, DEALS, ACTIVITIES, PNCP_CONTRACTS, NOTIFICATIONS };
})();
