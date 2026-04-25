// Mock data for CRM Bradata
const fmt = {
  brl: (v) => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
  brlK: (v) => {
    if (v >= 1_000_000) return 'R$ ' + (v / 1_000_000).toFixed(1).replace('.', ',') + 'M';
    if (v >= 1_000) return 'R$ ' + (v / 1_000).toFixed(0) + 'k';
    return 'R$ ' + v;
  },
  num: (v) => Number(v).toLocaleString('pt-BR'),
  cnpj: (s) => s?.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5'),
  date: (d) => new Date(d).toLocaleDateString('pt-BR'),
  relative: (iso) => {
    const d = new Date(iso);
    const delta = (Date.now() - d.getTime()) / 1000;
    if (delta < 60) return 'agora';
    if (delta < 3600) return Math.floor(delta/60) + 'min';
    if (delta < 86400) return Math.floor(delta/3600) + 'h';
    if (delta < 86400*7) return Math.floor(delta/86400) + 'd';
    return d.toLocaleDateString('pt-BR');
  },
};

const COMPANIES = [
  { id:'c1', name:'Stefanini', cnpj:'58069360000184', city:'Jaguariúna', uf:'SP', revenue: 4200_000_000, employees: 31000, stack:['Java','AWS','COBOL','.NET'], score: 92, temp:'quente', sector:'Integradora', website:'stefanini.com', contactsN: 4, contractsPncp: 87, ativosGov: 47, ticketMedio: 2_400_000 },
  { id:'c2', name:'TIVIT', cnpj:'07341657000200', city:'São Paulo', uf:'SP', revenue: 2800_000_000, employees: 10000, stack:['AWS','Azure','SAP','DevOps'], score: 88, temp:'quente', sector:'Cloud & IT', website:'tivit.com', contactsN: 3, contractsPncp: 54, ativosGov: 29, ticketMedio: 1_900_000 },
  { id:'c3', name:'CI&T', cnpj:'00609634000132', city:'Campinas', uf:'SP', revenue: 2250_000_000, employees: 7200, stack:['React','Node','GCP','AI'], score: 71, temp:'morno', sector:'Digital', website:'ciandt.com', contactsN: 2, contractsPncp: 19, ativosGov: 8, ticketMedio: 890_000 },
  { id:'c4', name:'Dedalus', cnpj:'08987776000151', city:'Porto Alegre', uf:'RS', revenue: 780_000_000, employees: 2400, stack:['Salesforce','Java','Oracle'], score: 81, temp:'quente', sector:'Consultoria', website:'dedalus.com.br', contactsN: 2, contractsPncp: 34, ativosGov: 22, ticketMedio: 1_200_000 },
  { id:'c5', name:'BRQ Digital Solutions', cnpj:'17297395000127', city:'São Paulo', uf:'SP', revenue: 650_000_000, employees: 4500, stack:['AWS','Microservices','Python'], score: 79, temp:'morno', sector:'Digital', website:'brq.com', contactsN: 2, contractsPncp: 41, ativosGov: 19, ticketMedio: 1_100_000 },
  { id:'c6', name:'Sonda IT', cnpj:'33929976000187', city:'São Paulo', uf:'SP', revenue: 1500_000_000, employees: 8600, stack:['SAP','ERP','Oracle','Cloud'], score: 84, temp:'quente', sector:'Integradora', website:'sonda-it.com', contactsN: 3, contractsPncp: 62, ativosGov: 33, ticketMedio: 1_700_000 },
  { id:'c7', name:'Capgemini Brasil', cnpj:'61149961000120', city:'São Paulo', uf:'SP', revenue: 3100_000_000, employees: 15000, stack:['SAP','Salesforce','Cloud'], score: 75, temp:'morno', sector:'Consultoria global', website:'capgemini.com', contactsN: 1, contractsPncp: 22, ativosGov: 9, ticketMedio: 2_800_000 },
  { id:'c8', name:'Politec', cnpj:'00555569000110', city:'Brasília', uf:'DF', revenue: 420_000_000, employees: 3100, stack:['Java','Oracle','Mainframe'], score: 89, temp:'quente', sector:'Governo', website:'politec.com', contactsN: 3, contractsPncp: 71, ativosGov: 48, ticketMedio: 1_450_000 },
  { id:'c9', name:'IndraCompany Brasil', cnpj:'45283163000126', city:'Rio de Janeiro', uf:'RJ', revenue: 580_000_000, employees: 2800, stack:['.NET','Oracle','Azure'], score: 72, temp:'morno', sector:'Defesa/Gov', website:'indracompany.com', contactsN: 2, contractsPncp: 38, ativosGov: 18, ticketMedio: 2_100_000 },
  { id:'c10', name:'Alest Tecnologia', cnpj:'05498420000102', city:'Belo Horizonte', uf:'MG', revenue: 220_000_000, employees: 1400, stack:['Java','Angular','AWS'], score: 66, temp:'frio', sector:'Bodyshop', website:'alest.com.br', contactsN: 1, contractsPncp: 27, ativosGov: 12, ticketMedio: 680_000 },
  { id:'c11', name:'Hexagon Consulting', cnpj:'20174693000120', city:'Curitiba', uf:'PR', revenue: 180_000_000, employees: 980, stack:['SAP','Salesforce'], score: 63, temp:'frio', sector:'Consultoria', website:'hexagon.com.br', contactsN: 1, contractsPncp: 14, ativosGov: 5, ticketMedio: 540_000 },
  { id:'c12', name:'Everis Brasil (NTT Data)', cnpj:'07923254000130', city:'São Paulo', uf:'SP', revenue: 1100_000_000, employees: 6200, stack:['SAP','Java','AWS'], score: 82, temp:'quente', sector:'Integradora', website:'nttdata.com', contactsN: 4, contractsPncp: 45, ativosGov: 21, ticketMedio: 2_050_000 },
];

// Convert to both array and map for flexible access
const COMPANY_LIST = COMPANIES.slice();
const COMPANIES_MAP = {};
COMPANIES.forEach(c => { COMPANIES_MAP[c.id] = c; });

// Pipeline stages
const STAGES = [
  { id:'novo', label:'Novo Lead', color:'#94a3b8', descr:'Leads identificados' },
  { id:'qualificado', label:'Qualificado', color:'#0ea5e9', descr:'Fit confirmado' },
  { id:'reuniao', label:'Reunião Agendada', color:'#6366f1', descr:'1ª call marcada' },
  { id:'proposta', label:'Proposta', color:'#f59e0b', descr:'Proposta enviada' },
  { id:'negociacao', label:'Negociação', color:'#ea580c', descr:'Ajustes finais' },
  { id:'ganho', label:'Ganho', color:'#16a34a', descr:'Fechado' },
];

// Deals
const DEALS = [
  { id:'d1', company:'c1', title:'Bodyshop 12 devs Java Sr — Dataprev', value: 2_880_000, stage:'negociacao', owner:'Rafael Marques', prob: 75, closeDate:'2026-05-20', tags:['Gov Federal','Urgente'], sla:'30d' },
  { id:'d2', company:'c2', title:'Squad Cloud AWS — BB Tecnologia', value: 1_740_000, stage:'proposta', owner:'Amanda Costa', prob: 60, closeDate:'2026-06-10', tags:['Cloud'], sla:'45d' },
  { id:'d3', company:'c6', title:'Bodyshop 8 devs SAP — Ministério Fazenda', value: 1_920_000, stage:'reuniao', owner:'Rafael Marques', prob: 40, closeDate:'2026-07-01', tags:['SAP','Gov'], sla:'60d' },
  { id:'d4', company:'c4', title:'Arquiteto Oracle Sr — STJ', value: 540_000, stage:'qualificado', owner:'Tiago Alencar', prob: 30, closeDate:'2026-06-30', tags:['Oracle'], sla:'90d' },
  { id:'d5', company:'c8', title:'Bodyshop 20 devs Mainframe — SERPRO', value: 4_200_000, stage:'negociacao', owner:'Amanda Costa', prob: 80, closeDate:'2026-05-12', tags:['Mainframe','Prioridade'], sla:'15d' },
  { id:'d6', company:'c12', title:'Squad AI/ML — TCU', value: 1_280_000, stage:'proposta', owner:'Rafael Marques', prob: 55, closeDate:'2026-06-22', tags:['AI/ML','Gov'], sla:'45d' },
  { id:'d7', company:'c5', title:'3 devs Python — BNDES', value: 720_000, stage:'qualificado', owner:'Tiago Alencar', prob: 35, closeDate:'2026-07-10', tags:['Python'], sla:'60d' },
  { id:'d8', company:'c3', title:'Squad React Native — Correios', value: 960_000, stage:'novo', owner:'Amanda Costa', prob: 15, closeDate:'2026-08-01', tags:['Mobile'], sla:'90d' },
  { id:'d9', company:'c9', title:'Bodyshop .NET — Marinha', value: 1_560_000, stage:'reuniao', owner:'Rafael Marques', prob: 45, closeDate:'2026-06-15', tags:['Defesa'], sla:'60d' },
  { id:'d10', company:'c7', title:'Migração SAP S/4 — ANTT', value: 3_200_000, stage:'novo', owner:'Tiago Alencar', prob: 20, closeDate:'2026-09-01', tags:['SAP'], sla:'120d' },
  { id:'d11', company:'c6', title:'DevOps 4 SRE — Caixa Econômica', value: 820_000, stage:'ganho', owner:'Amanda Costa', prob: 100, closeDate:'2026-04-10', tags:['DevOps'], sla:'30d', closedAt:'2026-04-10' },
  { id:'d12', company:'c1', title:'COBOL Sr 6 devs — INSS', value: 1_440_000, stage:'ganho', owner:'Rafael Marques', prob: 100, closeDate:'2026-03-22', tags:['COBOL'], sla:'45d', closedAt:'2026-03-22' },
];

// PNCP contracts (raw from agreement data)
const PNCP_CONTRACTS = [
  { id:'p1', orgao:'DATAPREV', cnpj_fornecedor:'58069360000184', fornecedor:'Stefanini', uf:'DF', valor: 12_400_000, vigencia:'2024-2028', modalidade:'Pregão Eletrônico', objeto:'Desenvolvimento de sistemas Java EE para previdência social', publicado:'2025-11-14', status:'vigente', numero:'NE 0234/2025' },
  { id:'p2', orgao:'SERPRO', cnpj_fornecedor:'00555569000110', fornecedor:'Politec', uf:'DF', valor: 28_800_000, vigencia:'2024-2029', modalidade:'Pregão Eletrônico', objeto:'Manutenção e evolução de mainframe / COBOL', publicado:'2025-10-02', status:'vigente', numero:'AT 0199/2025' },
  { id:'p3', orgao:'Ministério da Fazenda', cnpj_fornecedor:'33929976000187', fornecedor:'Sonda IT', uf:'DF', valor: 18_200_000, vigencia:'2025-2028', modalidade:'Dispensa', objeto:'Consultoria SAP S/4 Hana para módulos financeiros', publicado:'2026-01-11', status:'vigente', numero:'DL 0044/2026' },
  { id:'p4', orgao:'BNDES', cnpj_fornecedor:'07341657000200', fornecedor:'TIVIT', uf:'RJ', valor: 9_700_000, vigencia:'2025-2027', modalidade:'Pregão Eletrônico', objeto:'Hospedagem em nuvem híbrida e gestão de operações', publicado:'2025-12-04', status:'vigente', numero:'NE 0512/2025' },
  { id:'p5', orgao:'TCU', cnpj_fornecedor:'07923254000130', fornecedor:'Everis Brasil (NTT Data)', uf:'DF', valor: 15_400_000, vigencia:'2025-2029', modalidade:'Pregão Eletrônico', objeto:'Prestação de serviços de AI aplicada a auditoria', publicado:'2026-02-18', status:'vigente', numero:'NE 0091/2026' },
  { id:'p6', orgao:'Caixa Econômica', cnpj_fornecedor:'33929976000187', fornecedor:'Sonda IT', uf:'DF', valor: 6_400_000, vigencia:'2025-2026', modalidade:'Pregão Eletrônico', objeto:'SRE e DevOps para plataformas Digitais', publicado:'2025-11-22', status:'vigente', numero:'NE 0445/2025' },
  { id:'p7', orgao:'STJ', cnpj_fornecedor:'08987776000151', fornecedor:'Dedalus', uf:'DF', valor: 3_600_000, vigencia:'2025-2027', modalidade:'Pregão Eletrônico', objeto:'Sustentação Oracle DBA e Data Integration', publicado:'2026-01-30', status:'vigente', numero:'NE 0067/2026' },
  { id:'p8', orgao:'Marinha do Brasil', cnpj_fornecedor:'45283163000126', fornecedor:'IndraCompany Brasil', uf:'RJ', valor: 22_100_000, vigencia:'2024-2028', modalidade:'Inexigibilidade', objeto:'Plataforma de C2 — Comando e Controle', publicado:'2025-09-03', status:'vigente', numero:'IN 0021/2025' },
  { id:'p9', orgao:'INSS', cnpj_fornecedor:'58069360000184', fornecedor:'Stefanini', uf:'DF', valor: 41_000_000, vigencia:'2024-2028', modalidade:'Pregão Eletrônico', objeto:'Sustentação de sistemas legados (COBOL/Mainframe)', publicado:'2025-07-15', status:'vigente', numero:'NE 0187/2025' },
  { id:'p10', orgao:'Correios', cnpj_fornecedor:'00609634000132', fornecedor:'CI&T', uf:'DF', valor: 7_800_000, vigencia:'2025-2027', modalidade:'Pregão Eletrônico', objeto:'Desenvolvimento React Native para apps corporativos', publicado:'2026-02-02', status:'vigente', numero:'NE 0129/2026' },
  { id:'p11', orgao:'ANTT', cnpj_fornecedor:'61149961000120', fornecedor:'Capgemini Brasil', uf:'DF', valor: 19_200_000, vigencia:'2026-2030', modalidade:'Pregão Eletrônico', objeto:'Migração SAP S/4 e sustentação aplicacional', publicado:'2026-03-14', status:'vigente', numero:'NE 0212/2026' },
  { id:'p12', orgao:'Banco do Brasil', cnpj_fornecedor:'07341657000200', fornecedor:'TIVIT', uf:'DF', valor: 31_500_000, vigencia:'2025-2029', modalidade:'Pregão Eletrônico', objeto:'Serviços gerenciados multicloud AWS/Azure', publicado:'2025-08-21', status:'vigente', numero:'NE 0389/2025' },
];

const ACTIVITIES = [
  { id:'a1', type:'call', title:'Ligação Ana Paula — CTO Stefanini', company:'c1', deal:'d1', owner:'Rafael Marques', when:'2026-04-19T10:30:00', status:'pendente', priority:'alta' },
  { id:'a2', type:'email', title:'Follow-up proposta SERPRO', company:'c8', deal:'d5', owner:'Amanda Costa', when:'2026-04-19T14:00:00', status:'pendente', priority:'alta' },
  { id:'a3', type:'meeting', title:'Kickoff squad AI/ML — TCU', company:'c12', deal:'d6', owner:'Rafael Marques', when:'2026-04-20T09:00:00', status:'pendente', priority:'média' },
  { id:'a4', type:'task', title:'Preparar due dilligence Sonda IT', company:'c6', deal:'d3', owner:'Tiago Alencar', when:'2026-04-21T18:00:00', status:'pendente', priority:'média' },
  { id:'a5', type:'call', title:'Call diretor TI — Dedalus', company:'c4', deal:'d4', owner:'Tiago Alencar', when:'2026-04-18T15:00:00', status:'concluido', priority:'baixa' },
  { id:'a6', type:'email', title:'Enviar portfólio BRQ', company:'c5', deal:'d7', owner:'Tiago Alencar', when:'2026-04-22T11:00:00', status:'pendente', priority:'baixa' },
  { id:'a7', type:'meeting', title:'Visita técnica Capgemini', company:'c7', deal:'d10', owner:'Tiago Alencar', when:'2026-04-24T13:30:00', status:'pendente', priority:'alta' },
];

// Usuários do CRM
const ROLES = {
  master: {
    id:'master', label:'Master', color:'#7c3aed',
    descr:'Acesso total ao sistema. Pode criar/remover admins e alterar configurações críticas.',
    perms: ['Gerenciar usuários e papéis', 'Configurar integrações (PNCP, IA, e-mail)', 'Acessar logs e auditoria', 'Editar/excluir qualquer registro', 'Impersonar outros usuários', 'Configurar billing e plano']
  },
  admin: {
    id:'admin', label:'Admin', color:'#2563eb',
    descr:'Gestão operacional. Administra equipe, metas e acompanha performance.',
    perms: ['Criar/editar usuários comuns', 'Gerenciar pipeline e metas', 'Ver todos os leads e deals', 'Exportar relatórios', 'Editar cadências e automações', 'Aprovar propostas']
  },
  comum: {
    id:'comum', label:'Usuário', color:'#059669',
    descr:'Vendedor / SDR. Trabalha com seus leads e oportunidades.',
    perms: ['Ver e editar leads atribuídos', 'Criar atividades e notas', 'Mover deals no pipeline próprio', 'Chat com Bradata AI', 'Receber leads do PNCP']
  },
};

const USERS = [
  { id:'u1', name:'Rafael Marques', email:'rafael@bradata.com.br', role:'master', status:'ativo', team:'Executivo', createdAt:'2024-01-10', lastSeen:'2026-04-19T11:20:00', deals:6, won:3, revenue: 6_100_000 },
  { id:'u2', name:'Amanda Costa', email:'amanda@bradata.com.br', role:'admin', status:'ativo', team:'Sales', createdAt:'2024-03-15', lastSeen:'2026-04-19T10:45:00', deals:8, won:5, revenue: 9_200_000 },
  { id:'u3', name:'Tiago Alencar', email:'tiago@bradata.com.br', role:'comum', status:'ativo', team:'Sales', createdAt:'2024-07-02', lastSeen:'2026-04-19T09:10:00', deals:4, won:2, revenue: 3_400_000 },
  { id:'u4', name:'Bianca Lima', email:'bianca@bradata.com.br', role:'comum', status:'ativo', team:'SDR', createdAt:'2025-02-20', lastSeen:'2026-04-18T18:30:00', deals:5, won:2, revenue: 2_900_000 },
  { id:'u5', name:'Pedro Henrique Oliveira', email:'pedro.h@bradata.com.br', role:'admin', status:'ativo', team:'Operações', createdAt:'2024-11-05', lastSeen:'2026-04-19T08:55:00', deals:2, won:1, revenue: 1_400_000 },
  { id:'u6', name:'Júlia Ferreira', email:'julia@bradata.com.br', role:'comum', status:'ativo', team:'SDR', createdAt:'2025-09-18', lastSeen:'2026-04-17T16:00:00', deals:3, won:0, revenue: 0 },
  { id:'u7', name:'Marcos Vinicius', email:'marcos.v@bradata.com.br', role:'comum', status:'pendente', team:'Sales', createdAt:'2026-04-12', lastSeen:null, deals:0, won:0, revenue: 0 },
  { id:'u8', name:'Renata Souza', email:'renata@bradata.com.br', role:'comum', status:'inativo', team:'Sales', createdAt:'2024-05-22', lastSeen:'2026-01-30T14:00:00', deals:2, won:1, revenue: 580_000 },
];
const CURRENT_USER = USERS[0]; // Rafael (Master)

// Notifications
const NOTIFICATIONS = [
  { id:'n1', kind:'pncp', title:'Novo contrato PNCP detectado', detail:'TIVIT venceu Pregão R$ 31,5M — Banco do Brasil', when:'2026-04-19T08:12:00', icon:'gov' },
  { id:'n2', kind:'ai', title:'Bradata AI sugere ação', detail:'5 empresas passaram do score 80 — vale abrir cadência', when:'2026-04-19T07:30:00', icon:'sparkle' },
  { id:'n3', kind:'deal', title:'Deal movido para Negociação', detail:'Amanda moveu SERPRO Mainframe — R$ 4,2M', when:'2026-04-18T17:45:00', icon:'kanban' },
  { id:'n4', kind:'alert', title:'Contrato Stefanini expira em 90d', detail:'DATAPREV — renovação sensível R$ 12,4M', when:'2026-04-18T11:00:00', icon:'bell' },
];

window.DATA = { fmt, COMPANIES: COMPANIES_MAP, COMPANY_LIST, STAGES, DEALS, PNCP_CONTRACTS, ACTIVITIES, NOTIFICATIONS, USERS, ROLES, CURRENT_USER };
window.__TWEAK_DEFAULTS__ = /*EDITMODE-BEGIN*/{
  "dashboardVariant": "executive",
  "discoveryVariant": "cards",
  "pipelineLayout": "kanban",
  "cardDetail": "full",
  "accent": "bradata",
  "density": "cozy",
  "radius": "normal"
}/*EDITMODE-END*/;
window.__TWEAKS__ = window.__TWEAK_DEFAULTS__;
