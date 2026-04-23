// Main App shell — bootstrap auth + roteamento + shell
const NAV = [
  { id:'dashboard',   label:'Dashboard',    ico:'dashboard' },
  { id:'execucoes',   label:'Execuções',    ico:'refresh',  badge:'ao vivo' },
  { id:'pncp',        label:'Descoberta PNCP', ico:'radar', badge:'novo' },
  { id:'contratos',   label:'Contratos',    ico:'doc' },
  { id:'accounts',    label:'Contas',       ico:'building' },
  { id:'prospeccao',  label:'Prospecção',   ico:'target' },
  { id:'deals',       label:'Deals',        ico:'money' },
  { id:'pipeline',    label:'Pipeline',     ico:'kanban' },
  { id:'propostas',   label:'Propostas',    ico:'doc' },
  { id:'activities',  label:'Atividades',   ico:'check' },
  { id:'agenda',      label:'Agenda',       ico:'calendar' },
  { id:'reports',     label:'Relatórios',   ico:'chart' },
  { id:'automacoes',  label:'Automações',   ico:'zap',      section:'admin' },
  { id:'users',       label:'Usuários',     ico:'users',    section:'admin' },
  { id:'settings',    label:'Configurações',ico:'settings', section:'admin' },
];

function Boot() {
  const [authed, setAuthed] = React.useState(() => window.API.auth.isAuthed());
  const [loading, setLoading] = React.useState(authed);
  const [error, setError] = React.useState(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    if (!authed) { setLoading(false); setReady(true); return; }
    setLoading(true);
    window.API.refresh()
      .then(() => { setReady(true); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); setReady(true); });
  }, [authed]);

  if (!authed) return <LoginScreen onLoggedIn={() => setAuthed(true)}/>;

  if (loading || !ready) {
    return (
      <div style={{minHeight:'100vh', display:'grid', placeItems:'center', background:'hsl(var(--bg))'}}>
        <div style={{textAlign:'center'}}>
          <div style={{width:40, height:40, borderRadius:'50%', border:'3px solid hsl(var(--border))', borderTopColor:'hsl(var(--b-accent))', animation:'spin 0.8s linear infinite', margin:'0 auto 12px'}}/>
          <div style={{fontSize:13, color:'hsl(var(--fg-muted))'}}>Carregando CRM…</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{minHeight:'100vh', display:'grid', placeItems:'center', background:'hsl(var(--bg))', padding:20}}>
        <div style={{maxWidth:480, textAlign:'center'}}>
          <h2 style={{fontSize:18, marginBottom:8}}>Não foi possível carregar os dados</h2>
          <p style={{color:'hsl(var(--fg-muted))', fontSize:13, marginBottom:20}}>{error}</p>
          <button className="btn btn-ghost" onClick={() => location.reload()}>Tentar novamente</button>
          <button className="btn btn-ghost" style={{marginLeft:8}} onClick={() => { window.API.auth.clear(); location.reload(); }}>Sair</button>
        </div>
      </div>
    );
  }

  return <App onLogout={() => { window.API.auth.clear(); setAuthed(false); }}/>;
}

function App({ onLogout }) {
  const [route, setRoute] = React.useState(() => localStorage.getItem('bradata-route') || 'dashboard');
  const [params, setParams] = React.useState({});
  const [theme, setTheme] = React.useState(() => localStorage.getItem('bradata-theme') || 'light');
  const [collapsed, setCollapsed] = React.useState(false);
  const [aiOpen, setAiOpen] = React.useState(false);
  const [, forceUpdate] = React.useReducer(x => x + 1, 0);

  React.useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  React.useEffect(() => { localStorage.setItem('bradata-route', route); }, [route]);
  React.useEffect(() => { localStorage.setItem('bradata-theme', theme); }, [theme]);

  React.useEffect(() => {
    window.__onDataRefresh = () => forceUpdate();
    return () => { window.__onDataRefresh = null; };
  }, []);

  // Roteador simples: window.__nav(route, arg) ou window.__nav(route, {param: value})
  window.__nav = (r, arg) => {
    setRoute(r);
    if (arg == null) { setParams({}); }
    else if (typeof arg === 'object') { setParams(arg); }
    else {
      const paramName =
        r === 'lead'           ? 'companyId'
      : r === 'contrato'       ? 'contratoId'
      : r === 'prospeccaoDetail' ? 'leadId'
      : r === 'proposta'       ? 'propostaId'
      : r === 'historico'      ? 'cnpjOrId'
      : r === 'propostas'      ? 'dealId'
      : 'id';
      setParams({ [paramName]: arg });
    }
  };

  const reload = () => { window.API.refresh().catch(err => console.error(err)); };

  const renderScreen = () => {
    switch (route) {
      case 'dashboard':         return <Dashboard/>;
      case 'execucoes':         return <Execucoes/>;
      case 'pncp':              return <PNCP/>;
      case 'contratos':         return <Contratos/>;
      case 'contrato':          return <ContratoDetail contratoId={params.contratoId} onBack={()=>setRoute('contratos')}/>;
      case 'accounts':          return <Accounts/>;
      case 'prospeccao':        return <Prospeccao/>;
      case 'prospeccaoDetail':  return <ProspeccaoDetail leadId={params.leadId} onBack={()=>setRoute('prospeccao')}/>;
      case 'deals':             return <Deals/>;
      case 'pipeline':          return <Pipeline/>;
      case 'propostas':         return <Propostas dealId={params.dealId}/>;
      case 'proposta':          return <PropostaDetail propostaId={params.propostaId} onBack={()=>setRoute('propostas')}/>;
      case 'activities':        return <Activities/>;
      case 'agenda':            return <Agenda/>;
      case 'reports':           return <Reports/>;
      case 'automacoes':        return <Automacoes/>;
      case 'users':             return <Users/>;
      case 'profile':           return <Profile/>;
      case 'settings':          return <Settings/>;
      case 'lead':              return <LeadDetail companyId={params.companyId} onBack={()=>setRoute('accounts')}/>;
      case 'historico':         return <Historico cnpjOrId={params.cnpjOrId} onBack={()=>setRoute('accounts')}/>;
      default:                  return <NotFound onHome={()=>setRoute('dashboard')}/>;
    }
  };

  const current = NAV.find(n => n.id === route);
  const CURRENT_USER = window.DATA.CURRENT_USER;
  const role = window.DATA.ROLES[CURRENT_USER.role] || {};

  const pageTitle =
    route === 'lead' ? 'Detalhe da empresa'
  : route === 'contrato' ? 'Detalhe do contrato'
  : route === 'prospeccaoDetail' ? 'Detalhe do lead'
  : route === 'proposta' ? 'Detalhe da proposta'
  : route === 'historico' ? 'Histórico 360°'
  : route === 'profile' ? 'Meu perfil'
  : (current?.label || 'Bradata CRM');

  return (
    <div className="app-shell" data-collapsed={collapsed ? "true" : "false"}>
      <aside className="sidebar">
        <div className="sidebar-head" style={{padding:'18px 18px', display:'flex', alignItems:'center', gap:10, borderBottom:'1px solid hsl(0 0% 100% / .06)'}}>
          <div className="brand-mark" style={{width:34, height:34, borderRadius:9, background:'linear-gradient(135deg, hsl(var(--b-accent)), hsl(var(--b-accent-light)))', display:'grid', placeItems:'center', color:'white', flex:'0 0 auto', boxShadow:'0 6px 14px -4px hsl(var(--b-accent) / .5)'}}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></svg>
          </div>
          {!collapsed && <div style={{flex:1}}>
            <div style={{fontWeight:700, fontSize:15, color:'hsl(var(--sidebar-fg))', lineHeight:1.15}}>Bradata</div>
            <div style={{fontSize:10, color:'hsl(var(--sidebar-muted))', textTransform:'uppercase', letterSpacing:'.04em'}}>CRM · Bodyshop</div>
          </div>}
          <button className="icon-btn" style={{color:'hsl(var(--sidebar-fg) / .7)'}} onClick={()=>setCollapsed(!collapsed)}>
            <I.chevron size={14} style={{transform: collapsed?'rotate(0deg)':'rotate(180deg)', transition:'.2s'}}/>
          </button>
        </div>
        <nav style={{flex:1, overflowY:'auto', padding:'14px 12px', display:'flex', flexDirection:'column', gap:2}}>
          {NAV.filter(n=>!n.section).map(n => (
            <button key={n.id} className={`nav-item ${route===n.id?'active':''}`} onClick={()=>window.__nav(n.id)}
              style={{display:'flex', alignItems:'center', gap:11, padding:'9px 10px', borderRadius:8, color: route===n.id?'white':'hsl(var(--sidebar-fg) / .78)', background: route===n.id?'hsl(0 0% 100% / .08)':'transparent', fontSize:13.5, fontWeight:500, width:'100%', textAlign:'left', position:'relative'}}>
              {React.createElement(I[n.ico] || I.dashboard, { size: 16 })}
              {!collapsed && <>
                <span style={{flex:1}}>{n.label}</span>
                {n.badge && <span className="chip primary" style={{fontSize:9, padding:'1px 6px'}}>{n.badge}</span>}
              </>}
            </button>
          ))}
          {!collapsed && <div style={{padding:'14px 12px 6px', fontSize:9.5, textTransform:'uppercase', letterSpacing:'.08em', color:'hsl(var(--sidebar-muted))', fontWeight:600}}>Administração</div>}
          {NAV.filter(n=>n.section==='admin').map(n => (
            <button key={n.id} className={`nav-item ${route===n.id?'active':''}`} onClick={()=>window.__nav(n.id)}
              style={{display:'flex', alignItems:'center', gap:11, padding:'9px 10px', borderRadius:8, color: route===n.id?'white':'hsl(var(--sidebar-fg) / .78)', background: route===n.id?'hsl(0 0% 100% / .08)':'transparent', fontSize:13.5, fontWeight:500, width:'100%', textAlign:'left'}}>
              {React.createElement(I[n.ico] || I.settings, { size: 16 })}
              {!collapsed && <span>{n.label}</span>}
            </button>
          ))}
        </nav>
        <div style={{padding:12, borderTop:'1px solid hsl(0 0% 100% / .06)', display:'flex', alignItems:'center', gap:10, color:'hsl(var(--sidebar-fg))', cursor:'pointer'}} onClick={()=>window.__nav('profile')}>
          <UI.Avatar name={CURRENT_USER.name} size={32}/>
          {!collapsed && <>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:12.5, fontWeight:600}}>{CURRENT_USER.name}</div>
              <div style={{fontSize:10.5, color:'hsl(var(--sidebar-muted))'}}>{role.label || CURRENT_USER.role} · {CURRENT_USER.team || 'Bradata'}</div>
            </div>
            <button className="icon-btn" style={{color:'hsl(var(--sidebar-fg) / .6)'}} onClick={(e)=>{e.stopPropagation(); setTheme(theme==='light'?'dark':'light');}} title="Alternar tema">
              {theme==='light' ? <I.moon size={14}/> : <I.sun size={14}/>}
            </button>
          </>}
        </div>
      </aside>
      <div className="main-wrap">
        <header className="topbar">
          <div className="row" style={{gap:10}}>
            <span className="muted" style={{fontSize:12}}>Bradata CRM</span>
            <I.chevron size={10} className="faint"/>
            <strong style={{fontSize:13}}>{pageTitle}</strong>
          </div>
          <div className="row" style={{gap:4}}>
            <button className="btn btn-sm" onClick={()=>setAiOpen(!aiOpen)} style={{background:'linear-gradient(135deg, hsl(var(--b-accent) / .10), hsl(var(--b-accent-light) / .12))', color:'hsl(var(--b-accent))', border:'1px solid hsl(var(--b-accent) / .28)', fontWeight:600, gap:6}}>
              <span style={{width:18, height:18, borderRadius:'50%', background:'linear-gradient(135deg, hsl(var(--b-accent)), hsl(var(--b-accent-light)))', color:'white', display:'grid', placeItems:'center'}}><I.sparkle size={11}/></span>
              Bradata AI
            </button>
            <button className="icon-btn" title="Notificações" style={{position:'relative'}}>
              <I.bell size={15}/>
              <span style={{position:'absolute', top:6, right:6, width:7, height:7, borderRadius:'50%', background:'hsl(var(--danger))'}}/>
            </button>
            <button className="icon-btn" title="Recarregar dados" onClick={reload}><I.refresh size={15}/></button>
            <button className="icon-btn" title="Sair" onClick={onLogout} style={{color:'hsl(var(--danger))'}}>
              <I.close size={15}/>
            </button>
          </div>
        </header>
        <main className="main-content">
          {renderScreen()}
        </main>
      </div>
      <AIChat externalOpen={aiOpen} onClose={()=>setAiOpen(false)}/>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Boot/>);
