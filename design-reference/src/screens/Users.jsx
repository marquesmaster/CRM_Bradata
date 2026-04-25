// Users — gestão de usuários e papéis (Master/Admin/Comum)
// Bradata CRM — screen module
// Globals expected: React, window.DATA, window.I (icons), window.UI (primitives)

function Users() {
  const { fmt, USERS, ROLES } = window.DATA;
  const [users, setUsers] = React.useState(USERS);
  const [q, setQ] = React.useState('');
  const [roleFilter, setRoleFilter] = React.useState('all');
  const [showInvite, setShowInvite] = React.useState(false);
  const [selectedRole, setSelectedRole] = React.useState(null);

  const filtered = users.filter(u => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (q && !u.name.toLowerCase().includes(q.toLowerCase()) && !u.email.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const changeRole = (id, role) => setUsers(us => us.map(u => u.id===id ? {...u, role} : u));
  const toggleStatus = (id) => setUsers(us => us.map(u => u.id===id ? {...u, status: u.status==='ativo'?'inativo':'ativo'} : u));

  const counts = {
    total: users.length,
    master: users.filter(u=>u.role==='master').length,
    admin: users.filter(u=>u.role==='admin').length,
    comum: users.filter(u=>u.role==='comum').length,
    ativos: users.filter(u=>u.status==='ativo').length,
    pendentes: users.filter(u=>u.status==='pendente').length,
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Usuários & Permissões</h1>
          <div className="page-sub">{counts.total} usuários · {counts.ativos} ativos · {counts.pendentes} pendente{counts.pendentes!==1?'s':''}</div>
        </div>
        <div className="actions">
          <button className="btn btn-ghost btn-sm"><I.download size={12}/>Exportar</button>
          <button className="btn btn-accent btn-sm" onClick={()=>setShowInvite(true)}><I.plus size={12}/>Convidar usuário</button>
        </div>
      </div>

      {/* Role cards */}
      <div className="grid-3" style={{marginBottom:'var(--gap)'}}>
        {Object.values(ROLES).map(r => (
          <div key={r.id} className={`role-card ${selectedRole===r.id?'selected':''}`} onClick={()=>setSelectedRole(selectedRole===r.id?null:r.id)}>
            <div className="row-between" style={{marginBottom:8}}>
              <div className="row" style={{gap:10}}>
                <div className="role-badge" style={{background:r.color+'22', color:r.color, borderColor:r.color+'55'}}>
                  {r.id==='master' && <I.star size={14}/>}
                  {r.id==='admin' && <I.target size={14}/>}
                  {r.id==='comum' && <I.users size={14}/>}
                </div>
                <div>
                  <div style={{fontWeight:700, fontSize:15}}>{r.label}</div>
                  <div className="muted" style={{fontSize:11.5}}>{counts[r.id]} usuário{counts[r.id]!==1?'s':''}</div>
                </div>
              </div>
              <I.chevron size={12} style={{color:'hsl(var(--fg-faint))', transform:selectedRole===r.id?'rotate(90deg)':'none', transition:'.2s'}}/>
            </div>
            <p className="muted" style={{fontSize:12.5, margin:'0 0 10px', lineHeight:1.45, minHeight:34}}>{r.descr}</p>
            {selectedRole===r.id && (
              <div style={{paddingTop:10, borderTop:'1px solid hsl(var(--border))', marginTop:2}}>
                <div className="faint" style={{fontSize:10, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8}}>Permissões</div>
                <ul style={{margin:0, padding:0, listStyle:'none', display:'flex', flexDirection:'column', gap:6}}>
                  {r.perms.map(p => (
                    <li key={p} style={{fontSize:12.5, display:'flex', gap:8, alignItems:'flex-start'}}>
                      <I.check size={12} style={{color: r.color, marginTop:3, flex:'0 0 auto'}}/>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="row" style={{gap:8, flex:1, minWidth:240}}>
          <I.search size={16}/>
          <input className="filter-input" placeholder="Buscar por nome ou e-mail…" value={q} onChange={e=>setQ(e.target.value)} style={{flex:1, border:0, padding:0, background:'transparent'}}/>
        </div>
        <div className="segment-ctrl">
          {[['all','Todos'],['master','Master'],['admin','Admins'],['comum','Usuários']].map(([v,l]) => (
            <button key={v} className={roleFilter===v?'active':''} onClick={()=>setRoleFilter(v)}>{l}</button>
          ))}
        </div>
      </div>

      <div className="card">
        <table className="table">
          <thead><tr>
            <th>Usuário</th>
            <th>Papel</th>
            <th>Time</th>
            <th>Status</th>
            <th>Deals · Ganhos</th>
            <th>Receita</th>
            <th>Último acesso</th>
            <th></th>
          </tr></thead>
          <tbody>
            {filtered.map(u => {
              const role = ROLES[u.role];
              return (
                <tr key={u.id}>
                  <td>
                    <div className="row" style={{gap:10}}>
                      <UI.Avatar name={u.name} size={32}/>
                      <div>
                        <strong style={{fontSize:13}}>{u.name}</strong>
                        {u.id==='u1' && <span className="chip primary" style={{marginLeft:6, fontSize:9.5, padding:'1px 5px'}}>Você</span>}
                        <div className="muted mono" style={{fontSize:11}}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <select
                      value={u.role}
                      onChange={e=>changeRole(u.id, e.target.value)}
                      className="role-select"
                      style={{background:role.color+'15', color:role.color, borderColor:role.color+'44'}}
                      disabled={u.id==='u1'}
                    >
                      <option value="master">Master</option>
                      <option value="admin">Admin</option>
                      <option value="comum">Usuário</option>
                    </select>
                  </td>
                  <td style={{fontSize:12.5}}>{u.team}</td>
                  <td>
                    <span className={`chip ${u.status==='ativo'?'success':u.status==='pendente'?'warn':'danger'}`}>
                      <span className="dot"/>{u.status}
                    </span>
                  </td>
                  <td className="mono" style={{fontSize:12.5}}>{u.deals} · <strong style={{color:'hsl(var(--success))'}}>{u.won}</strong></td>
                  <td><strong className="mono">{u.revenue>0?fmt.brlK(u.revenue):'—'}</strong></td>
                  <td className="muted" style={{fontSize:11.5}}>{u.lastSeen ? fmt.relative(u.lastSeen) : '—'}</td>
                  <td>
                    <div className="row" style={{gap:4, justifyContent:'flex-end'}}>
                      <button className="icon-btn" title="E-mail"><I.mail size={14}/></button>
                      <button className="icon-btn" title={u.status==='ativo'?'Desativar':'Ativar'} onClick={()=>toggleStatus(u.id)} disabled={u.id==='u1'}>
                        {u.status==='ativo' ? <I.close size={14}/> : <I.check size={14}/>}
                      </button>
                      <button className="icon-btn"><I.more size={14}/></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showInvite && <InviteModal onClose={()=>setShowInvite(false)} onInvite={(u)=>{ setUsers([...users, u]); setShowInvite(false); }}/>}
    </>
  );
}

function InviteModal({ onClose, onInvite }) {
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [role, setRole] = React.useState('comum');
  const [team, setTeam] = React.useState('Sales');

  const submit = () => {
    if (!name || !email) return;
    onInvite({
      id: 'u' + Math.random().toString(36).slice(2,6),
      name, email, role, team, status:'pendente',
      createdAt: new Date().toISOString().slice(0,10),
      lastSeen: null, deals: 0, won: 0, revenue: 0,
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div style={{fontSize:16, fontWeight:700}}>Convidar novo usuário</div>
            <div className="muted" style={{fontSize:12.5, marginTop:2}}>O usuário receberá um e-mail para definir a senha.</div>
          </div>
          <button className="icon-btn" onClick={onClose}><I.close size={16}/></button>
        </div>
        <div className="modal-body" style={{display:'flex', flexDirection:'column', gap:14}}>
          <FormField label="Nome completo">
            <input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="Ex: João da Silva"/>
          </FormField>
          <FormField label="E-mail corporativo">
            <input className="input" value={email} onChange={e=>setEmail(e.target.value)} placeholder="joao@bradata.com.br" type="email"/>
          </FormField>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
            <FormField label="Time">
              <select className="input" value={team} onChange={e=>setTeam(e.target.value)}>
                <option>Sales</option><option>SDR</option><option>Operações</option><option>Executivo</option>
              </select>
            </FormField>
            <FormField label="Papel">
              <select className="input" value={role} onChange={e=>setRole(e.target.value)}>
                <option value="comum">Usuário (comum)</option>
                <option value="admin">Admin</option>
                <option value="master">Master</option>
              </select>
            </FormField>
          </div>
          <div style={{padding:10, background:'hsl(var(--info-soft))', borderRadius:8, fontSize:12, color:'hsl(var(--info))', display:'flex', gap:8, alignItems:'flex-start'}}>
            <I.sparkle size={14} style={{flex:'0 0 auto', marginTop:1}}/>
            <span>Papéis podem ser alterados depois. Apenas usuários <strong>Master</strong> podem promover outros Masters.</span>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancelar</button>
          <button className="btn btn-accent btn-sm" onClick={submit} disabled={!name || !email}><I.send size={12}/>Enviar convite</button>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <div>
      <div className="form-label">{label}</div>
      {children}
    </div>
  );
}

// --- Profile screen ---

window.Users = Users;
