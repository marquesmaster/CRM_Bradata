// /usuarios — lista + convidar usuário via API real
function Users() {
  const { fmt, ROLES } = window.DATA;
  const [users, setUsers] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [q, setQ] = React.useState('');
  const [showInvite, setShowInvite] = React.useState(false);
  const [selectedRole, setSelectedRole] = React.useState(null);

  const load = () => {
    setLoading(true);
    window.API.api('/users')
      .then(us => {
        setUsers((us || []).map(u => ({
          id: String(u.id),
          name: u.nome,
          email: u.email,
          role: u.role,
          team: u.team || '—',
          status: u.status || (u.is_active ? 'ativo' : 'inativo'),
          createdAt: u.created_at,
          lastSeen: u.last_seen_at,
        })));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };
  React.useEffect(load, []);

  const filtered = users.filter(u => {
    if (selectedRole && u.role !== selectedRole) return false;
    if (q && !u.name.toLowerCase().includes(q.toLowerCase()) && !u.email.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const counts = users.reduce((a, u) => { a[u.role] = (a[u.role]||0) + 1; return a; }, {});
  counts.total = users.length;
  counts.ativos = users.filter(u => u.status === 'ativo').length;
  counts.pendentes = users.filter(u => u.status === 'pendente').length;

  const toggleStatus = async (u) => {
    if (u.id === String(window.DATA.CURRENT_USER.id)) { alert('Não pode desativar a si mesmo'); return; }
    try {
      await window.API.api(`/users/${u.id}`, {
        method: 'PATCH',
        body: { status: u.status === 'ativo' ? 'inativo' : 'ativo', is_active: u.status !== 'ativo' },
      });
      load();
    } catch (e) { alert(e.message); }
  };

  const changeRole = async (u, newRole) => {
    try {
      await window.API.api(`/users/${u.id}`, { method: 'PATCH', body: { role: newRole } });
      load();
    } catch (e) { alert(e.message); }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Usuários & Permissões</h1>
          <div className="page-sub">
            {counts.total} usuários · {counts.ativos} ativos{counts.pendentes > 0 && ` · ${counts.pendentes} pendentes`}
          </div>
        </div>
        <div className="actions">
          <button className="btn btn-accent btn-sm" onClick={()=>setShowInvite(true)}><I.plus size={12}/>Convidar usuário</button>
        </div>
      </div>

      {/* Cards de roles */}
      <div className="grid-3" style={{marginBottom:'var(--gap)'}}>
        {Object.values(ROLES).filter(r => ['admin','gestor','bdr','vendedor','leitor'].includes(r.id)).map(r => (
          <div key={r.id} className="card" style={{padding:16, cursor:'pointer', border: selectedRole===r.id?`2px solid ${r.color}`:'1px solid hsl(var(--border))'}} onClick={()=>setSelectedRole(selectedRole===r.id?null:r.id)}>
            <div className="row" style={{gap:10, marginBottom:6}}>
              <div style={{width:30, height:30, borderRadius:8, background:r.color+'22', color:r.color, display:'grid', placeItems:'center'}}>
                <I.users size={14}/>
              </div>
              <div style={{flex:1}}>
                <strong style={{fontSize:14}}>{r.label}</strong>
                <div className="muted" style={{fontSize:11}}>{counts[r.id] || 0} usuário{(counts[r.id] || 0)!==1?'s':''}</div>
              </div>
            </div>
            <div style={{fontSize:12, color:'hsl(var(--fg-muted))', lineHeight:1.4}}>{r.descr}</div>
          </div>
        ))}
      </div>

      <div className="filters-bar">
        <div className="row" style={{gap:8, flex:1, minWidth:240}}>
          <I.search size={16}/>
          <input className="filter-input" placeholder="Buscar por nome ou e-mail…" value={q} onChange={e=>setQ(e.target.value)} style={{flex:1, border:0, padding:0, background:'transparent'}}/>
        </div>
        {selectedRole && <button className="btn btn-xs btn-ghost" onClick={()=>setSelectedRole(null)}>Limpar filtro</button>}
      </div>

      <div className="card">
        <table className="table">
          <thead><tr>
            <th style={{width:60}}>ID</th><th>Usuário</th><th>Papel</th><th>Time</th><th>Status</th><th>Último acesso</th><th></th>
          </tr></thead>
          <tbody>
            {loading && <tr><td colSpan="7" style={{textAlign:'center', padding:32, color:'hsl(var(--fg-muted))'}}>Carregando…</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan="7" style={{textAlign:'center', padding:32, color:'hsl(var(--fg-muted))'}}>Nenhum usuário.</td></tr>}
            {filtered.map(u => {
              const isYou = u.id === String(window.DATA.CURRENT_USER.id);
              const role = ROLES[u.role] || { label: u.role, color: '#6B7280' };
              return (
                <tr key={u.id}>
                  <td className="mono faint" style={{fontSize:12}}>#{u.id}</td>
                  <td>
                    <div className="row" style={{gap:10}}>
                      <UI.Avatar name={u.name} size={32}/>
                      <div style={{minWidth:0}}>
                        <strong style={{fontSize:13}}>{u.name}</strong>
                        {isYou && <span className="chip primary" style={{marginLeft:6, fontSize:9.5, padding:'1px 5px'}}>Você</span>}
                        <div className="muted mono" style={{fontSize:11}}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <select
                      value={u.role}
                      onChange={e=>changeRole(u, e.target.value)}
                      disabled={isYou}
                      style={{background:role.color+'15', color:role.color, borderColor:role.color+'44', padding:'3px 8px', borderRadius:6, fontSize:11.5, fontWeight:600, border:'1px solid'}}>
                      <option value="admin">Admin</option>
                      <option value="gestor">Gestor</option>
                      <option value="bdr">BDR</option>
                      <option value="vendedor">Vendedor</option>
                      <option value="leitor">Leitor</option>
                    </select>
                  </td>
                  <td style={{fontSize:12.5}}>{u.team}</td>
                  <td>
                    <span className={`chip ${u.status==='ativo'?'success':u.status==='pendente'?'warn':'danger'}`}>
                      <span className="dot"/>{u.status}
                    </span>
                  </td>
                  <td className="muted" style={{fontSize:11.5}}>{u.lastSeen ? fmt.relative(u.lastSeen) : '—'}</td>
                  <td>
                    <div className="row" style={{gap:4, justifyContent:'flex-end'}}>
                      <button className="icon-btn" title={u.status==='ativo'?'Desativar':'Ativar'} onClick={()=>toggleStatus(u)} disabled={isYou}>
                        {u.status==='ativo' ? <I.close size={14}/> : <I.check size={14}/>}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showInvite && <InviteUserModal onClose={()=>setShowInvite(false)} onCreated={()=>{ setShowInvite(false); load(); }}/>}
    </>
  );
}

function InviteUserModal({ onClose, onCreated }) {
  const [nome, setNome] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [role, setRole] = React.useState('bdr');
  const [team, setTeam] = React.useState('');
  const [senha, setSenha] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const [sucesso, setSucesso] = React.useState(null);

  const submit = async () => {
    if (!nome || !email) return;
    setSubmitting(true);
    setErr(null);
    try {
      // 1. Cria com status=pendente
      const novo = await window.API.api('/users/invite', {
        method: 'POST',
        body: { nome, email: email.trim().toLowerCase(), role, team: team || null },
      });
      // 2. Se veio senha, ativa + define
      if (senha && senha.length >= 8) {
        await window.API.api(`/users/${novo.id}`, {
          method: 'PATCH',
          body: { senha, status: 'ativo', is_active: true },
        });
        setSucesso(`Usuário #${novo.id} criado e ativado com senha inicial.`);
      } else {
        setSucesso(`Usuário #${novo.id} criado como PENDENTE (defina senha depois).`);
      }
      setTimeout(onCreated, 1500);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div style={{fontSize:16, fontWeight:700}}>Convidar novo usuário</div>
            <div className="muted" style={{fontSize:12.5, marginTop:2}}>O usuário será criado com status "pendente". Você precisa definir a senha dele depois.</div>
          </div>
          <button className="icon-btn" onClick={onClose}><I.close size={16}/></button>
        </div>
        <div className="modal-body" style={{display:'flex', flexDirection:'column', gap:14}}>
          <div>
            <div className="form-label" style={{fontSize:11, fontWeight:600, color:'hsl(var(--fg-muted))', marginBottom:6, textTransform:'uppercase', letterSpacing:'.04em'}}>Nome completo</div>
            <input className="input" value={nome} onChange={e=>setNome(e.target.value)} placeholder="Ex: João Silva" style={{width:'100%', padding:'9px 12px', border:'1px solid hsl(var(--border))', borderRadius:8, background:'hsl(var(--surface))', color:'hsl(var(--fg))', fontSize:13, outline:'none'}}/>
          </div>
          <div>
            <div className="form-label" style={{fontSize:11, fontWeight:600, color:'hsl(var(--fg-muted))', marginBottom:6, textTransform:'uppercase', letterSpacing:'.04em'}}>E-mail</div>
            <input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="joao@bradata.com.br" style={{width:'100%', padding:'9px 12px', border:'1px solid hsl(var(--border))', borderRadius:8, background:'hsl(var(--surface))', color:'hsl(var(--fg))', fontSize:13, outline:'none'}}/>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
            <div>
              <div className="form-label" style={{fontSize:11, fontWeight:600, color:'hsl(var(--fg-muted))', marginBottom:6, textTransform:'uppercase', letterSpacing:'.04em'}}>Papel</div>
              <select className="input" value={role} onChange={e=>setRole(e.target.value)} style={{width:'100%', padding:'9px 12px', border:'1px solid hsl(var(--border))', borderRadius:8, background:'hsl(var(--surface))', color:'hsl(var(--fg))', fontSize:13, outline:'none'}}>
                <option value="admin">Admin — gerencia time, pipelines, relatórios</option>
                <option value="gestor">Gestor — líder de time</option>
                <option value="bdr">BDR — prospecção e qualificação</option>
                <option value="vendedor">Vendedor — venda e fechamento</option>
                <option value="leitor">Leitor — só leitura</option>
              </select>
            </div>
            <div>
              <div className="form-label" style={{fontSize:11, fontWeight:600, color:'hsl(var(--fg-muted))', marginBottom:6, textTransform:'uppercase', letterSpacing:'.04em'}}>Time (opcional)</div>
              <input className="input" value={team} onChange={e=>setTeam(e.target.value)} placeholder="Sales / SDR / Operações" style={{width:'100%', padding:'9px 12px', border:'1px solid hsl(var(--border))', borderRadius:8, background:'hsl(var(--surface))', color:'hsl(var(--fg))', fontSize:13, outline:'none'}}/>
            </div>
          </div>
          <div>
            <div className="form-label">Senha inicial (opcional — ativa direto)</div>
            <input
              className="input"
              type="password"
              value={senha}
              onChange={e=>setSenha(e.target.value)}
              placeholder="Mínimo 8 caracteres — deixe em branco para criar pendente"
            />
          </div>
          {err && (
            <div style={{padding:'10px 14px', background:'hsl(var(--danger-soft))', color:'hsl(var(--danger))', borderRadius:8, fontSize:12.5, border:'1px solid hsl(var(--danger) / .25)'}}>
              {err}
            </div>
          )}
          {sucesso && (
            <div style={{padding:'10px 14px', background:'hsl(var(--success-soft))', color:'hsl(var(--success))', borderRadius:8, fontSize:12.5, border:'1px solid hsl(var(--success) / .25)'}}>
              ✓ {sucesso}
            </div>
          )}
          {!sucesso && (
            <div style={{padding:'10px 14px', background:'hsl(var(--info-soft))', borderRadius:8, fontSize:12, color:'hsl(var(--info))', lineHeight:1.5}}>
              Se definir a senha aqui, o usuário já entra como <strong>ativo</strong> e pode logar imediatamente.
              Sem senha, fica <strong>pendente</strong> até um admin definir.
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={submitting}>Cancelar</button>
          <button className="btn btn-accent btn-sm" onClick={submit} disabled={submitting || !nome || !email || (senha && senha.length < 8)}>
            {submitting ? 'Criando…' : 'Criar usuário'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Profile permanece simples
function Profile() {
  const { fmt, CURRENT_USER, ROLES } = window.DATA;
  const u = CURRENT_USER;
  const role = ROLES[u.role] || { label: u.role, color: '#6B7280', descr: '' };
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Meu perfil</h1>
          <div className="page-sub">Conta pessoal e preferências</div>
        </div>
      </div>
      <div className="grid-2">
        <div className="card halo">
          <div className="card-p" style={{display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', padding:32}}>
            <UI.Avatar name={u.name} size={80}/>
            <h2 style={{margin:'16px 0 4px'}}>{u.name}</h2>
            <div className="muted mono" style={{fontSize:12}}>{u.email}</div>
            <span className="chip" style={{marginTop:12, background:role.color+'22', color:role.color, borderColor:role.color+'55'}}>{role.label}</span>
            <div className="muted" style={{fontSize:12, marginTop:8}}>{u.team || '—'}</div>
            <div className="divider" style={{width:'100%'}}/>
            <div style={{width:'100%'}}>
              <div className="row-between" style={{fontSize:13, padding:'6px 0'}}><span className="muted">Deals</span><strong>{u.deals || 0}</strong></div>
              <div className="row-between" style={{fontSize:13, padding:'6px 0'}}><span className="muted">Ganhos</span><strong style={{color:'hsl(var(--success))'}}>{u.won || 0}</strong></div>
              <div className="row-between" style={{fontSize:13, padding:'6px 0'}}><span className="muted">Receita</span><strong className="mono">{fmt.brlK(u.revenue || 0)}</strong></div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-head"><div className="card-title">Meu papel</div></div>
          <div className="card-p">
            <div style={{fontSize:14, fontWeight:600, color:role.color, marginBottom:6}}>{role.label}</div>
            <p style={{fontSize:13, color:'hsl(var(--fg-muted))', lineHeight:1.6, margin:'0 0 14px'}}>{role.descr}</p>
            <div className="faint" style={{fontSize:10, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8}}>Permissões</div>
            <ul style={{margin:0, padding:0, listStyle:'none'}}>
              {(role.perms || []).map(p => (
                <li key={p} style={{fontSize:13, display:'flex', gap:8, padding:'6px 0'}}>
                  <I.check size={14} style={{color:role.color, marginTop:2}}/>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}

Object.assign(window, { Users, Profile });
