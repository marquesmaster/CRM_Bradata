// Atividades: CRUD real /atividades + criar/concluir/atribuir
function Activities() {
  const me = window.DATA.CURRENT_USER;
  const meId = Number(me.id);
  const [items, setItems] = React.useState([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [filter, setFilter] = React.useState({ status: 'pendente', tipo: '', overdue: false, mine: 'all' });
  const [editing, setEditing] = React.useState(null);
  const [team, setTeam] = React.useState([]);
  const SIZE = 50;

  const userById = React.useMemo(() => Object.fromEntries(team.map(u => [u.id, u])), [team]);

  const load = React.useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams({ page, size: SIZE });
    if (filter.status) qs.set('status', filter.status);
    if (filter.tipo) qs.set('tipo', filter.tipo);
    if (filter.overdue) qs.set('overdue', 'true');
    if (filter.mine === 'me') qs.set('user_id', meId);
    if (filter.mine === 'assigned') qs.set('assignee_id', meId);
    window.API.api(`/atividades?${qs}`)
      .then(p => { setItems(p.items || []); setTotal(p.total || 0); })
      .finally(() => setLoading(false));
  }, [filter, page, meId]);

  React.useEffect(load, [load]);
  React.useEffect(() => {
    window.API.api('/users/team').then(setTeam).catch(()=>{});
  }, []);

  const toggle = async (a) => {
    const newStatus = a.status === 'concluida' ? 'pendente' : 'concluida';
    // optimistic
    setItems(prev => prev.map(x => x.id === a.id ? {...x, status: newStatus} : x));
    try {
      await window.API.api(`/atividades/${a.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
    } catch (e) {
      setItems(prev => prev.map(x => x.id === a.id ? a : x));
      alert(e.message);
    }
  };

  const onDelete = async (a) => {
    if (!confirm(`Excluir "${a.titulo}"?`)) return;
    try {
      await window.API.api(`/atividades/${a.id}`, { method: 'DELETE' });
      load();
    } catch (e) { alert(e.message); }
  };

  const pendentes = items.filter(a => a.status === 'pendente').length;
  const altas = items.filter(a => a.prioridade === 'alta' && a.status !== 'concluida').length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Atividades</h1>
          <div className="page-sub">
            {total} no total · {pendentes} pendentes nesta página
            {altas > 0 && <> · <strong style={{color:'hsl(var(--danger))'}}>{altas} de alta prioridade</strong></>}
          </div>
        </div>
        <div className="actions">
          <button className="btn btn-accent btn-sm" onClick={()=>setEditing({})}>
            <I.plus size={12}/>Nova atividade
          </button>
        </div>
      </div>

      <div className="filters-bar" style={{display:'flex', gap:12, flexWrap:'wrap', marginBottom:16}}>
        <div className="segment-ctrl" style={{flexWrap:'wrap'}}>
          {[
            ['', 'Todas'], ['pendente','Pendentes'], ['em_andamento','Em andamento'], ['concluida','Concluídas'], ['cancelada','Canceladas'],
          ].map(([k,l]) => (
            <button key={k||'all'} className={filter.status===k?'active':''}
              onClick={()=>{setFilter(f=>({...f, status:k})); setPage(1);}}>{l}</button>
          ))}
        </div>
        <select className="input" style={{width:160, height:32, fontSize:12.5}}
          value={filter.tipo} onChange={e=>{setFilter(f=>({...f, tipo:e.target.value})); setPage(1);}}>
          <option value="">Todos tipos</option>
          {['ligacao','email','reuniao','whatsapp','visita','linkedin','tarefa','outro'].map(t =>
            <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="input" style={{width:160, height:32, fontSize:12.5}}
          value={filter.mine} onChange={e=>{setFilter(f=>({...f, mine:e.target.value})); setPage(1);}}>
          <option value="all">Todos os users</option>
          <option value="me">Criadas por mim</option>
          <option value="assigned">Atribuídas a mim</option>
        </select>
        <label className="row" style={{gap:6, fontSize:12, alignItems:'center'}}>
          <input type="checkbox" checked={filter.overdue} onChange={e=>{setFilter(f=>({...f, overdue:e.target.checked})); setPage(1);}}/>
          Atrasadas
        </label>
      </div>

      <div className="card">
        {loading && <div className="muted" style={{padding:24, textAlign:'center'}}>Carregando…</div>}
        {!loading && items.length === 0 && (
          <div style={{padding:32, textAlign:'center'}}>
            <div className="muted">Nenhuma atividade com esses filtros.</div>
            <button className="btn btn-sm btn-accent" style={{marginTop:10}} onClick={()=>setEditing({})}>
              <I.plus size={12}/>Criar agora
            </button>
          </div>
        )}
        {!loading && items.map((a, i) => {
          const isOverdue = a.due_date && new Date(a.due_date) < new Date() && a.status !== 'concluida';
          const owner = userById[a.user_id]?.nome || '—';
          const assignee = userById[a.assignee_id]?.nome;
          return (
            <div key={a.id} style={{display:'grid', gridTemplateColumns:'auto 1fr auto auto', gap:14, padding:'14px 20px',
              borderBottom: i < items.length-1 ? '1px solid hsl(var(--border))' : 'none',
              alignItems:'center', background: isOverdue ? 'hsl(var(--danger-soft))' : 'transparent'}}>
              <button onClick={()=>toggle(a)} style={{
                width:22, height:22, borderRadius:6, border:'1.5px solid hsl(var(--border))',
                background: a.status==='concluida' ? 'hsl(var(--success))' : 'transparent',
                display:'grid', placeItems:'center', cursor:'pointer', flex:'0 0 auto',
              }}>
                {a.status==='concluida' && <I.check size={12} style={{color:'white'}}/>}
              </button>
              <div style={{minWidth:0}}>
                <button className="link" onClick={()=>setEditing(a)} style={{
                  background:'none', border:0, padding:0, textAlign:'left', cursor:'pointer',
                  fontWeight:600, fontSize:13.5,
                  textDecoration: a.status==='concluida' ? 'line-through' : 'none',
                  color: a.status==='concluida' ? 'hsl(var(--fg-muted))' : 'hsl(var(--fg))',
                  width:'100%', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                }}>{a.titulo}</button>
                <div className="row" style={{gap:8, marginTop:4, fontSize:11.5, flexWrap:'wrap'}}>
                  <span className="chip" style={{fontSize:10, padding:'1px 6px'}}>{a.tipo}</span>
                  {a.direcao === 'enviado' && <span className="chip primary" style={{fontSize:10}}>📤 enviado</span>}
                  {a.direcao === 'recebido' && <span className="chip success" style={{fontSize:10}}>📩 recebido</span>}
                  {a.prioridade === 'alta' && <span className="chip danger" style={{fontSize:10}}>Alta</span>}
                  {a.prioridade === 'urgente' && <span className="chip danger" style={{fontSize:10}}>🔥 Urgente</span>}
                  {isOverdue && <span className="chip danger" style={{fontSize:10}}>Atrasada</span>}
                  <span className="muted">por {owner}{assignee && assignee !== owner ? ` → ${assignee}` : ''}</span>
                  {a.empresa_id && (
                    <button className="link muted" style={{background:'none', border:0, padding:0, cursor:'pointer', fontSize:11.5}}
                      onClick={()=>window.__nav('lead', String(a.empresa_id))}>ver empresa →</button>
                  )}
                </div>
                {a.descricao && <div className="muted" style={{fontSize:11.5, marginTop:4, maxWidth:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{a.descricao}</div>}
              </div>
              <div style={{textAlign:'right', fontSize:12, lineHeight:1.4}}>
                {a.due_date && (<>
                  <div style={{fontWeight:600, color: isOverdue ? 'hsl(var(--danger))' : 'hsl(var(--fg))'}}>
                    {new Date(a.due_date).toLocaleDateString('pt-BR', {day:'2-digit', month:'short'})}
                  </div>
                  <div className="muted" style={{fontSize:11}}>
                    {new Date(a.due_date).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}
                  </div>
                </>)}
                {!a.due_date && a.data_atividade && (
                  <div className="muted" style={{fontSize:11}}>
                    {new Date(a.data_atividade).toLocaleDateString('pt-BR')}
                  </div>
                )}
              </div>
              <div className="row" style={{gap:4}}>
                <button className="btn btn-xs btn-ghost" title="Editar" onClick={()=>setEditing(a)}><I.sliders size={11}/></button>
                <button className="btn btn-xs btn-ghost" title="Excluir" onClick={()=>onDelete(a)} style={{color:'hsl(var(--danger))'}}><I.x size={11}/></button>
              </div>
            </div>
          );
        })}
      </div>

      <Paginator page={page} total={total} size={SIZE} onPage={setPage}/>

      {editing && <ActivityModal atividade={editing.id ? editing : null}
        team={team} onClose={()=>setEditing(null)} onSaved={()=>{setEditing(null); load();}}/>}
    </>
  );
}

function ActivityModal({ atividade, team, onClose, onSaved }) {
  const editing = !!atividade?.id;
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);

  const [form, setForm] = React.useState(() => ({
    tipo: atividade?.tipo || 'tarefa',
    titulo: atividade?.titulo || '',
    descricao: atividade?.descricao || '',
    status: atividade?.status || 'pendente',
    prioridade: atividade?.prioridade || 'media',
    due_date: atividade?.due_date ? toDatetimeLocal(atividade.due_date) : '',
    data_atividade: atividade?.data_atividade ? toDatetimeLocal(atividade.data_atividade) : '',
    duracao_min: atividade?.duracao_min || '',
    resultado: atividade?.resultado || '',
    empresa_id: atividade?.empresa_id || null,
    contato_id: atividade?.contato_id || null,
    oportunidade_id: atividade?.oportunidade_id || null,
    assignee_id: atividade?.assignee_id || null,
  }));

  const [empresaSearch, setEmpresaSearch] = React.useState('');
  const [empresas, setEmpresas] = React.useState([]);
  const [empresaSelected, setEmpresaSelected] = React.useState(null);
  const [contatos, setContatos] = React.useState([]);

  React.useEffect(() => {
    // Quando edita, busca empresa atual pra mostrar o nome
    if (atividade?.empresa_id && !empresaSelected) {
      window.API.api(`/empresas/${atividade.empresa_id}`)
        .then(setEmpresaSelected).catch(()=>{});
    }
  }, [atividade?.empresa_id]);

  React.useEffect(() => {
    const q = empresaSearch.trim();
    if (q.length < 2) { setEmpresas([]); return; }
    const t = setTimeout(() => {
      window.API.api(`/empresas?q=${encodeURIComponent(q)}&size=20`)
        .then(p => setEmpresas(p.items || [])).catch(()=>{});
    }, 250);
    return () => clearTimeout(t);
  }, [empresaSearch]);

  React.useEffect(() => {
    if (!form.empresa_id) { setContatos([]); return; }
    window.API.api(`/empresas/${form.empresa_id}/contatos`).then(setContatos).catch(()=>{});
  }, [form.empresa_id]);

  const set = (k, v) => setForm(f => ({...f, [k]: v}));

  const submit = async () => {
    setErr(null);
    if (!form.titulo.trim()) { setErr('Título é obrigatório'); return; }
    setBusy(true);
    try {
      const payload = {
        tipo: form.tipo,
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim() || null,
        status: form.status,
        prioridade: form.prioridade,
        due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
        data_atividade: form.data_atividade ? new Date(form.data_atividade).toISOString() : null,
        duracao_min: form.duracao_min === '' ? null : Number(form.duracao_min),
        resultado: form.resultado.trim() || null,
        empresa_id: form.empresa_id ? Number(form.empresa_id) : null,
        contato_id: form.contato_id ? Number(form.contato_id) : null,
        oportunidade_id: form.oportunidade_id ? Number(form.oportunidade_id) : null,
        assignee_id: form.assignee_id ? Number(form.assignee_id) : null,
      };
      if (editing) {
        // Não pode mudar empresa_id em PATCH (não tá no schema update)
        const upd = {...payload};
        delete upd.empresa_id;
        delete upd.contato_id;
        delete upd.oportunidade_id;
        delete upd.tipo;
        await window.API.api(`/atividades/${atividade.id}`, { method:'PATCH', body: JSON.stringify(upd) });
      } else {
        await window.API.api('/atividades', { method:'POST', body: JSON.stringify(payload) });
      }
      onSaved();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:600}}>
        <div className="modal-head">
          <div>
            <div className="card-title">{editing ? 'Editar atividade' : 'Nova atividade'}</div>
            {editing && <div className="muted" style={{fontSize:12}}>#{atividade.id}</div>}
          </div>
          <button className="icon-btn" onClick={onClose}><I.x size={16}/></button>
        </div>

        <div className="modal-body" style={{display:'flex', flexDirection:'column', gap:14}}>
          <div className="row" style={{gap:10}}>
            <div style={{flex:1}}>
              <label className="card-section-title">Tipo *</label>
              <select className="input" value={form.tipo} onChange={e=>set('tipo', e.target.value)} disabled={editing}>
                {['ligacao','email','reuniao','whatsapp','visita','linkedin','tarefa','outro'].map(t =>
                  <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div style={{flex:1}}>
              <label className="card-section-title">Prioridade</label>
              <select className="input" value={form.prioridade} onChange={e=>set('prioridade', e.target.value)}>
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
            <div style={{flex:1}}>
              <label className="card-section-title">Status</label>
              <select className="input" value={form.status} onChange={e=>set('status', e.target.value)}>
                <option value="pendente">Pendente</option>
                <option value="em_andamento">Em andamento</option>
                <option value="concluida">Concluída</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>
          </div>

          <div>
            <label className="card-section-title">Título *</label>
            <input className="input" value={form.titulo} onChange={e=>set('titulo', e.target.value)}
              placeholder="ex: Ligar pra CTO da Stefanini sobre RFP"/>
          </div>

          <div className="row" style={{gap:10}}>
            <div style={{flex:1}}>
              <label className="card-section-title">Vencimento (due date)</label>
              <input className="input" type="datetime-local" value={form.due_date} onChange={e=>set('due_date', e.target.value)}/>
            </div>
            <div style={{flex:1}}>
              <label className="card-section-title">Data da atividade (executada em)</label>
              <input className="input" type="datetime-local" value={form.data_atividade} onChange={e=>set('data_atividade', e.target.value)}/>
            </div>
          </div>

          <div className="row" style={{gap:10}}>
            <div style={{flex:1}}>
              <label className="card-section-title">Atribuída a</label>
              <select className="input" value={form.assignee_id || ''} onChange={e=>set('assignee_id', e.target.value || null)}>
                <option value="">— eu mesmo —</option>
                {team.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </div>
            <div style={{width:140}}>
              <label className="card-section-title">Duração (min)</label>
              <input className="input" type="number" min="0" step="5" value={form.duracao_min} onChange={e=>set('duracao_min', e.target.value)} placeholder="30"/>
            </div>
          </div>

          {!editing && (
            <div>
              <label className="card-section-title">Empresa (opcional)</label>
              {!empresaSelected && (
                <>
                  <input className="input" value={empresaSearch} onChange={e=>setEmpresaSearch(e.target.value)} placeholder="Buscar empresa…"/>
                  {empresas.length > 0 && (
                    <div style={{maxHeight:140, overflowY:'auto', border:'1px solid hsl(var(--border))', borderRadius:8, marginTop:6}}>
                      {empresas.map(e => (
                        <button key={e.id} type="button"
                          onClick={()=>{set('empresa_id', e.id); setEmpresaSelected(e); setEmpresaSearch(''); setEmpresas([]);}}
                          style={{width:'100%', textAlign:'left', padding:'8px 12px', background:'transparent', border:0, borderBottom:'1px solid hsl(var(--border))', cursor:'pointer', fontSize:12.5}}>
                          <strong>{e.razao_social}</strong>
                          <div className="muted mono" style={{fontSize:10}}>{e.cnpj} · {e.uf}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
              {empresaSelected && (
                <div className="row" style={{gap:8, padding:'8px 12px', border:'1px solid hsl(var(--border))', borderRadius:8}}>
                  <UI.Avatar name={empresaSelected.razao_social || empresaSelected.nome_fantasia} size={26}/>
                  <div style={{flex:1, minWidth:0}}><strong style={{fontSize:13}}>{empresaSelected.razao_social || empresaSelected.nome_fantasia}</strong></div>
                  <button className="icon-btn" onClick={()=>{set('empresa_id', null); set('contato_id', null); setEmpresaSelected(null);}}><I.x size={12}/></button>
                </div>
              )}
            </div>
          )}

          {!editing && contatos.length > 0 && (
            <div>
              <label className="card-section-title">Contato (opcional)</label>
              <select className="input" value={form.contato_id || ''} onChange={e=>set('contato_id', e.target.value || null)}>
                <option value="">— sem contato —</option>
                {contatos.map(c => <option key={c.id} value={c.id}>{c.nome}{c.cargo ? ` · ${c.cargo}` : ''}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="card-section-title">Descrição</label>
            <textarea className="input" rows={3} value={form.descricao} onChange={e=>set('descricao', e.target.value)}
              placeholder="Notas, contexto, links..."/>
          </div>

          <div>
            <label className="card-section-title">Resultado (após executar)</label>
            <textarea className="input" rows={2} value={form.resultado} onChange={e=>set('resultado', e.target.value)}
              placeholder="ex: ligação caiu, agendou nova reunião, decisor não disponível..."/>
          </div>

          {err && <div className="login-error" style={{margin:0}}><I.x size={14}/><span>{err}</span></div>}

          {editing && <EntityHistoryPanel entityType="atividade" entityId={atividade.id} title="Histórico desta atividade"/>}
        </div>

        <div className="modal-foot">
          <button className="btn btn-sm btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-sm btn-accent" onClick={submit} disabled={busy}>
            {busy ? 'Salvando…' : (editing ? 'Salvar' : 'Criar atividade')}
          </button>
        </div>
      </div>
    </div>
  );
}

function toDatetimeLocal(iso) {
  const d = new Date(iso);
  const pad = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

window.Activities = Activities;
window.ActivityModal = ActivityModal;
