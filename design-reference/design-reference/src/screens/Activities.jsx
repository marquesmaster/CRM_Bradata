// Activities — agenda de tarefas, calls, e-mails
// Bradata CRM — screen module
// Globals expected: React, window.DATA, window.I (icons), window.UI (primitives)

function Activities() {
  const { fmt, ACTIVITIES } = window.DATA;
  const [filter, setFilter] = React.useState('todas');
  const [acts, setActs] = React.useState(ACTIVITIES);
  const list = acts.filter(a => filter==='todas' || a.status===filter);
  const toggle = (id) => setActs(acts.map(a => a.id===id ? {...a, status: a.status==='concluida'?'pendente':'concluida'} : a));
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Atividades</h1>
          <div className="page-sub">{acts.filter(a=>a.status==='pendente').length} pendentes · {acts.filter(a=>a.priority==='alta'&&a.status==='pendente').length} de alta prioridade</div>
        </div>
        <div className="actions">
          <button className="btn btn-accent btn-sm"><I.plus size={12}/>Nova atividade</button>
        </div>
      </div>
      <div className="segment-ctrl" style={{marginBottom:16, width:'fit-content'}}>
        {['todas','pendente','concluida'].map(f => (
          <button key={f} className={filter===f?'active':''} onClick={()=>setFilter(f)} style={{textTransform:'capitalize'}}>{f}</button>
        ))}
      </div>
      <div className="card">
        {list.map((a,i) => (
          <div key={a.id} style={{display:'grid', gridTemplateColumns:'auto 1fr auto', gap:14, padding:'14px 20px', borderBottom: i<list.length-1?'1px solid hsl(var(--border))':'none', alignItems:'center'}}>
            <button className="check-box" onClick={()=>toggle(a.id)} style={{
              width:20, height:20, borderRadius:6, border:'1.5px solid hsl(var(--border))',
              background: a.status==='concluida'?'hsl(var(--success))':'transparent',
              display:'grid', placeItems:'center', cursor:'pointer'
            }}>
              {a.status==='concluida' && <I.check size={12} style={{color:'white'}}/>}
            </button>
            <div>
              <div style={{fontWeight:600, fontSize:13.5, textDecoration: a.status==='concluida'?'line-through':'none', color: a.status==='concluida'?'hsl(var(--fg-muted))':'hsl(var(--fg))'}}>{a.title}</div>
              <div className="row" style={{gap:8, marginTop:4, fontSize:11.5}}>
                <span className="chip" style={{fontSize:10, padding:'1px 6px'}}>{a.type}</span>
                <span className="muted">{a.owner}</span>
                {a.priority==='alta' && <span className="chip danger" style={{fontSize:10}}>Alta</span>}
              </div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:12.5, fontWeight:600}}>{new Date(a.when).toLocaleDateString('pt-BR', {day:'2-digit', month:'short'})}</div>
              <div className="muted" style={{fontSize:11}}>{new Date(a.when).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

window.Activities = Activities;
