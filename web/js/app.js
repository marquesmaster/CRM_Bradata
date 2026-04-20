const NAV = [
  { id:'dashboard', label:'Dashboard', ico:'dashboard' },
  { id:'pncp', label:'Descoberta PNCP', ico:'radar', badge:'novo' },
  { id:'accounts', label:'Contas', ico:'building' },
  { id:'pipeline', label:'Pipeline', ico:'kanban' },
  { id:'activities', label:'Atividades', ico:'check', count:7 },
  { id:'reports', label:'Relatórios', ico:'chart' },
  { id:'users', label:'Usuários', ico:'users', section:'admin' },
  { id:'settings', label:'Configurações', ico:'settings', section:'admin' },
];

function App() {
  const [route, setRoute] = React.useState(() => localStorage.getItem('bradata-route') || 'dashboard');
  const [selectedLead, setSelectedLead] = React.useState(null);
  const [theme, setTheme] = React.useState(() => localStorage.getItem('bradata-theme') || 'light');
  const [collapsed, setCollapsed] = React.useState(false);
  const [aiOpen, setAiOpen] = React.useState(false);

  React.useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  React.useEffect(() => { localStorage.setItem('bradata-route', route); }, [route]);
  React.useEffect(() => { localStorage.setItem('bradata-theme', theme); }, [theme]);

  window.__nav = (r, leadId) => {
    setRoute(r);
    if (leadId) setSelectedLead(leadId);
  };

  const renderScreen = () => {
    if (route === 'lead') return <LeadDetail companyId={selectedLead} onBack={()=>setRoute('accounts')}/>;
    if (route === 'dashboard') return <Dashboard/>;
    if (route === 'pncp') return <PNCP/>;
    if (route === 'accounts') return <Accounts/>;
    if (route === 'pipeline') return <Pipeline/>;
    if (route === 'activities') return <Activities/>;
    if (route === 'reports') return <Reports/>;
    if (route === 'users') return <Users/>;
    if (route === 'profile') return <Profile/>;
    if (route === 'settings') return <Settings/>;
    return <Dashboard/>;
  };

  const current = NAV.find(n=>n.id===route);
  const CURRENT_USER = window.DATA.CURRENT_USER;

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
            <button key={n.id} className={`nav-item ${route===n.id?'active':''}`} onClick={()=>setRoute(n.id)}
              style={{display:'flex', alignItems:'center', gap:11, padding:'9px 10px', borderRadius:8, color: route===n.id?'white':'hsl(var(--sidebar-fg) / .78)', background: route===n.id?'hsl(0 0% 100% / .08)':'transparent', fontSize:13.5, fontWeight:500, width:'100%', textAlign:'left', position:'relative'}}>
              {React.createElement(I[n.ico], { size: 16 })}
              {!collapsed && <>
                <span style={{flex:1}}>{n.label}</span>
                {n.badge && <span className="chip primary" style={{fontSize:9, padding:'1px 6px'}}>{n.badge}</span>}
                {n.count != null && <span style={{fontSize:10.5, fontWeight:600, padding:'2px 7px', borderRadius:999, background:'hsl(0 0% 100% / .09)'}}>{n.count}</span>}
              </>}
            </button>
          ))}
          {!collapsed && <div style={{padding:'14px 12px 6px', fontSize:9.5, textTransform:'uppercase', letterSpacing:'.08em', color:'hsl(var(--sidebar-muted))', fontWeight:600}}>Administração</div>}
          {NAV.filter(n=>n.section==='admin').map(n => (
            <button key={n.id} className={`nav-item ${route===n.id?'active':''}`} onClick={()=>setRoute(n.id)}
              style={{display:'flex', alignItems:'center', gap:11, padding:'9px 10px', borderRadius:8, color: route===n.id?'white':'hsl(var(--sidebar-fg) / .78)', background: route===n.id?'hsl(0 0% 100% / .08)':'transparent', fontSize:13.5, fontWeight:500, width:'100%', textAlign:'left'}}>
              {React.createElement(I[n.ico], { size: 16 })}
              {!collapsed && <span>{n.label}</span>}
            </button>
          ))}
        </nav>
        <div style={{padding:12, borderTop:'1px solid hsl(0 0% 100% / .06)', display:'flex', alignItems:'center', gap:10, color:'hsl(var(--sidebar-fg))', cursor:'pointer'}} onClick={()=>setRoute('profile')}>
          <UI.Avatar name={CURRENT_USER.name} size={32}/>
          {!collapsed && <>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:12.5, fontWeight:600}}>{CURRENT_USER.name}</div>
              <div style={{fontSize:10.5, color:'hsl(var(--sidebar-muted))'}}>Master · Bradata</div>
            </div>
            <button className="icon-btn" style={{color:'hsl(var(--sidebar-fg) / .6)'}} onClick={(e)=>{e.stopPropagation(); setTheme(theme==='light'?'dark':'light');}}>
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
            <strong style={{fontSize:13}}>{route==='lead' ? 'Detalhe do lead' : route==='profile' ? 'Meu perfil' : current?.label}</strong>
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
            <button className="icon-btn"><I.refresh size={15}/></button>
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

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
