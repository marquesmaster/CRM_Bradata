function Settings() {
  return (
    <>
      <div className="page-head"><h1 className="page-title">Configurações</h1></div>
      <div className="grid-2">
        <div className="card">
          <div className="card-head"><div className="card-title">Integração PNCP</div><span className="chip success"><I.check size={10}/>Ativa</span></div>
          <div className="card-p">
            <div className="setting-row"><div><strong>Endpoint API</strong><div className="muted" style={{fontSize:11.5}}>pncp.gov.br/api</div></div><span className="chip">v1</span></div>
            <div className="setting-row"><div><strong>Frequência de sync</strong><div className="muted" style={{fontSize:11.5}}>Diário 03h</div></div><button className="btn btn-xs btn-ghost">Alterar</button></div>
            <div className="setting-row"><div><strong>Última sync</strong><div className="muted" style={{fontSize:11.5}}>—</div></div><button className="btn btn-xs btn-ghost"><I.refresh size={10}/>Agora</button></div>
            <div className="setting-row" style={{borderBottom:'none'}}><div><strong>Filtros ativos</strong><div className="muted" style={{fontSize:11.5}}>Bodyshop · todas UFs</div></div><button className="btn btn-xs btn-ghost">Editar</button></div>
          </div>
        </div>
        <div className="card">
          <div className="card-head"><div className="card-title">Bradata AI</div><span className="chip primary"><I.sparkle size={10}/>DeepSeek</span></div>
          <div className="card-p">
            <div className="setting-row"><div><strong>Classificação automática</strong><div className="muted" style={{fontSize:11.5}}>É contrato de bodyshop?</div></div><Toggle on={true}/></div>
            <div className="setting-row"><div><strong>Enriquecimento de contato</strong><div className="muted" style={{fontSize:11.5}}>Website + LinkedIn</div></div><Toggle on={false}/></div>
            <div className="setting-row" style={{borderBottom:'none'}}><div><strong>Resumo de leads</strong><div className="muted" style={{fontSize:11.5}}>Briefing antes de calls</div></div><Toggle on={true}/></div>
          </div>
        </div>
      </div>
    </>
  );
}
function Toggle({ on: initial }) {
  const [on, setOn] = React.useState(initial);
  return (
    <button onClick={()=>setOn(!on)} style={{
      width:40, height:22, borderRadius:99, padding:2,
      background: on ? 'hsl(var(--b-accent))' : 'hsl(var(--surface-3))',
      border:0, cursor:'pointer', transition:'.2s', display:'flex', alignItems:'center'
    }}>
      <span style={{width:18, height:18, borderRadius:'50%', background:'white', marginLeft: on ? 18 : 0, transition:'.2s', boxShadow:'0 2px 4px rgba(0,0,0,.15)'}}/>
    </button>
  );
}
window.Settings = Settings;
