// Tela /historico-global — admin vê todo audit trail com filtros
function HistoricoGlobal() {
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [filter, setFilter] = React.useState({
    entity_type: '', entity_id: '', user_id: '', limit: 200,
  });
  const [team, setTeam] = React.useState([]);

  const load = React.useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (filter.entity_type) qs.set('entity_type', filter.entity_type);
    if (filter.entity_id) qs.set('entity_id', filter.entity_id);
    if (filter.user_id) qs.set('user_id', filter.user_id);
    qs.set('limit', filter.limit);
    window.API.api(`/historico?${qs}`)
      .then(setItems)
      .finally(()=>setLoading(false));
  }, [filter]);

  React.useEffect(load, [load]);
  React.useEffect(() => {
    window.API.api('/users/team').then(setTeam).catch(()=>{});
  }, []);

  const update = (k, v) => setFilter(f => ({...f, [k]: v}));

  const exportCsv = () => {
    if (items.length === 0) return;
    const header = ['Quando','User','Entidade','ID','Ação','Mudanças'];
    const rows = items.map(h => [
      new Date(h.created_at).toISOString(),
      h.user_nome || '',
      h.entity_type,
      h.entity_id,
      h.acao,
      JSON.stringify(h.changes || {}),
    ]);
    const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(';')).join('\n');
    const blob = new Blob(['﻿' + csv], { type:'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `historico_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Histórico global</h1>
          <div className="page-sub">Audit trail · {items.length} eventos</div>
        </div>
        <div className="actions">
          <button className="btn btn-ghost btn-sm" onClick={load}><I.refresh size={12}/>Atualizar</button>
          <button className="btn btn-ghost btn-sm" onClick={exportCsv} disabled={items.length===0}><I.download size={12}/>CSV</button>
        </div>
      </div>

      <div className="card" style={{padding:14, marginBottom:'var(--gap)', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:10}}>
        <select className="input" value={filter.entity_type} onChange={e=>update('entity_type', e.target.value)}>
          <option value="">Todas entidades</option>
          <option value="oportunidade">Oportunidade</option>
          <option value="proposta">Proposta</option>
          <option value="atividade">Atividade</option>
          <option value="empresa">Empresa</option>
          <option value="user">User</option>
        </select>
        <input className="input" type="number" placeholder="ID da entidade" value={filter.entity_id} onChange={e=>update('entity_id', e.target.value)}/>
        <select className="input" value={filter.user_id} onChange={e=>update('user_id', e.target.value)}>
          <option value="">Qualquer user</option>
          {team.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
        </select>
        <select className="input" value={filter.limit} onChange={e=>update('limit', e.target.value)}>
          <option value="50">50 últimos</option>
          <option value="100">100 últimos</option>
          <option value="200">200 últimos</option>
          <option value="500">500 últimos</option>
        </select>
      </div>

      <div className="card">
        {loading && <div className="muted" style={{padding:24, textAlign:'center'}}>Carregando…</div>}
        {!loading && items.length === 0 && <div className="muted" style={{padding:32, textAlign:'center'}}>Nenhum evento com esses filtros.</div>}
        {!loading && items.length > 0 && (
          <table className="table">
            <thead><tr>
              <th>Quando</th><th>User</th><th>Entidade</th><th>Ação</th><th>Mudanças</th>
            </tr></thead>
            <tbody>
              {items.map(h => (
                <tr key={h.id}>
                  <td className="muted" style={{fontSize:11.5, whiteSpace:'nowrap'}}>
                    {new Date(h.created_at).toLocaleString('pt-BR', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'})}
                  </td>
                  <td style={{fontSize:12.5}}>{h.user_nome || <span className="muted">—</span>}</td>
                  <td>
                    <span className="chip" style={{fontSize:10.5}}>{h.entity_type}</span>
                    <span className="muted mono" style={{fontSize:10.5, marginLeft:4}}>#{h.entity_id}</span>
                  </td>
                  <td><strong style={{fontSize:12.5}}>{h.acao}</strong></td>
                  <td className="mono muted" style={{fontSize:10.5, maxWidth:480, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                    {h.changes ? JSON.stringify(h.changes) : '—'}
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

window.HistoricoGlobal = HistoricoGlobal;
