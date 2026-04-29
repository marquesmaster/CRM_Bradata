// /tickets — chamados/suporte com filtros + detalhe inline com comentários
function Tickets() {
  const me = window.DATA.CURRENT_USER;
  const meId = Number(me.id);
  const [items, setItems] = React.useState([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [filter, setFilter] = React.useState({ status: '', kind: '', mine: 'all', overdue: false });
  const [page, setPage] = React.useState(1);
  const [editing, setEditing] = React.useState(null);
  const [team, setTeam] = React.useState([]);
  const SIZE = 50;

  const load = React.useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams({ page, size: SIZE });
    if (filter.status) qs.set('status', filter.status);
    if (filter.kind) qs.set('kind', filter.kind);
    if (filter.overdue) qs.set('overdue', 'true');
    if (filter.mine === 'requester') qs.set('requester_user_id', meId);
    if (filter.mine === 'assignee') qs.set('assignee_user_id', meId);
    window.API.api(`/tickets?${qs}`)
      .then(p => { setItems(p.items || []); setTotal(p.total || 0); })
      .finally(()=>setLoading(false));
  }, [filter, page, meId]);

  React.useEffect(load, [load]);
  React.useEffect(() => { window.API.api('/users/team').then(setTeam).catch(()=>{}); }, []);

  const statusColor = {
    aberto: 'hsl(var(--info))',
    em_andamento: 'hsl(var(--warning))',
    aguardando_cliente: 'hsl(var(--b-accent))',
    resolvido: 'hsl(var(--success))',
    fechado: 'hsl(var(--fg-muted))',
  };
  const prioColor = {
    baixa: 'hsl(var(--fg-muted))',
    media: 'hsl(var(--info))',
    alta: 'hsl(var(--warning))',
    urgente: 'hsl(var(--danger))',
  };

  const stats = items.reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {});

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Tickets</h1>
          <div className="page-sub">
            {total} no total · {stats.aberto || 0} abertos · {stats.em_andamento || 0} em andamento · {stats.resolvido || 0} resolvidos
          </div>
        </div>
        <div className="actions">
          <button className="btn btn-accent btn-sm" onClick={()=>setEditing({})}><I.plus size={12}/>Novo ticket</button>
        </div>
      </div>

      <div className="filters-bar" style={{display:'flex', gap:12, alignItems:'center', flexWrap:'wrap', marginBottom:14}}>
        <div className="segment-ctrl">
          {[['','Todos'],['aberto','Abertos'],['em_andamento','Em andamento'],['aguardando_cliente','Aguardando'],['resolvido','Resolvidos'],['fechado','Fechados']].map(([k,l])=>(
            <button key={k||'all'} className={filter.status===k?'active':''} onClick={()=>{setFilter(f=>({...f,status:k})); setPage(1);}}>{l}</button>
          ))}
        </div>
        <select className="input" style={{width:160, height:32, fontSize:12.5}} value={filter.kind} onChange={e=>{setFilter(f=>({...f,kind:e.target.value})); setPage(1);}}>
          <option value="">Todos tipos</option>
          {['suporte','duvida','problema','melhoria','interno'].map(k => <option key={k} value={k}>{k}</option>)}
        </select>
        <select className="input" style={{width:170, height:32, fontSize:12.5}} value={filter.mine} onChange={e=>{setFilter(f=>({...f,mine:e.target.value})); setPage(1);}}>
          <option value="all">Todos os users</option>
          <option value="requester">Abertos por mim</option>
          <option value="assignee">Atribuídos a mim</option>
        </select>
        <label className="row" style={{gap:6, fontSize:12, alignItems:'center'}}>
          <input type="checkbox" checked={filter.overdue} onChange={e=>{setFilter(f=>({...f,overdue:e.target.checked})); setPage(1);}}/>
          SLA estourado
        </label>
      </div>

      <div className="card">
        {loading && (
          <div style={{padding:'14px 18px', display:'flex', flexDirection:'column', gap:10}}>
            {Array.from({length:5}).map((_,i) => <Skeleton key={i} height={56}/>)}
          </div>
        )}
        {!loading && items.length === 0 && (
          <EmptyState
            icon={<I.help size={22}/>}
            title="Nenhum ticket"
            description="Ajuste os filtros ou crie o primeiro ticket."
            action={<button className="btn btn-accent btn-sm" onClick={()=>setEditing({})}><I.plus size={11}/>Novo ticket</button>}
          />
        )}
        {!loading && items.length > 0 && (
          <table className="table">
            <thead><tr>
              <th>#</th><th>Título</th><th>Tipo</th><th>Prioridade</th><th>Status</th><th>Responsável</th><th>SLA</th>
            </tr></thead>
            <tbody>
              {items.map(t => {
                const slaOverdue = t.sla_due_at && new Date(t.sla_due_at) < new Date() && !['resolvido','fechado'].includes(t.status);
                return (
                  <tr key={t.id} onClick={()=>setEditing(t)} style={{cursor:'pointer', background: slaOverdue ? 'hsl(var(--danger-soft))' : ''}}>
                    <td className="mono muted" style={{fontSize:11}}>#{t.id}</td>
                    <td>
                      <strong style={{fontSize:13}}>{t.titulo}</strong>
                      {t.descricao && <div className="muted" style={{fontSize:11, marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:400}}>{t.descricao}</div>}
                    </td>
                    <td><span className="chip" style={{fontSize:10}}>{t.kind}</span></td>
                    <td><span className="chip" style={{fontSize:10, background:`${prioColor[t.prioridade]}22`, color:prioColor[t.prioridade]}}>{t.prioridade}</span></td>
                    <td><span className="chip" style={{fontSize:10, background:`${statusColor[t.status]}22`, color:statusColor[t.status]}}>{t.status}</span></td>
                    <td>{t.assignee ? <span style={{fontSize:12}}>{t.assignee.nome}</span> : <span className="muted">—</span>}</td>
                    <td className="muted" style={{fontSize:11.5, color: slaOverdue?'hsl(var(--danger))':undefined}}>
                      {t.sla_due_at ? new Date(t.sla_due_at).toLocaleString('pt-BR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Paginator page={page} total={total} size={SIZE} onPage={setPage}/>

      {editing && <TicketModal ticket={editing.id ? editing : null} team={team}
        onClose={()=>setEditing(null)} onSaved={()=>{setEditing(null); load();}}/>}
    </>
  );
}

function TicketModal({ ticket, team, onClose, onSaved }) {
  const editing = !!ticket?.id;
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const [comments, setComments] = React.useState([]);
  const [draft, setDraft] = React.useState('');
  const [form, setForm] = React.useState(() => ({
    titulo: ticket?.titulo || '',
    descricao: ticket?.descricao || '',
    kind: ticket?.kind || 'suporte',
    prioridade: ticket?.prioridade || 'media',
    status: ticket?.status || 'aberto',
    assignee_user_id: ticket?.assignee?.id || '',
    sla_due_at: ticket?.sla_due_at ? toLocal(ticket.sla_due_at) : '',
  }));

  React.useEffect(() => {
    if (editing) {
      window.API.api(`/tickets/${ticket.id}`).then(d => setComments(d.comments || []));
    }
  }, [editing]);

  const set = (k,v) => setForm(f => ({...f, [k]: v}));

  const submit = async () => {
    if (!form.titulo.trim()) { setErr('Título obrigatório'); return; }
    setBusy(true); setErr(null);
    try {
      const payload = {
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim() || null,
        kind: form.kind,
        prioridade: form.prioridade,
        assignee_user_id: form.assignee_user_id ? Number(form.assignee_user_id) : null,
        sla_due_at: form.sla_due_at ? new Date(form.sla_due_at).toISOString() : null,
      };
      if (editing) {
        payload.status = form.status;
        await window.API.api(`/tickets/${ticket.id}`, { method:'PATCH', body: payload });
      } else {
        await window.API.api('/tickets', { method:'POST', body: payload });
      }
      onSaved();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const addComment = async () => {
    if (!draft.trim() || !editing) return;
    try {
      const c = await window.API.api(`/tickets/${ticket.id}/comments`, {
        method:'POST', body: { conteudo: draft.trim() },
      });
      setComments(prev => [...prev, c]);
      setDraft('');
    } catch (e) { window.toast.error(e.message); }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:680, maxHeight:'88vh', display:'flex', flexDirection:'column'}}>
        <div className="modal-head">
          <div>
            <div className="card-title">{editing ? `Ticket #${ticket.id}` : 'Novo ticket'}</div>
            {editing && <div className="muted" style={{fontSize:12}}>{ticket.kind} · {ticket.status}</div>}
          </div>
          <button className="icon-btn" onClick={onClose}><I.x size={16}/></button>
        </div>
        <div className="modal-body" style={{display:'flex', flexDirection:'column', gap:12, overflowY:'auto'}}>
          <div>
            <label className="card-section-title">Título *</label>
            <input className="input" value={form.titulo} onChange={e=>set('titulo', e.target.value)}/>
          </div>
          <div className="row" style={{gap:10}}>
            <div style={{flex:1}}>
              <label className="card-section-title">Tipo</label>
              <select className="input" value={form.kind} onChange={e=>set('kind', e.target.value)}>
                {['suporte','duvida','problema','melhoria','interno'].map(k=><option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div style={{flex:1}}>
              <label className="card-section-title">Prioridade</label>
              <select className="input" value={form.prioridade} onChange={e=>set('prioridade', e.target.value)}>
                {['baixa','media','alta','urgente'].map(k=><option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            {editing && (
              <div style={{flex:1}}>
                <label className="card-section-title">Status</label>
                <select className="input" value={form.status} onChange={e=>set('status', e.target.value)}>
                  {['aberto','em_andamento','aguardando_cliente','resolvido','fechado'].map(k=><option key={k} value={k}>{k}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="row" style={{gap:10}}>
            <div style={{flex:1}}>
              <label className="card-section-title">Atribuir para</label>
              <select className="input" value={form.assignee_user_id} onChange={e=>set('assignee_user_id', e.target.value)}>
                <option value="">—</option>
                {team.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </div>
            <div style={{flex:1}}>
              <label className="card-section-title">SLA (vencimento)</label>
              <input className="input" type="datetime-local" value={form.sla_due_at} onChange={e=>set('sla_due_at', e.target.value)}/>
            </div>
          </div>
          <div>
            <label className="card-section-title">Descrição</label>
            <textarea className="input" rows={4} value={form.descricao} onChange={e=>set('descricao', e.target.value)}
              placeholder="Contexto, passos, links…"/>
          </div>
          {err && <div className="login-error" style={{margin:0}}><I.x size={14}/><span>{err}</span></div>}

          {editing && <EntityHistoryPanel entityType="ticket" entityId={ticket.id} title="Histórico"/>}

          {editing && (
            <>
              <div style={{borderTop:'1px solid hsl(var(--border))', paddingTop:12, marginTop:6}}>
                <strong style={{fontSize:13}}>Comentários ({comments.length})</strong>
                <div style={{marginTop:8, display:'flex', flexDirection:'column', gap:8, maxHeight:240, overflowY:'auto'}}>
                  {comments.map(c => (
                    <div key={c.id} style={{padding:'8px 12px', background:'hsl(var(--surface-2,var(--surface)))', borderRadius:6, fontSize:12.5}}>
                      <div className="muted" style={{fontSize:11, marginBottom:3}}><strong>{c.user_nome}</strong> · {new Date(c.created_at).toLocaleString('pt-BR')}</div>
                      <div style={{whiteSpace:'pre-wrap'}}>{c.conteudo}</div>
                    </div>
                  ))}
                  {comments.length === 0 && <div className="muted" style={{fontSize:12, textAlign:'center', padding:8}}>Sem comentários ainda.</div>}
                </div>
                <div style={{display:'flex', gap:8, marginTop:8}}>
                  <textarea className="input" rows={2} value={draft} onChange={e=>setDraft(e.target.value)}
                    onKeyDown={e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();addComment();}}}
                    placeholder="Comentário (Ctrl+Enter envia)" style={{flex:1, resize:'vertical', fontFamily:'inherit'}}/>
                  <button className="btn btn-sm btn-accent" onClick={addComment} disabled={!draft.trim()}>Enviar</button>
                </div>
              </div>
            </>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn btn-sm btn-ghost" onClick={onClose}>Fechar</button>
          <button className="btn btn-sm btn-accent" onClick={submit} disabled={busy}>
            {busy ? 'Salvando…' : (editing ? 'Salvar' : 'Criar ticket')}
          </button>
        </div>
      </div>
    </div>
  );
}

function toLocal(iso) {
  const d = new Date(iso);
  const pad = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

window.Tickets = Tickets;
