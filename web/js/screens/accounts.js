function Accounts() {
  const { fmt, COMPANY_LIST } = window.DATA;
  const [q, setQ] = React.useState('');
  const [ufFilter, setUfFilter] = React.useState('');
  const list = COMPANY_LIST.filter(c => {
    if (q && !c.name.toLowerCase().includes(q.toLowerCase()) && !c.cnpj.includes(q)) return false;
    if (ufFilter && c.uf !== ufFilter) return false;
    return true;
  });
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Contas & Empresas</h1>
          <div className="page-sub">{COMPANY_LIST.length} empresas no CRM · {COMPANY_LIST.filter(c=>c.revenue>=100_000_000).length} são 100MM+</div>
        </div>
        <div className="actions">
          <button className="btn btn-ghost btn-sm"><I.download size={12}/>Exportar CSV</button>
          <button className="btn btn-accent btn-sm"><I.plus size={12}/>Nova conta</button>
        </div>
      </div>
      <div className="filters-bar">
        <div className="row" style={{gap:8, flex:1, minWidth:240}}>
          <I.search size={16}/>
          <input className="filter-input" placeholder="Buscar por nome ou CNPJ…" value={q} onChange={e=>setQ(e.target.value)} style={{flex:1, border:0, padding:0, background:'transparent'}}/>
        </div>
        <select className="filter-select" value={ufFilter} onChange={e=>setUfFilter(e.target.value)}>
          <option value="">Todas UFs</option>
          {[...new Set(COMPANY_LIST.map(c=>c.uf))].map(u => <option key={u}>{u}</option>)}
        </select>
        <button className="btn btn-ghost btn-sm"><I.filter size={12}/>Mais filtros</button>
      </div>
      <div className="card">
        <table className="table">
          <thead><tr>
            <th>Empresa</th><th>CNPJ</th><th>Cidade</th><th>Setor</th><th>Faturamento</th><th>Contratos</th><th>Score</th><th>Status</th><th></th>
          </tr></thead>
          <tbody>
            {list.map(c => (
              <tr key={c.id}>
                <td>
                  <div className="row" style={{gap:10}}>
                    <UI.Avatar name={c.name} size={30}/>
                    <div>
                      <strong style={{fontSize:13}}>{c.name}</strong>
                      {c.revenue >= 100_000_000 && <span className="chip primary" style={{marginLeft:6, fontSize:9.5, padding:'1px 5px'}}><I.fire size={9}/>100MM+</span>}
                      <div className="muted" style={{fontSize:11}}>{c.website}</div>
                    </div>
                  </div>
                </td>
                <td className="mono faint" style={{fontSize:11}}>{fmt.cnpj(c.cnpj)}</td>
                <td style={{fontSize:12.5}}>{c.city}, {c.uf}</td>
                <td><span className="chip" style={{fontSize:11}}>{c.sector}</span></td>
                <td><strong className="mono">{fmt.brlK(c.revenue)}</strong></td>
                <td className="mono">{c.contractsPncp}</td>
                <td><UI.ScoreRing value={c.score} size={34} stroke={4}/></td>
                <td><span className={`chip ${c.status==='cliente'?'success':c.status==='lead'?'info':'primary'}`}>{c.status}</span></td>
                <td><button className="btn btn-xs btn-ghost" onClick={()=>window.__nav('lead', c.id)}>Abrir</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
window.Accounts = Accounts;
