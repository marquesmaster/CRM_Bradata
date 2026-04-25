// Profile — perfil do usuário logado
// Bradata CRM — screen module
// Globals expected: React, window.DATA, window.I (icons), window.UI (primitives)

function Profile() {
  const { fmt, CURRENT_USER, ROLES, DEALS, COMPANIES } = window.DATA;
  const u = CURRENT_USER;
  const role = ROLES[u.role];
  const myDeals = DEALS.filter(d => d.owner === u.name);

  return (
    <>
      <div className="profile-hero">
        <div className="profile-hero-bg"/>
        <div className="profile-hero-inner">
          <UI.Avatar name={u.name} size={96}/>
          <div style={{flex:1, minWidth:0}}>
            <div className="row" style={{gap:10, marginBottom:4}}>
              <h1 className="page-title" style={{margin:0, color:'white'}}>{u.name}</h1>
              <span className="chip" style={{background:role.color, color:'white', borderColor:'transparent'}}>
                {u.role==='master' && <I.star size={10}/>}
                {role.label}
              </span>
            </div>
            <div className="row" style={{gap:14, color:'hsl(0 0% 100% / .8)', fontSize:13}}>
              <span className="row" style={{gap:6}}><I.mail size={13}/>{u.email}</span>
              <span>·</span>
              <span>{u.team}</span>
              <span>·</span>
              <span>Membro desde {fmt.date(u.createdAt)}</span>
            </div>
          </div>
          <div className="actions">
            <button className="btn btn-ghost btn-sm">Editar perfil</button>
            <button className="btn btn-accent btn-sm"><I.settings size={12}/>Preferências</button>
          </div>
        </div>
      </div>

      <div className="grid-dash">
        <div style={{display:'flex', flexDirection:'column', gap:'var(--gap)'}}>
          {/* Stats */}
          <div className="grid-4">
            <div className="kpi" style={{padding:'16px 18px'}}>
              <div className="label">Deals ativos</div>
              <div className="value" style={{fontSize:26}}>{myDeals.filter(d=>d.stage!=='ganho').length}</div>
              <div className="foot">No pipeline</div>
            </div>
            <div className="kpi" style={{padding:'16px 18px'}}>
              <div className="label">Ganhos</div>
              <div className="value" style={{fontSize:26}}>{u.won}</div>
              <div className="foot">de {u.deals} fechados</div>
            </div>
            <div className="kpi" style={{padding:'16px 18px'}}>
              <div className="label">Receita gerada</div>
              <div className="value" style={{fontSize:26}}>{fmt.brlK(u.revenue)}</div>
              <div className="foot">trimestre atual</div>
            </div>
            <div className="kpi" style={{padding:'16px 18px'}}>
              <div className="label">Win rate</div>
              <div className="value" style={{fontSize:26}}>{u.deals?Math.round((u.won/u.deals)*100):0}%</div>
              <div className="foot">média do time: 38%</div>
            </div>
          </div>

          {/* Activity timeline */}
          <div className="card">
            <div className="card-head"><div className="card-title">Atividade recente</div></div>
            <div className="card-p">
              {[
                {i:'sparkle', t:'Conversou com Bradata AI', s:'Pediu resumo do pipeline', when:'há 15 min'},
                {i:'check', t:'Marcou atividade como concluída', s:'Call com SERPRO', when:'há 2h'},
                {i:'mail', t:'Enviou e-mail', s:'Follow-up para Stefanini', when:'hoje 09:12'},
                {i:'plus', t:'Criou oportunidade', s:'Squad AI/ML — TCU — R$ 1,2M', when:'ontem'},
                {i:'chart', t:'Exportou relatório', s:'Pipeline Q1 2026', when:'há 3 dias'},
              ].map((e,i) => (
                <div key={i} className="timeline-event">
                  <div className="te-ico">{React.createElement(I[e.i], {size:14})}</div>
                  <div className="te-body"><strong>{e.t}</strong><div className="muted">{e.s}</div></div>
                  <div className="te-time">{e.when}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Meus deals */}
          <div className="card">
            <div className="card-head">
              <div className="card-title">Minhas oportunidades</div>
              <span className="chip">{myDeals.length}</span>
            </div>
            <table className="table">
              <thead><tr><th>Deal</th><th>Empresa</th><th>Estágio</th><th>Valor</th></tr></thead>
              <tbody>
                {myDeals.map(d => {
                  const c = COMPANIES[d.company];
                  const s = window.DATA.STAGES.find(s=>s.id===d.stage);
                  return (
                    <tr key={d.id}>
                      <td><strong style={{fontSize:12.5}}>{d.title}</strong></td>
                      <td style={{fontSize:12.5}}>{c?.name}</td>
                      <td><span className="chip" style={{background:s.color+'22', color:s.color, borderColor:s.color+'44', fontSize:10.5}}>{s.label}</span></td>
                      <td><strong className="mono">{fmt.brlK(d.value)}</strong></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{display:'flex', flexDirection:'column', gap:'var(--gap)'}}>
          {/* Permissões do meu papel */}
          <div className="card halo">
            <div className="card-head">
              <div className="row" style={{gap:10}}>
                <div className="role-badge" style={{background:role.color+'22', color:role.color, borderColor:role.color+'55', width:36, height:36}}>
                  {u.role==='master' && <I.star size={16}/>}
                  {u.role==='admin' && <I.target size={16}/>}
                  {u.role==='comum' && <I.users size={16}/>}
                </div>
                <div>
                  <div className="card-title">Meu papel · {role.label}</div>
                  <div className="card-sub">{role.descr}</div>
                </div>
              </div>
            </div>
            <div className="card-p">
              <div className="faint" style={{fontSize:10, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10}}>Permissões ativas</div>
              <ul style={{margin:0, padding:0, listStyle:'none', display:'flex', flexDirection:'column', gap:8}}>
                {role.perms.map(p => (
                  <li key={p} style={{fontSize:13, display:'flex', gap:10, alignItems:'flex-start'}}>
                    <I.check size={14} style={{color: role.color, marginTop:2, flex:'0 0 auto'}}/>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><div className="card-title">Segurança</div></div>
            <div className="card-p">
              <div className="setting-row"><div><strong>Senha</strong><div className="muted" style={{fontSize:11.5}}>Última alteração: há 42 dias</div></div><button className="btn btn-xs btn-ghost">Alterar</button></div>
              <div className="setting-row"><div><strong>Autenticação em dois fatores</strong><div className="muted" style={{fontSize:11.5}}>Autenticador (Google/Authy)</div></div><span className="chip success"><I.check size={10}/>Ativa</span></div>
              <div className="setting-row" style={{borderBottom:'none'}}><div><strong>Sessões ativas</strong><div className="muted" style={{fontSize:11.5}}>MacBook Pro · São Paulo</div></div><button className="btn btn-xs btn-ghost">Ver todas</button></div>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><div className="card-title">Preferências de notificação</div></div>
            <div className="card-p">
              {[
                {l:'Novo lead PNCP detectado', on:true},
                {l:'Deal movido no meu pipeline', on:true},
                {l:'Menção em comentário', on:true},
                {l:'Resumo diário Bradata AI', on:true},
                {l:'E-mails semanais de performance', on:false},
              ].map((p,i,a) => (
                <div key={p.l} style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0', borderBottom:i<a.length-1?'1px solid hsl(var(--border))':'none'}}>
                  <span style={{fontSize:13}}>{p.l}</span>
                  <ProfileToggle on={p.on}/>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function ProfileToggle({ on: initial }) {
  const [on, setOn] = React.useState(initial);
  return (
    <button onClick={()=>setOn(!on)} style={{
      width:38, height:22, borderRadius:99, padding:2,
      background: on?'hsl(var(--b-accent))':'hsl(var(--surface-3))',
      border:0, cursor:'pointer', transition:'.2s', display:'flex', alignItems:'center'
    }}>
      <span style={{width:18, height:18, borderRadius:'50%', background:'white', marginLeft: on?16:0, transition:'.2s', boxShadow:'0 2px 4px rgba(0,0,0,.15)'}}/>
    </button>
  );
}

Object.assign(window, { Users, Profile });

window.Profile = Profile;
