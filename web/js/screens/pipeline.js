function Pipeline() {
  const { fmt, STAGES, COMPANIES, DEALS } = window.DATA;
  const [deals, setDeals] = React.useState(DEALS);
  const [dragId, setDragId] = React.useState(null);
  const [dragOver, setDragOver] = React.useState(null);
  const total = deals.filter(d=>d.stage!=='ganho').reduce((s,d)=>s+d.value,0);

  const onDrop = (stage) => {
    if (!dragId) return;
    setDeals(ds => ds.map(d => d.id === dragId ? { ...d, stage } : d));
    setDragId(null); setDragOver(null);
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Pipeline de vendas</h1>
          <div className="page-sub">{deals.length} oportunidades · <strong style={{color:'hsl(var(--b-accent))'}}>{fmt.brlK(total)}</strong> em aberto</div>
        </div>
        <div className="actions">
          <button className="btn btn-ghost btn-sm"><I.filter size={12}/>Filtros</button>
          <button className="btn btn-accent btn-sm"><I.plus size={12}/>Nova oportunidade</button>
        </div>
      </div>
      <div className="kanban">
        {STAGES.map(stage => {
          const stageDeals = deals.filter(d => d.stage === stage.id);
          const sum = stageDeals.reduce((s,d)=>s+d.value,0);
          return (
            <div key={stage.id} className="kanban-col">
              <div className="kanban-col-head">
                <div>
                  <div className="col-title"><span className="dot" style={{background:stage.color}}/>{stage.label}</div>
                  <div className="col-sum">{fmt.brlK(sum)}</div>
                </div>
                <div className="col-count">{stageDeals.length}</div>
              </div>
              <div className={`kanban-body ${dragOver===stage.id?'drop':''}`}
                onDragOver={e=>{e.preventDefault(); setDragOver(stage.id);}}
                onDragLeave={()=>setDragOver(null)}
                onDrop={()=>onDrop(stage.id)}>
                {stageDeals.map(d => {
                  const company = COMPANIES[d.company];
                  return (
                    <div key={d.id} className={`deal-card ${dragId===d.id?'dragging':''}`} draggable
                      onDragStart={()=>setDragId(d.id)} onDragEnd={()=>setDragId(null)}>
                      <div className="deal-title">{d.title}</div>
                      <div className="row" style={{gap:6, marginBottom:8, flexWrap:'wrap'}}>
                        {(d.tags||[]).map(t => <span key={t} className="chip" style={{fontSize:10, padding:'1px 6px'}}>{t}</span>)}
                      </div>
                      <div className="deal-row">
                        <UI.Avatar name={company?.name || '?'} size={22}/>
                        <span className="deal-value">{fmt.brlK(d.value)}</span>
                      </div>
                      <div className="progress" style={{marginTop:10, height:4}}><span style={{width:`${d.prob}%`}}/></div>
                      <div className="deal-meta">
                        <I.clock size={10}/><span>{fmt.date(d.closeDate)}</span>
                        <span style={{marginLeft:'auto', fontWeight:600, color: d.prob>=60?'hsl(var(--success))':'hsl(var(--warning))'}}>{d.prob}%</span>
                      </div>
                    </div>
                  );
                })}
                {stageDeals.length === 0 && <div style={{padding:16, textAlign:'center', color:'hsl(var(--fg-faint))', fontSize:12}}>Solte aqui</div>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
window.Pipeline = Pipeline;
