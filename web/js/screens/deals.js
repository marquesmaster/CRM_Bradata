// Deals: listagem tabular de oportunidades, lendo da API real
function Deals() {
  const { fmt, COMPANIES, STAGES } = window.DATA;
  const [items, setItems] = React.useState([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [filterStage, setFilterStage] = React.useState('all');
  const [filterStatus, setFilterStatus] = React.useState('aberta');
  const [editing, setEditing] = React.useState(null);  // null | {} | <deal>
  const [closing, setClosing] = React.useState(null);
  const SIZE = 50;

  const stageById = Object.fromEntries(STAGES.map(s => [String(s.id), s]));

  const load = React.useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams({ page, size: SIZE });
    if (filterStatus !== 'all') qs.set('status', filterStatus);
    if (filterStage !== 'all') qs.set('estagio_id', filterStage);
    window.API.api(`/oportunidades?${qs}`)
      .then(p => { setItems(p.items || []); setTotal(p.total || 0); })
      .finally(() => setLoading(false));
  }, [page, filterStage, filterStatus]);

  React.useEffect(load, [load]);

  const totalValor = items.reduce((s, d) => s + (d.valor_estimado || 0), 0);
  const ponderado = items.reduce((s, d) => s + (d.valor_estimado || 0) * ((d.probabilidade || 0) / 100), 0);

  const reload = () => { load(); window.API.refresh().catch(()=>{}); };

  const onSaved = () => { setEditing(null); setClosing(null); reload(); };

  const onDelete = async (deal) => {
    if (!confirm(`Excluir "${deal.titulo}"?`)) return;
    try {
      await window.API.api(`/oportunidades/${deal.id}`, { method: 'DELETE' });
      reload();
    } catch (e) { alert(e.message); }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Deals</h1>
          <div className="page-sub">
            {total} oportunidades · <strong className="mono">{fmt.brlK(totalValor)}</strong> total · ponderado {fmt.brlK(ponderado)}
          </div>
        </div>
        <div className="actions">
          <button className="btn btn-ghost btn-sm" onClick={()=>window.__nav('pipeline')}>
            <I.kanban size={12}/>Ver Kanban
          </button>
          <button className="btn btn-accent btn-sm" onClick={()=>setEditing({})}>
            <I.plus size={12}/>Novo deal
          </button>
        </div>
      </div>

      <div className="filters-bar" style={{display:'flex', gap:14, flexWrap:'wrap', alignItems:'center'}}>
        <div className="segment-ctrl" style={{flexWrap:'wrap'}}>
          {[
            ['all','Todos'],['aberta','Abertas'],['ganha','Ganhas'],['perdida','Perdidas'],
          ].map(([k,l]) => (
            <button key={k} className={filterStatus===k?'active':''} onClick={()=>{setFilterStatus(k); setPage(1);}}>{l}</button>
          ))}
        </div>
        <div className="segment-ctrl" style={{flexWrap:'wrap'}}>
          <button className={filterStage==='all'?'active':''} onClick={()=>{setFilterStage('all'); setPage(1);}}>Todos estágios</button>
          {STAGES.map(s => (
            <button key={s.id} className={String(filterStage)===String(s.id)?'active':''} onClick={()=>{setFilterStage(s.id); setPage(1);}}>{s.label}</button>
          ))}
        </div>
      </div>

      <div className="card">
        <table className="table">
          <thead><tr>
            <th>Deal</th><th>Empresa</th><th>Estágio</th><th>Valor</th><th>Prob.</th><th>Fechamento</th><th>Status</th><th></th>
          </tr></thead>
          <tbody>
            {loading && <tr><td colSpan="8" style={{textAlign:'center', padding:24}} className="muted">Carregando…</td></tr>}
            {!loading && items.length === 0 && (
              <tr><td colSpan="8" style={{textAlign:'center', padding:32, color:'hsl(var(--fg-muted))'}}>
                Nenhum deal com esses filtros. <button className="btn btn-xs btn-accent" style={{marginLeft:8}} onClick={()=>setEditing({})}>Criar agora</button>
              </td></tr>
            )}
            {items.map(d => {
              const c = COMPANIES[String(d.empresa_id)];
              const s = stageById[String(d.estagio_id)];
              const status = d.status;
              const closed = status !== 'aberta';
              return (
                <tr key={d.id} style={{opacity: closed ? 0.65 : 1}}>
                  <td>
                    <button className="link" style={{background:'none', border:0, padding:0, fontSize:12.5, fontWeight:600, color:'hsl(var(--fg))', cursor:'pointer', textAlign:'left'}}
                      onClick={()=>setEditing(d)}>
                      {d.titulo}
                    </button>
                    {d.tags?.length > 0 && (
                      <div className="row" style={{gap:4, marginTop:2}}>
                        {d.tags.map(t => <span key={t} className="chip" style={{fontSize:9.5, padding:'1px 5px'}}>{t}</span>)}
                      </div>
                    )}
                  </td>
                  <td>
                    {c ? (
                      <button className="link" style={{background:'none', border:0, padding:0, cursor:'pointer', display:'flex', alignItems:'center', gap:8}} onClick={()=>window.__nav('lead', String(d.empresa_id))}>
                        <UI.Avatar name={c.name} size={24}/>
                        <strong style={{fontSize:12.5}}>{c.name}</strong>
                      </button>
                    ) : <span className="muted">—</span>}
                  </td>
                  <td>{s && <span className="chip" style={{background: s.color+'22', color: s.color, borderColor: s.color+'55'}}>{s.label}</span>}</td>
                  <td><strong className="mono">{fmt.brlK(d.valor_estimado || 0)}</strong></td>
                  <td>
                    <div style={{width:60}}>
                      <div className="progress" style={{height:6}}><span style={{width:`${d.probabilidade || 0}%`}}/></div>
                      <div className="faint mono" style={{fontSize:10, marginTop:2}}>{d.probabilidade || 0}%</div>
                    </div>
                  </td>
                  <td className="muted" style={{fontSize:12}}>{d.data_fechamento_prevista ? fmt.date(d.data_fechamento_prevista) : '—'}</td>
                  <td>
                    {status === 'aberta' && <span className="chip primary" style={{fontSize:10}}>Aberta</span>}
                    {status === 'ganha' && <span className="chip success" style={{fontSize:10}}>Ganha</span>}
                    {status === 'perdida' && <span className="chip danger" style={{fontSize:10}}>Perdida {d.motivo_perda ? `· ${d.motivo_perda.slice(0,30)}` : ''}</span>}
                  </td>
                  <td>
                    <div className="row" style={{gap:4, justifyContent:'flex-end'}}>
                      <button className="btn btn-xs btn-ghost" onClick={()=>setEditing(d)} title="Editar"><I.sliders size={12}/></button>
                      {!closed && <button className="btn btn-xs btn-ghost" onClick={()=>setClosing(d)} title="Fechar deal"><I.check size={12}/></button>}
                      <button className="btn btn-xs btn-ghost" onClick={()=>window.__nav('propostas', d.id)} title="Propostas"><I.doc size={12}/></button>
                      <button className="btn btn-xs btn-ghost" onClick={()=>onDelete(d)} title="Excluir" style={{color:'hsl(var(--danger))'}}><I.x size={12}/></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {total > SIZE && (
        <div className="row-between" style={{marginTop:14, padding:'0 6px'}}>
          <span className="muted" style={{fontSize:12}}>{(page-1)*SIZE+1}–{Math.min(page*SIZE,total)} de {total}</span>
          <div className="row" style={{gap:6}}>
            <button className="btn btn-xs btn-ghost" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>‹ Anterior</button>
            <span className="muted" style={{fontSize:12, padding:'0 6px'}}>Pág {page} / {Math.ceil(total/SIZE)}</span>
            <button className="btn btn-xs btn-ghost" disabled={page*SIZE>=total} onClick={()=>setPage(p=>p+1)}>Próxima ›</button>
          </div>
        </div>
      )}

      {editing && <DealModal deal={editing.id ? editing : null} onClose={()=>setEditing(null)} onSaved={onSaved}/>}
      {closing && <CloseDealModal deal={closing} onClose={()=>setClosing(null)} onSaved={onSaved}/>}
    </>
  );
}

window.Deals = Deals;
