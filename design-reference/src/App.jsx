// Main App Shell — sidebar, topbar, routing, tweaks, toasts
const NAV = [
  { id:'dashboard', label:'Dashboard', ico:'home' },
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
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [tweaksOpen, setTweaksOpen] = React.useState(false);
  const [tweakAvailable, setTweakAvailable] = React.useState(false);
  const [aiOpen, setAiOpen] = React.useState(false);
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);

  const [tweaks, setTweaks] = React.useState(() => window.__TWEAK_DEFAULTS__);
  React.useEffect(() => { window.__TWEAKS__ = tweaks; }, [tweaks]);

  React.useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.accent = tweaks.accent;
    document.documentElement.dataset.density = tweaks.density;
    document.documentElement.dataset.radius = tweaks.radius;
  }, [theme, tweaks]);

  React.useEffect(() => { localStorage.setItem('bradata-route', route); }, [route]);
  React.useEffect(() => { localStorage.setItem('bradata-theme', theme); }, [theme]);

  // Tweaks host protocol
  React.useEffect(() => {
    function onMsg(e) {
      if (e.data?.type === '__activate_edit_mode') setTweaksOpen(true);
      if (e.data?.type === '__deactivate_edit_mode') setTweaksOpen(false);
    }
    window.addEventListener('message', onMsg);
    try { window.parent.postMessage({type:'__edit_mode_available'}, '*'); setTweakAvailable(true); } catch(e){}
    return () => window.removeEventListener('message', onMsg);
  }, []);

  React.useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') { e.preventDefault(); setAiOpen(o => !o); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const updateTweak = (k, v) => {
    setTweaks(t => ({ ...t, [k]: v }));
    try { window.parent.postMessage({type:'__edit_mode_set_keys', edits:{[k]:v}}, '*'); } catch(e){}
  };

  // Global navigation helper
  window.__nav = (r, leadId) => {
    setRoute(r);
    if (leadId) setSelectedLead(leadId);
  };

  const openLead = (id) => { setSelectedLead(id); setRoute('lead'); };

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
  const CURRENT_USER = window.DATA?.CURRENT_USER;
  const ROLES = window.DATA?.ROLES;
  const currentRole = CURRENT_USER && ROLES ? ROLES[CURRENT_USER.role] : null;

  const routeLabel = () => {
    if (route === 'lead') return 'Detalhe do lead';
    if (route === 'profile') return 'Meu perfil';
    return current?.label;
  };

  return (
    <div className={`app-shell ${sidebarCollapsed?'collapsed':''}`}>
      <aside className="sidebar" data-screen-label="Sidebar">
        <div className="sidebar-head">
          <div className="brand">
            <div className="brand-mark">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v18h18"/>
                <path d="M7 14l4-4 3 3 5-6"/>
              </svg>
            </div>
            {!sidebarCollapsed && <div>
              <div className="brand-name">Bradata</div>
              <div className="brand-sub">CRM · Bodyshop</div>
            </div>}
          </div>
          <button className="icon-btn" onClick={()=>setSidebarCollapsed(!sidebarCollapsed)}>
            <I.chevron size={14} style={{transform: sidebarCollapsed?'rotate(0deg)':'rotate(180deg)', transition:'.2s'}}/>
          </button>
        </div>

        {!sidebarCollapsed && (
          <div className="sidebar-search">
            <I.search size={13}/>
            <input placeholder="Buscar no CRM…"/>
            <kbd>⌘K</kbd>
          </div>
        )}

        <nav className="sidebar-nav">
          {NAV.filter(n=>!n.section).map(n => (
            <button
              key={n.id}
              className={`nav-item ${route===n.id?'active':''}`}
              onClick={()=>setRoute(n.id)}
              title={sidebarCollapsed ? n.label : undefined}
            >
              {React.createElement(I[n.ico], { size: 16 })}
              {!sidebarCollapsed && <>
                <span className="nav-label">{n.label}</span>
                {n.badge && <span className="chip primary" style={{fontSize:9, padding:'1px 6px'}}>{n.badge}</span>}
                {n.count != null && <span className="nav-count">{n.count}</span>}
              </>}
            </button>
          ))}
          {!sidebarCollapsed && <div className="nav-section-label">Administração</div>}
          {sidebarCollapsed && <div style={{height:1, background:'hsl(var(--border))', margin:'10px 12px'}}/>}
          {NAV.filter(n=>n.section==='admin').map(n => (
            <button
              key={n.id}
              className={`nav-item ${route===n.id?'active':''}`}
              onClick={()=>setRoute(n.id)}
              title={sidebarCollapsed ? n.label : undefined}
            >
              {React.createElement(I[n.ico], { size: 16 })}
              {!sidebarCollapsed && <span className="nav-label">{n.label}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-foot">
          {!sidebarCollapsed && (
            <div className="quota-card">
              <div className="row-between" style={{fontSize:11, marginBottom:6}}>
                <strong>Uso da API PNCP</strong>
                <span className="mono">64%</span>
              </div>
              <div className="progress" style={{height:4}}><span style={{width:'64%'}}/></div>
              <div className="muted" style={{fontSize:10.5, marginTop:6}}>3.200 / 5.000 requisições hoje</div>
            </div>
          )}
          <div className="sidebar-user" onClick={()=>!sidebarCollapsed && setRoute('profile')} style={{cursor: sidebarCollapsed?'default':'pointer'}}>
            <UI.Avatar name="Rafael Marques" size={32}/>
            {!sidebarCollapsed && <>
              <div style={{flex:1, minWidth:0}}>
                <div style={{fontSize:12.5, fontWeight:600}}>Rafael Marques</div>
                <div className="muted" style={{fontSize:10.5}}>Master · Bradata</div>
              </div>
              <button className="icon-btn" onClick={(e)=>{e.stopPropagation(); setTheme(theme==='light'?'dark':'light');}} title="Alternar tema">
                {theme==='light' ? <I.moon size={14}/> : <I.sun size={14}/>}
              </button>
            </>}
          </div>
        </div>
      </aside>

      <div className="main-wrap">
        <header className="topbar">
          <div className="row" style={{gap:10, alignItems:'center'}}>
            <div className="breadcrumb">
              <span className="muted" style={{fontSize:12}}>Bradata CRM</span>
              <I.chevron size={10} className="faint"/>
              <strong style={{fontSize:13}}>{route==='lead' ? 'Detalhe do lead' : route==='profile' ? 'Meu perfil' : current?.label}</strong>
            </div>
          </div>
          <div className="row" style={{gap:4}}>
            <button
              className={`btn btn-sm ${aiOpen?'btn-accent':'btn-ai'}`}
              onClick={()=>setAiOpen(!aiOpen)}
              style={{gap:6}}
            >
              <span className="ai-dot"><I.sparkle size={11}/></span>
              Bradata AI
              <kbd style={{fontSize:10, padding:'1px 5px', background:'hsl(var(--surface-3))', borderRadius:4, marginLeft:2}}>⌘/</kbd>
            </button>
            <div style={{width:1, height:20, background:'hsl(var(--border))', margin:'0 4px'}}/>
            <button className="icon-btn" title="Atualizar"><I.refresh size={15}/></button>
            <button className="icon-btn" title="Notificações" style={{position:'relative'}}>
              <I.bell size={15}/>
              <span style={{position:'absolute', top:6, right:6, width:7, height:7, borderRadius:'50%', background:'hsl(var(--danger))'}}/>
            </button>
            <button className="btn btn-sm btn-ghost"><I.help size={13}/>Ajuda</button>
            {tweakAvailable && <button className={`btn btn-sm ${tweaksOpen?'btn-accent':'btn-ghost'}`} onClick={()=>setTweaksOpen(!tweaksOpen)}>
              <I.sliders size={12}/>Tweaks
            </button>}
            {CURRENT_USER && (
              <div style={{position:'relative', marginLeft:4}}>
                <button className="user-chip" onClick={()=>setUserMenuOpen(!userMenuOpen)}>
                  <UI.Avatar name={CURRENT_USER.name} size={26}/>
                  <div style={{textAlign:'left', lineHeight:1.15}}>
                    <div style={{fontSize:12, fontWeight:600}}>{CURRENT_USER.name.split(' ')[0]}</div>
                    {currentRole && <div style={{fontSize:10, color: currentRole.color, fontWeight:600}}>{currentRole.label}</div>}
                  </div>
                  <I.chevron size={10} style={{transform:'rotate(90deg)', color:'hsl(var(--fg-faint))'}}/>
                </button>
                {userMenuOpen && (
                  <>
                    <div style={{position:'fixed', inset:0, zIndex:40}} onClick={()=>setUserMenuOpen(false)}/>
                    <div className="user-menu">
                      <div style={{padding:'12px 14px', borderBottom:'1px solid hsl(var(--border))'}}>
                        <div className="row" style={{gap:10}}>
                          <UI.Avatar name={CURRENT_USER.name} size={36}/>
                          <div>
                            <div style={{fontSize:13, fontWeight:700}}>{CURRENT_USER.name}</div>
                            <div className="muted" style={{fontSize:11}}>{CURRENT_USER.email}</div>
                          </div>
                        </div>
                      </div>
                      <button className="user-menu-item" onClick={()=>{setRoute('profile'); setUserMenuOpen(false);}}>
                        <I.users size={14}/>Meu perfil
                      </button>
                      <button className="user-menu-item" onClick={()=>{setRoute('users'); setUserMenuOpen(false);}}>
                        <I.target size={14}/>Gerenciar usuários
                      </button>
                      <button className="user-menu-item" onClick={()=>{setRoute('settings'); setUserMenuOpen(false);}}>
                        <I.settings size={14}/>Configurações
                      </button>
                      <button className="user-menu-item" onClick={()=>{setTheme(theme==='light'?'dark':'light'); setUserMenuOpen(false);}}>
                        {theme==='light' ? <I.moon size={14}/> : <I.sun size={14}/>}
                        Tema {theme==='light'?'escuro':'claro'}
                      </button>
                      <div style={{borderTop:'1px solid hsl(var(--border))', margin:'4px 0'}}/>
                      <button className="user-menu-item" style={{color:'hsl(var(--danger))'}}>
                        <I.close size={14}/>Sair
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </header>
        <main className="main-content" data-screen-label={route==='lead'?'Lead Detail':current?.label}>
          <LeadContext.Provider value={{ openLead }}>
            {renderScreen()}
          </LeadContext.Provider>
        </main>
      </div>

      <AIChat externalOpen={aiOpen} onClose={()=>setAiOpen(false)} hideFab={true}/>
      {tweaksOpen && <TweaksPanel tweaks={tweaks} setTweak={updateTweak} onClose={()=>setTweaksOpen(false)} theme={theme} setTheme={setTheme}/>}
    </div>
  );
}

const LeadContext = React.createContext({});

function TweaksPanel({ tweaks, setTweak, onClose, theme, setTheme }) {
  return (
    <div className="tweaks-panel">
      <div className="tweaks-head">
        <strong>Tweaks</strong>
        <button className="icon-btn" onClick={onClose}><I.x size={14}/></button>
      </div>
      <div className="tweaks-body">
        <TweakGroup label="Dashboard">
          <TweakRadio label="Layout" value={tweaks.dashboardVariant} onChange={v=>setTweak('dashboardVariant', v)} options={[
            {v:'executive', l:'Executive'}, {v:'pulse', l:'Pulse (real-time)'}, {v:'operator', l:'Operator (denso)'}
          ]}/>
        </TweakGroup>
        <TweakGroup label="Descoberta PNCP">
          <TweakRadio label="Apresentação" value={tweaks.discoveryVariant} onChange={v=>setTweak('discoveryVariant', v)} options={[
            {v:'cards', l:'Cards'}, {v:'table', l:'Tabela'}, {v:'radar', l:'Radar por órgão'}
          ]}/>
        </TweakGroup>
        <TweakGroup label="Pipeline">
          <TweakRadio label="Layout" value={tweaks.pipelineLayout} onChange={v=>setTweak('pipelineLayout', v)} options={[
            {v:'kanban', l:'Kanban'}, {v:'list', l:'Lista'}, {v:'timeline', l:'Timeline'}
          ]}/>
          <TweakRadio label="Densidade do card" value={tweaks.cardDetail} onChange={v=>setTweak('cardDetail', v)} options={[
            {v:'full', l:'Completo'}, {v:'compact', l:'Compacto'}
          ]}/>
        </TweakGroup>
        <TweakGroup label="Aparência">
          <TweakRadio label="Tema" value={theme} onChange={v=>setTheme(v)} options={[
            {v:'light', l:'Claro'}, {v:'dark', l:'Escuro'}
          ]}/>
          <TweakSwatches label="Cor de destaque" value={tweaks.accent} onChange={v=>setTweak('accent', v)} options={[
            {v:'indigo', c:'#4F46E5'}, {v:'violet', c:'#7C3AED'}, {v:'emerald', c:'#059669'}, {v:'amber', c:'#D97706'}, {v:'rose', c:'#E11D48'}
          ]}/>
          <TweakRadio label="Densidade" value={tweaks.density} onChange={v=>setTweak('density', v)} options={[
            {v:'comfy', l:'Confortável'}, {v:'cozy', l:'Padrão'}, {v:'compact', l:'Compacto'}
          ]}/>
          <TweakRadio label="Raio" value={tweaks.radius} onChange={v=>setTweak('radius', v)} options={[
            {v:'sharp', l:'Afiado'}, {v:'normal', l:'Normal'}, {v:'rounded', l:'Arredondado'}
          ]}/>
        </TweakGroup>
      </div>
    </div>
  );
}

function TweakGroup({ label, children }) {
  return (
    <div className="tweak-group">
      <div className="tweak-group-label">{label}</div>
      {children}
    </div>
  );
}
function TweakRadio({ label, value, onChange, options }) {
  return (
    <div className="tweak-row">
      <div className="tweak-label">{label}</div>
      <div className="tweak-radio">
        {options.map(o => (
          <button key={o.v} className={value===o.v?'active':''} onClick={()=>onChange(o.v)}>{o.l}</button>
        ))}
      </div>
    </div>
  );
}
function TweakSwatches({ label, value, onChange, options }) {
  return (
    <div className="tweak-row">
      <div className="tweak-label">{label}</div>
      <div className="tweak-swatches">
        {options.map(o => (
          <button key={o.v} className={value===o.v?'active':''} onClick={()=>onChange(o.v)} style={{background:o.c}} title={o.v}/>
        ))}
      </div>
    </div>
  );
}

window.App = App;

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
