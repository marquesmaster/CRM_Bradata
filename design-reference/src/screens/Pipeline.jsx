// Pipeline - Kanban / List / Timeline
function Pipeline() {
  const layout = window.__TWEAKS__.pipelineLayout || 'kanban';
  const [deals, setDeals] = React.useState(window.DATA.DEALS);
  if (layout === 'list') return <PipelineList deals={deals}/>;
  if (layout === 'timeline') return <PipelineTimeline deals={deals}/>;
  return <PipelineKanban deals={deals} setDeals={setDeals}/>;
}

function PipelineHeader() {
  const { fmt, DEALS } = window.DATA;
  const total = DEALS.filter(d=>d.stage!=='ganho').reduce((s,d)=>s+d.value,0);
  return (
    <div className="page-head">
      <div>
        <h1 className="page-title">Pipeline de vendas</h1>
        <div className="page-sub">{DEALS.length} oportunidades · <strong style={{color:'hsl(var(--b-accent))'}}>{fmt.brlK(total)}</strong> em aberto</div>
      </div>
      <div className="actions">
        <button className="btn btn-ghost btn-sm"><I.filter size={12}/>Filtros</button>
        <button className="btn btn-accent btn-sm"><I.plus size={12}/>Nova oportunidade</button>
      </div>
    </div>
  );
}

function PipelineKanban({ deals, setDeals }) {
  const { fmt, STAGES, COMPANIES } = window.DATA;
  const cardDetail = window.__TWEAKS__.cardDetail || 'full';
  const [dragId, setDragId] = React.useState(null);
  const [dragOver, setDragOver] = React.useState(null);

  const onDragStart = (id) => setDragId(id);
  const onDrop = (stage) => {
    if (!dragId) return;
    setDeals(ds => ds.map(d => d.id === dragId ? { ...d, stage } : d));
    setDragId(null); setDragOver(null);
  };

  return (
    <>
      <PipelineHeader/>
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
              <div
                className={`kanban-body ${dragOver===stage.id?'drop':''}`}
                onDragOver={e=>{e.preventDefault(); setDragOver(stage.id);}}
                onDragLeave={()=>setDragOver(null)}
                onDrop={()=>onDrop(stage.id)}
              >
                {stageDeals.map(d => {
                  const company = window.DATA.COMPANIES[d.company];
                  return (
                    <div key={d.id} className={`deal-card ${dragId===d.id?'dragging':''}`}
                      draggable onDragStart={()=>onDragStart(d.id)} onDragEnd={()=>setDragId(null)}>
                      <div className="deal-title">{d.title}</div>
                      {cardDetail === 'full' && (
                        <div className="row" style={{gap:6, marginBottom:8, flexWrap:'wrap'}}>
                          {d.tags.map(t => <span key={t} className="chip" style={{fontSize:10, padding:'1px 6px'}}>{t}</span>)}
                        </div>
                      )}
                      <div className="deal-row">
                        <UI.Avatar name={company?.name || '?'} size={22}/>
                        <span className="deal-value">{fmt.brlK(d.value)}</span>
                      </div>
                      {cardDetail === 'full' && (
                        <>
                          <div className="progress" style={{marginTop:10, height:4}}><span style={{width:`${d.prob}%`}}/></div>
                          <div className="deal-meta">
                            <I.clock size={10}/><span>{fmt.date(d.closeDate)}</span>
                            <span style={{marginLeft:'auto', fontWeight:600, color: d.prob>=60?'hsl(var(--success))':'hsl(var(--warning))'}}>{d.prob}%</span>
                          </div>
                        </>
                      )}
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

function PipelineList({ deals }) {
  const { fmt, STAGES, COMPANIES } = window.DATA;
  return (
    <>
      <PipelineHeader/>
      <div className="card">
        <table className="table">
          <thead><tr>
            <th>Oportunidade</th><th>Empresa</th><th>Estágio</th><th>Valor</th><th>Prob.</th><th>Fechamento</th><th>Responsável</th><th></th>
          </tr></thead>
          <tbody>
            {deals.map(d => {
              const c = COMPANIES[d.company], s = STAGES.find(s=>s.id===d.stage);
              return (
                <tr key={d.id}>
                  <td><strong style={{fontSize:13}}>{d.title}</strong><div className="row" style={{gap:4, marginTop:2}}>{d.tags.map(t=> <span key={t} className="chip" style={{fontSize:9.5, padding:'1px 5px'}}>{t}</span>)}</div></td>
                  <td><div className="row" style={{gap:8}}><UI.Avatar name={c?.name||'?'} size={26}/><strong style={{fontSize:12.5}}>{c?.name}</strong></div></td>
                  <td><span className="chip" style={{background: s.color+'22', color: s.color, borderColor: s.color+'55'}}>{s.label}</span></td>
                  <td><strong className="mono">{fmt.brlK(d.value)}</strong></td>
                  <td><div style={{width:60}}><div className="progress" style={{height:6}}><span style={{width:`${d.prob}%`}}/></div><div className="faint mono" style={{fontSize:10, marginTop:2}}>{d.prob}%</div></div></td>
                  <td className="muted">{fmt.date(d.closeDate)}</td>
                  <td><div className="row" style={{gap:6}}><UI.Avatar name={d.owner} size={22}/><span style={{fontSize:12}}>{d.owner.split(' ')[0]}</span></div></td>
                  <td><button className="btn btn-xs btn-ghost">Abrir</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PipelineTimeline({ deals }) {
  const { fmt, STAGES, COMPANIES } = window.DATA;
  const sorted = [...deals].sort((a,b)=> new Date(a.closeDate) - new Date(b.closeDate));
  // Group by month
  const byMonth = {};
  sorted.forEach(d => {
    const k = new Date(d.closeDate).toLocaleDateString('pt-BR', {month:'long', year:'numeric'});
    (byMonth[k] ||= []).push(d);
  });
  return (
    <>
      <PipelineHeader/>
      <div style={{display:'flex', flexDirection:'column', gap:20}}>
        {Object.entries(byMonth).map(([month, items]) => (
          <div key={month} className="card">
            <div className="card-head">
              <div className="card-title" style={{textTransform:'capitalize'}}>{month}</div>
              <span className="chip">{items.length} deals · {fmt.brlK(items.reduce((s,d)=>s+d.value,0))}</span>
            </div>
            <div className="card-p" style={{padding:'4px 20px 20px'}}>
              {items.map(d => {
                const c = COMPANIES[d.company], s = STAGES.find(s=>s.id===d.stage);
                return (
                  <div key={d.id} style={{display:'grid', gridTemplateColumns:'90px 1fr auto', gap:16, padding:'14px 0', borderBottom:'1px dashed hsl(var(--border))', alignItems:'center'}}>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontWeight:700, fontSize:14}}>{new Date(d.closeDate).getDate()}</div>
                      <div className="muted" style={{fontSize:11}}>{new Date(d.closeDate).toLocaleDateString('pt-BR', {weekday:'short'})}</div>
                    </div>
                    <div>
                      <div style={{fontWeight:600, fontSize:13}}>{d.title}</div>
                      <div className="row" style={{gap:8, marginTop:4, fontSize:12}}>
                        <span className="chip" style={{background: s.color+'22', color: s.color, borderColor: s.color+'55', fontSize:10}}>{s.label}</span>
                        <span className="muted">{c?.name}</span>
                      </div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div className="mono" style={{fontWeight:700, color:'hsl(var(--b-accent))'}}>{fmt.brlK(d.value)}</div>
                      <div className="muted" style={{fontSize:11}}>{d.prob}% prob.</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

window.Pipeline = Pipeline;
