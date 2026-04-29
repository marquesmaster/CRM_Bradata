// /lixeira — admin vê itens soft-deletados e pode restaurar
function Lixeira() {
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState('');

  const load = () => {
    setLoading(true);
    const qs = new URLSearchParams({ limit: 200 });
    if (filter) qs.set('entity_type', filter);
    window.API.api(`/lixeira?${qs}`)
      .then(setItems)
      .finally(() => setLoading(false));
  };
  React.useEffect(load, [filter]);

  const restore = async (it) => {
    if (!confirm(`Restaurar ${it.entity_type} "${it.label}"?`)) return;
    try {
      await window.API.api(`/lixeira/${it.entity_type}/${it.entity_id}/restore`, { method: 'POST' });
      load();
    } catch (e) { window.toast.error(e.message); }
  };

  const entityIcon = {
    empresa: '🏢', contato: '👤', oportunidade: '💼', proposta: '📋',
    atividade: '✓', nota: '📝', lead: '🎯', automacao: '⚡', ticket: '🎫',
  };

  const counts = items.reduce((acc, i) => { acc[i.entity_type] = (acc[i.entity_type]||0)+1; return acc; }, {});

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Lixeira</h1>
          <div className="page-sub">{items.length} item{items.length===1?'':'s'} excluído{items.length===1?'':'s'} · acessível só por admin</div>
        </div>
        <div className="actions">
          <button className="btn btn-ghost btn-sm" onClick={load}><I.refresh size={12}/>Atualizar</button>
        </div>
      </div>

      <div className="filters-bar" style={{display:'flex', gap:6, flexWrap:'wrap', marginBottom:14}}>
        <button className={`btn btn-xs ${filter===''?'btn-accent':'btn-ghost'}`} onClick={()=>setFilter('')}>
          Todos ({items.length})
        </button>
        {Object.entries(counts).map(([k,n]) => (
          <button key={k} className={`btn btn-xs ${filter===k?'btn-accent':'btn-ghost'}`} onClick={()=>setFilter(k)}>
            {entityIcon[k] || ''} {k} ({n})
          </button>
        ))}
      </div>

      <div className="card">
        {loading && (
          <div style={{padding:'14px 18px', display:'flex', flexDirection:'column', gap:10}}>
            {Array.from({length:4}).map((_,i) => <Skeleton key={i} height={48}/>)}
          </div>
        )}
        {!loading && items.length === 0 && (
          <EmptyState
            icon={<I.x size={22}/>}
            title="Lixeira vazia"
            description="Tudo que for excluído aparece aqui — você pode restaurar a qualquer momento."
          />
        )}
        {!loading && items.length > 0 && (
          <table className="table">
            <thead><tr>
              <th>Tipo</th><th>Item</th><th>Excluído por</th><th>Quando</th><th></th>
            </tr></thead>
            <tbody>
              {items.map(it => (
                <tr key={`${it.entity_type}-${it.entity_id}`}>
                  <td>
                    <span style={{fontSize:18, marginRight:6}}>{entityIcon[it.entity_type] || '📁'}</span>
                    <span className="chip" style={{fontSize:10.5}}>{it.entity_type} #{it.entity_id}</span>
                  </td>
                  <td><strong style={{fontSize:13}}>{it.label}</strong></td>
                  <td style={{fontSize:12.5}}>{it.deleted_by_nome || <span className="muted">—</span>}</td>
                  <td className="muted" style={{fontSize:11.5, whiteSpace:'nowrap'}}>
                    {new Date(it.deleted_at).toLocaleString('pt-BR', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'})}
                  </td>
                  <td>
                    <div className="row" style={{gap:4, justifyContent:'flex-end'}}>
                      <button className="btn btn-xs btn-accent" onClick={()=>restore(it)} title="Restaurar">
                        <I.refresh size={11}/>Restaurar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

window.Lixeira = Lixeira;
