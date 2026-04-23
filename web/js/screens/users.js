function Users() {
  const { fmt, USERS, ROLES } = window.DATA;
  const [users] = React.useState(USERS);
  const [q, setQ] = React.useState('');
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Usuários & Permissões</h1>
          <div className="page-sub">{users.length} usuários · {users.filter(u=>u.status==='ativo').length} ativos · {users.filter(u=>u.status==='pendente').length} pendentes</div>
        </div>
        <div className="actions">
          <button className="btn btn-accent btn-sm"><I.plus size={12}/>Convidar usuário</button>
        </div>
      </div>
      <div className="grid-3" style={{marginBottom:'var(--gap)'}}>
        {Object.values(ROLES).map(r => (
          <div key={r.id} className="card" style={{padding:16}}>
            <div className="row" style={{gap:10, marginBottom:8}}>
              <div style={{width:30, height:30, borderRadius:8, background:r.color+'22', color:r.color, display:'grid', placeItems:'center'}}>
                {r.id==='master' && <I.star size={14}/>}
                {r.id==='admin' && <I.target size={14}/>}
                {r.id==='comum' && <I.users size={14}/>}
              </div>
              <div>
                <div style={{fontWeight:700, fontSize:15}}>{r.label}</div>
                <div className="muted" style={{fontSize:11.5}}>{users.filter(u=>u.role===r.id).length} usuário(s)</div>
              </div>
            </div>
            <p className="muted" style={{fontSize:12.5, margin:0, lineHeight:1.45}}>{r.descr}</p>
          </div>
        ))}
      </div>
      <div className="filters-bar">
        <div className="row" style={{gap:8, flex:1, minWidth:240}}>
          <I.search size={16}/>
          <input className="filter-input" placeholder="Buscar por nome ou e-mail…" value={q} onChange={e=>setQ(e.target.value)} style={{flex:1, border:0, padding:0, background:'transparent'}}/>
        </div>
      </div>
      <div className="card">
        <table className="table">
          <thead><tr><th>Usuário</th><th>Papel</th><th>Time</th><th>Status</th><th>Deals</th><th>Receita</th><th>Último acesso</th></tr></thead>
          <tbody>
            {users.filter(u => !q || u.name.toLowerCase().includes(q.toLowerCase()) || u.email.toLowerCase().includes(q.toLowerCase())).map(u => {
              const role = ROLES[u.role];
              return (
                <tr key={u.id}>
                  <td><div className="row" style={{gap:10}}><UI.Avatar name={u.name} size={32}/><div><strong>{u.name}</strong><div className="muted mono" style={{fontSize:11}}>{u.email}</div></div></div></td>
                  <td><span className="chip" style={{background:role.color+'15', color:role.color, borderColor:role.color+'44'}}>{role.label}</span></td>
                  <td style={{fontSize:12.5}}>{u.team}</td>
                  <td><span className={`chip ${u.status==='ativo'?'success':u.status==='pendente'?'warn':'danger'}`}><span className="dot"/>{u.status}</span></td>
                  <td className="mono" style={{fontSize:12.5}}>{u.deals} · <strong style={{color:'hsl(var(--success))'}}>{u.won}</strong></td>
                  <td><strong className="mono">{u.revenue>0?fmt.brlK(u.revenue):'—'}</strong></td>
                  <td className="muted" style={{fontSize:11.5}}>{u.lastSeen ? fmt.relative(u.lastSeen) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Profile() {
  const { fmt, CURRENT_USER, ROLES, DEALS, COMPANIES } = window.DATA;
  const u = CURRENT_USER;
  const role = ROLES[u.role];
  const myDeals = DEALS.filter(d => d.owner === u.name);
  return (
    <>
      <div className="card halo" style={{marginBottom:'var(--gap)', padding:24, background:'linear-gradient(135deg, hsl(var(--b-accent)), hsl(var(--b-accent-light)))', color:'white'}}>
        <div className="row" style={{gap:24}}>
          <UI.Avatar name={u.name} size={96}/>
          <div style={{flex:1}}>
            <h1 className="page-title" style={{margin:0, color:'white'}}>{u.name}</h1>
            <div className="row" style={{gap:14, color:'hsl(0 0% 100% / .85)', fontSize:13, marginTop:4}}>
              <span className="row" style={{gap:6}}><I.mail size={13}/>{u.email}</span>
              <span>·</span><span>{u.team}</span>
              <span>·</span><span>{role.label}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="grid-4" style={{marginBottom:'var(--gap)'}}>
        <div className="kpi"><div className="label">Deals ativos</div><div className="value">{myDeals.length}</div></div>
        <div className="kpi"><div className="label">Ganhos</div><div className="value">{u.won}</div></div>
        <div className="kpi"><div className="label">Receita</div><div className="value">{fmt.brlK(u.revenue)}</div></div>
        <div className="kpi"><div className="label">Win rate</div><div className="value">{u.deals?Math.round((u.won/u.deals)*100):0}%</div></div>
      </div>
      <div className="card">
        <div className="card-head"><div className="card-title">Minhas oportunidades</div></div>
        <table className="table">
          <thead><tr><th>Deal</th><th>Empresa</th><th>Estágio</th><th>Valor</th></tr></thead>
          <tbody>
            {myDeals.map(d => {
              const c = COMPANIES[d.company];
              const s = window.DATA.STAGES.find(s=>s.id===d.stage);
              return (
                <tr key={d.id}>
                  <td><strong>{d.title}</strong></td>
                  <td>{c?.name}</td>
                  <td><span className="chip" style={{background:s.color+'22', color:s.color}}>{s.label}</span></td>
                  <td><strong className="mono">{fmt.brlK(d.value)}</strong></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

window.Users = Users;
window.Profile = Profile;
