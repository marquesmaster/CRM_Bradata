// /deals — listagem tabular de oportunidades (complementa o Kanban /pipeline)
function Deals() {
  const { fmt, STAGES, COMPANIES, DEALS } = window.DATA;
  const [filterStage, setFilterStage] = React.useState('all');

  const filtered = DEALS.filter(d => filterStage === 'all' || String(d.stage) === String(filterStage));
  const total = filtered.reduce((s, d) => s + (d.value || 0), 0);
  const ponderado = filtered.reduce((s, d) => s + (d.value || 0) * ((d.prob || 0) / 100), 0);

  const stageById = Object.fromEntries(STAGES.map(s => [s.id, s]));

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Deals</h1>
          <div className="page-sub">
            {filtered.length} oportunidades · <strong className="mono">{fmt.brlK(total)}</strong> total · ponderado {fmt.brlK(ponderado)}
          </div>
        </div>
        <div className="actions">
          <button className="btn btn-ghost btn-sm" onClick={()=>window.__nav('pipeline')}><I.kanban size={12}/>Ver Kanban</button>
          <button className="btn btn-accent btn-sm"><I.plus size={12}/>Novo deal</button>
        </div>
      </div>

      <div className="filters-bar">
        <div className="segment-ctrl" style={{flexWrap:'wrap'}}>
          <button className={filterStage==='all'?'active':''} onClick={()=>setFilterStage('all')}>Todos</button>
          {STAGES.map(s => (
            <button key={s.id} className={String(filterStage)===String(s.id)?'active':''} onClick={()=>setFilterStage(s.id)}>{s.label}</button>
          ))}
        </div>
      </div>

      <div className="card">
        <table className="table">
          <thead><tr>
            <th>Deal</th><th>Empresa</th><th>Estágio</th><th>Valor</th><th>Prob.</th><th>Fechamento</th><th>Responsável</th><th></th>
          </tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan="8" style={{textAlign:'center', padding:32, color:'hsl(var(--fg-muted))'}}>Nenhum deal com esses filtros.</td></tr>}
            {filtered.map(d => {
              const c = COMPANIES[d.company];
              const s = stageById[d.stage];
              return (
                <tr key={d.id}>
                  <td>
                    <strong style={{fontSize:12.5}}>{d.title}</strong>
                    {d.tags?.length > 0 && <div className="row" style={{gap:4, marginTop:2}}>{d.tags.map(t => <span key={t} className="chip" style={{fontSize:9.5, padding:'1px 5px'}}>{t}</span>)}</div>}
                  </td>
                  <td>
                    <div className="row" style={{gap:8}}>
                      <UI.Avatar name={c?.name||'?'} size={24}/>
                      <strong style={{fontSize:12.5}}>{c?.name || '—'}</strong>
                    </div>
                  </td>
                  <td>{s && <span className="chip" style={{background: s.color+'22', color: s.color, borderColor: s.color+'55'}}>{s.label}</span>}</td>
                  <td><strong className="mono">{fmt.brlK(d.value)}</strong></td>
                  <td><div style={{width:60}}><div className="progress" style={{height:6}}><span style={{width:`${d.prob}%`}}/></div><div className="faint mono" style={{fontSize:10, marginTop:2}}>{d.prob}%</div></div></td>
                  <td className="muted" style={{fontSize:12}}>{fmt.date(d.closeDate)}</td>
                  <td className="muted" style={{fontSize:12}}>{d.owner}</td>
                  <td>
                    <button className="btn btn-xs btn-ghost" onClick={()=>window.__nav('propostas', d.id)}>Propostas</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

window.Deals = Deals;
