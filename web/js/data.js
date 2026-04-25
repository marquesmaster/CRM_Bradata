// API client + loaders + formatters.
// window.DATA é populado por loadAll() que faz fetch autenticado à API.
// Se o usuário não estiver logado, window.DATA fica com um mock mínimo pra
// UI não quebrar. A tela de login popula o JWT e recarrega.

(function () {
  const TOKEN_KEY = 'bradata-crm-token';
  const USER_KEY = 'bradata-crm-user';
  const API_PREFIX = '/api/v1';

  // ================== auth ==================
  const auth = {
    token: () => localStorage.getItem(TOKEN_KEY),
    user: () => {
      try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); }
      catch { return null; }
    },
    setSession: (token, user) => {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    },
    clear: () => {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    },
    isAuthed: () => !!localStorage.getItem(TOKEN_KEY),
  };

  async function api(path, opts = {}) {
    const token = auth.token();
    const isJsonBody = opts.body && (
      typeof opts.body === 'object' ||
      (typeof opts.body === 'string' && /^\s*[{\[]/.test(opts.body))
    );
    const headers = {
      'Accept': 'application/json',
      ...(isJsonBody ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    };
    const body = opts.body && typeof opts.body === 'object'
      ? JSON.stringify(opts.body)
      : opts.body;
    const r = await fetch(API_PREFIX + path, { ...opts, headers, body });
    if (r.status === 401) {
      auth.clear();
      location.reload();
      return;
    }
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      throw new Error(`${r.status} ${path}: ${text.slice(0, 200)}`);
    }
    if (r.status === 204) return null;
    const ct = r.headers.get('content-type') || '';
    return ct.includes('application/json') ? r.json() : r.text();
  }

  async function login(email, senha) {
    const r = await fetch(API_PREFIX + '/auth/login-json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha }),
    });
    if (!r.ok) throw new Error('Credenciais inválidas');
    const data = await r.json();
    auth.setSession(data.access_token, data.user);
    return data.user;
  }

  // ================== formatters ==================
  const fmt = {
    brl: (v) => v == null ? '—' :
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(+v),
    brlK: (v) => {
      if (v == null || v === 0) return v === 0 ? 'R$ 0' : '—';
      const n = +v;
      if (Math.abs(n) >= 1e9) return 'R$ ' + (n / 1e9).toFixed(1) + 'Bi';
      if (Math.abs(n) >= 1e6) return 'R$ ' + (n / 1e6).toFixed(1) + 'MM';
      if (Math.abs(n) >= 1e3) return 'R$ ' + (n / 1e3).toFixed(0) + 'k';
      return 'R$ ' + n.toFixed(0);
    },
    num: (v) => v == null ? '—' : new Intl.NumberFormat('pt-BR').format(+v),
    cnpj: (c) => {
      if (!c) return '';
      const d = String(c).replace(/\D/g, '').padStart(14, '0');
      return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12,14)}`;
    },
    date: (s) => {
      if (!s) return '—';
      try { return new Date(s).toLocaleDateString('pt-BR'); } catch { return s; }
    },
    relative: (s) => {
      if (!s) return '—';
      const ms = Date.now() - new Date(s).getTime();
      const min = Math.floor(ms / 60000);
      if (min < 1) return 'agora';
      if (min < 60) return `há ${min} min`;
      const h = Math.floor(min / 60);
      if (h < 24) return `há ${h}h`;
      const d = Math.floor(h / 24);
      if (d < 30) return `há ${d}d`;
      return new Date(s).toLocaleDateString('pt-BR');
    },
  };

  // ================== static config ==================
  const ROLES = {
    master:  { id: 'master', label: 'Master', color: '#7C3AED', descr: 'Acesso total.', perms: ['Gerenciar todos usuários', 'Configurar integrações', 'Acesso a billing'] },
    admin:   { id: 'admin', label: 'Admin', color: '#0EA5E9', descr: 'Gestor da operação.', perms: ['Gerenciar usuários comuns', 'Configurar pipelines', 'Ver todos relatórios'] },
    gestor:  { id: 'gestor', label: 'Gestor', color: '#0EA5E9', descr: 'Líder de time.', perms: ['Ver time completo', 'Aprovar oportunidades', 'Editar empresas'] },
    bdr:     { id: 'bdr', label: 'BDR', color: '#10B981', descr: 'Prospecção e qualificação.', perms: ['Ver leads', 'Criar leads', 'Criar atividades'] },
    vendedor:{ id: 'vendedor', label: 'Vendedor', color: '#F59E0B', descr: 'Venda e fechamento.', perms: ['Gerenciar oportunidades', 'Editar empresas'] },
    leitor:  { id: 'leitor', label: 'Leitor', color: '#6B7280', descr: 'Somente leitura.', perms: ['Ver dashboards'] },
    comum:   { id: 'comum', label: 'Usuário', color: '#10B981', descr: 'Usuário padrão.', perms: ['Ver leads', 'Criar atividades'] },
  };

  const STAGE_COLORS = {
    'Prospecção': '#3B82F6',
    'Qualificação': '#06B6D4',
    'Descoberta / Diagnóstico': '#8B5CF6',
    'Proposta': '#F59E0B',
    'Negociação': '#EF6C00',
    'Ganho': '#10B981',
    'Perda': '#EF4444',
  };

  // ================== loaders ==================
  async function loadAll() {
    const [me, empresasPage, contratosPage, dealsPage, activitiesPage, pipelines, users] = await Promise.all([
      api('/users/me'),
      api('/empresas?size=200').catch(() => ({ items: [] })),
      api('/pncp/contratos?size=30').catch(() => ({ items: [] })),
      api('/oportunidades?size=200').catch(() => ({ items: [] })),
      api('/atividades?size=100').catch(() => ({ items: [] })),
      api('/pipelines').catch(() => []),
      api('/users').catch(() => []),
    ]);

    const pipeline = (pipelines && pipelines[0]) || { estagios: [] };
    const STAGES = (pipeline.estagios || [])
      .slice()
      .sort((a, b) => a.ordem - b.ordem)
      .map(e => ({
        id: String(e.id),
        label: e.nome,
        color: e.color || STAGE_COLORS[e.nome] || '#6B7280',
        ordem: e.ordem,
        is_ganho: e.is_ganho,
        is_perda: e.is_perda,
      }));
    if (STAGES.length === 0) {
      ['Prospecção','Qualificação','Proposta','Negociação','Ganho'].forEach((l, i) =>
        STAGES.push({ id: 's' + i, label: l, color: STAGE_COLORS[l] || '#6B7280', ordem: i+1 }));
    }

    const COMPANY_LIST = (empresasPage.items || []).map(e => ({
      id: String(e.id),
      name: e.razao_social || e.nome_fantasia || e.cnpj,
      cnpj: e.cnpj,
      website: e.website || '',
      city: e.municipio || '',
      uf: e.uf || '',
      sector: e.sector || e.cnae_principal_descricao || '—',
      revenue: e.faturamento_estimado || 0,
      employees: e.num_funcionarios || 0,
      contractsPncp: e.contracts_pncp || 0,
      ativosGov: e.ativos_gov || 0,
      ticketMedio: e.ticket_medio || 0,
      stack: e.stack || [],
      contactsN: e.contatos_n || 0,
      score: e.icp_score || 0,
      status: e.status || 'prospect',
      // Campos computed do backend para tela Fornecedores
      totalContratos: e.contracts_pncp || 0,
      valorTotalContratos: e.valor_total_contratos || 0,
      classificacao: e.classificacao_valor || 'baixo',
      faixa_faturamento: e.faixa_faturamento || null,
    }));
    const COMPANIES = {};
    COMPANY_LIST.forEach(c => { COMPANIES[c.id] = c; });

    const PNCP_CONTRACTS = (contratosPage.items || []).map(p => ({
      id: String(p.id),
      numero: p.numero_controle_pncp,
      orgao: p.orgao_nome,
      orgao_cnpj: p.orgao_cnpj,
      objeto: p.descricao || p.titulo || '',
      valor: p.valor_global || 0,
      modalidade: p.modalidade_licitacao_nome || '—',
      publicado: p.data_publicacao_pncp || p.data_assinatura,
      vigencia: p.data_fim_vigencia ? fmt.date(p.data_fim_vigencia) : '—',
      cnpj_fornecedor: '',
      fornecedor: '',
      uf: p.uf,
    }));

    const userById = {};
    (users || []).forEach(u => { userById[u.id] = u; });

    const DEALS = (dealsPage.items || []).map(d => ({
      id: String(d.id),
      title: d.titulo,
      company: String(d.empresa_id),
      stage: String(d.estagio_id),
      value: d.valor_estimado || 0,
      prob: d.probabilidade || 0,
      closeDate: d.data_fechamento_prevista,
      owner: (userById[d.owner_id]?.nome) || '—',
      tags: d.tags || [],
    }));

    const ACTIVITIES = (activitiesPage.items || []).map(a => ({
      id: String(a.id),
      title: a.titulo,
      type: a.tipo,
      status: a.status,
      priority: a.prioridade,
      owner: (userById[a.user_id]?.nome) || '—',
      when: a.due_date || a.data_atividade || a.created_at,
    }));

    const USERS = (users || []).map(u => ({
      id: String(u.id),
      name: u.nome,
      email: u.email,
      role: u.role,
      team: u.team || '',
      status: u.status || (u.is_active ? 'ativo' : 'inativo'),
      createdAt: u.created_at,
      lastSeen: u.last_seen_at,
      deals: 0, won: 0, revenue: 0,
    }));

    const CURRENT_USER = {
      id: String(me.id),
      name: me.nome,
      email: me.email,
      role: me.role,
      team: me.team || 'Bradata',
      status: me.status,
      createdAt: me.created_at,
      deals: 0, won: 0, revenue: 0,
    };
    try {
      const stats = await api('/users/me/stats');
      if (stats) Object.assign(CURRENT_USER, { deals: stats.deals, won: stats.won, revenue: stats.revenue });
    } catch { /* sem stats se ainda não tem deals */ }

    return {
      fmt, ROLES,
      CURRENT_USER, USERS,
      COMPANY_LIST, COMPANIES,
      DEALS, STAGES,
      ACTIVITIES,
      PNCP_CONTRACTS,
      NOTIFICATIONS: [],
      _pipeline: pipeline,
    };
  }

  async function refresh() {
    window.DATA = await loadAll();
    if (typeof window.__onDataRefresh === 'function') window.__onDataRefresh();
    return window.DATA;
  }

  // Mock mínimo — só pra antes do login ou se a API cair
  const MOCK = {
    fmt, ROLES,
    CURRENT_USER: { id: '0', name: '—', email: '—', role: 'leitor', team: '—', createdAt: new Date().toISOString(), deals: 0, won: 0, revenue: 0 },
    USERS: [],
    COMPANY_LIST: [], COMPANIES: {},
    DEALS: [],
    STAGES: [
      { id: 'prospect',     label: 'Prospecção',  color: '#3B82F6' },
      { id: 'qualificacao', label: 'Qualificação', color: '#06B6D4' },
      { id: 'proposta',     label: 'Proposta',     color: '#F59E0B' },
      { id: 'negociacao',   label: 'Negociação',   color: '#EF6C00' },
      { id: 'ganho',        label: 'Ganho',        color: '#10B981' },
    ],
    ACTIVITIES: [],
    PNCP_CONTRACTS: [],
    NOTIFICATIONS: [],
  };

  window.DATA = MOCK;
  window.API = { auth, api, login, refresh, loadAll };
})();
