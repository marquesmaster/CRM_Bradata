// /automacoes — CRUD completo de automações com editor visual de cadência
function Automacoes() {
  const { fmt } = window.DATA;
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [editing, setEditing] = React.useState(null);
  const [running, setRunning] = React.useState(false);

  const load = () => {
    setLoading(true);
    window.API.api('/automacoes')
      .then(r => setItems(r || []))
      .finally(() => setLoading(false));
  };
  React.useEffect(() => { load(); }, []);

  const toggle = async (a) => {
    try {
      const r = await window.API.api(`/automacoes/${a.id}`, {
        method: 'PATCH', body: JSON.stringify({ ativo: !a.ativo }),
      });
      setItems(xs => xs.map(x => x.id===a.id ? r : x));
    } catch (e) { alert(e.message); }
  };

  const remove = async (a) => {
    if (!confirm(`Remover automação "${a.nome}"?`)) return;
    try {
      await window.API.api(`/automacoes/${a.id}`, { method: 'DELETE' });
      setItems(xs => xs.filter(x => x.id !== a.id));
    } catch (e) { alert(e.message); }
  };

  const runCadenciaNow = async () => {
    if (!confirm('Executar todas as cadências ativas agora?\n\nIsso vai disparar e-mails reais.')) return;
    setRunning(true);
    try {
      await window.API.api('/automacoes/cadencia/run-now', { method: 'POST' });
      alert('Cadência agendada em background. Veja os logs / atividades nos próximos minutos.');
    } catch (e) { alert(e.message); }
    finally { setRunning(false); }
  };

  const kindMeta = {
    template_email:      { label: 'Template de e-mail', icon: '📧', color: 'hsl(var(--info))' },
    template_whatsapp:   { label: 'Template de WhatsApp', icon: '💬', color: 'hsl(var(--success))' },
    alerta_inatividade:  { label: 'Alerta de inatividade', icon: '⏰', color: 'hsl(var(--warning))' },
    alerta_sla:          { label: 'Alerta de SLA', icon: '🚨', color: 'hsl(var(--danger))' },
    cadencia_followup:   { label: 'Cadência follow-up', icon: '🔁', color: 'hsl(var(--b-accent))' },
    regra_score_empresa: { label: 'Regra de score', icon: '📊', color: 'hsl(var(--info))' },
  };

  const cadenciaCount = items.filter(a => a.kind === 'cadencia_followup' && a.ativo).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Automações</h1>
          <div className="page-sub">{items.filter(a=>a.ativo).length} ativas · {items.length} no total{cadenciaCount > 0 && <> · <strong>{cadenciaCount} cadência{cadenciaCount===1?'':'s'} ligada{cadenciaCount===1?'':'s'}</strong></>}</div>
        </div>
        <div className="actions">
          {cadenciaCount > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={runCadenciaNow} disabled={running}>
              <I.refresh size={12}/>{running ? 'Disparando…' : 'Rodar cadência agora'}
            </button>
          )}
          <button className="btn btn-accent btn-sm" onClick={()=>setEditing({})}>
            <I.plus size={12}/>Nova automação
          </button>
        </div>
      </div>

      {loading && <div style={{padding:40, textAlign:'center'}} className="muted">Carregando…</div>}

      {!loading && items.length === 0 && (
        <div className="card empty-state" style={{padding:60, textAlign:'center'}}>
          <div style={{fontSize:40, marginBottom:12}}>⚡</div>
          <h3 style={{margin:'0 0 6px'}}>Nenhuma automação</h3>
          <p className="muted" style={{marginBottom:16}}>Crie templates de e-mail, alertas de SLA ou cadências de follow-up.</p>
          <button className="btn btn-accent btn-sm" onClick={()=>setEditing({})}><I.plus size={12}/>Criar primeira</button>
        </div>
      )}

      <div className="grid-2">
        {items.map(a => {
          const meta = kindMeta[a.kind] || {};
          const passos = a.config?.passos || [];
          return (
            <div key={a.id} className="card">
              <div className="card-head">
                <div style={{minWidth:0}}>
                  <div className="card-title" style={{display:'flex', alignItems:'center', gap:6}}>
                    <span>{meta.icon}</span>
                    <span style={{overflow:'hidden', textOverflow:'ellipsis'}}>{a.nome}</span>
                  </div>
                  <div className="card-sub">{meta.label || a.kind}</div>
                </div>
                <div className="row" style={{gap:4}}>
                  <button className="icon-btn" title={a.ativo?'Desativar':'Ativar'} onClick={()=>toggle(a)}>
                    {a.ativo
                      ? <span style={{width:32, height:18, borderRadius:9, background:'hsl(var(--success))', display:'inline-block', position:'relative'}}>
                          <span style={{width:14, height:14, background:'white', borderRadius:'50%', position:'absolute', top:2, right:2}}/>
                        </span>
                      : <span style={{width:32, height:18, borderRadius:9, background:'hsl(var(--surface-3))', display:'inline-block', position:'relative'}}>
                          <span style={{width:14, height:14, background:'white', borderRadius:'50%', position:'absolute', top:2, left:2}}/>
                        </span>}
                  </button>
                  <button className="icon-btn" title="Editar" onClick={()=>setEditing(a)}><I.sliders size={14}/></button>
                  <button className="icon-btn" title="Excluir" onClick={()=>remove(a)} style={{color:'hsl(var(--danger))'}}><I.x size={14}/></button>
                </div>
              </div>
              <div className="card-p">
                {a.descricao && <p style={{fontSize:13, marginTop:0, color:'hsl(var(--fg-muted))'}}>{a.descricao}</p>}

                {/* Templates de e-mail/whatsapp */}
                {(a.kind==='template_email' || a.kind==='template_whatsapp') && (
                  <>
                    {a.assunto && <div style={{fontSize:12.5, marginBottom:6}}><strong>Assunto:</strong> {a.assunto}</div>}
                    {a.corpo && <div style={{fontSize:12.5, whiteSpace:'pre-wrap', padding:10, background:'hsl(var(--surface-2,var(--surface)))', borderRadius:6, maxHeight:120, overflow:'auto', border:'1px solid hsl(var(--border))'}}>{a.corpo}</div>}
                  </>
                )}

                {/* Cadência: lista de passos */}
                {a.kind === 'cadencia_followup' && (
                  <div>
                    <div className="card-section-title" style={{marginBottom:6}}>{passos.length} passo{passos.length===1?'':'s'}</div>
                    {passos.length === 0 && <div className="muted" style={{fontSize:12}}>Sem passos. Edite pra configurar.</div>}
                    {passos.map((p, i) => (
                      <div key={i} style={{display:'flex', gap:8, alignItems:'center', padding:'6px 0', borderTop: i>0 ? '1px dashed hsl(var(--border))' : 'none'}}>
                        <span style={{width:22, height:22, borderRadius:'50%', background:meta.color+'22', color:meta.color, display:'grid', placeItems:'center', fontSize:11, fontWeight:700}}>
                          {i+1}
                        </span>
                        <span style={{fontSize:12.5}}>D+{p.dias_apos_ultima_atividade}</span>
                        <span className="muted" style={{fontSize:11.5, flex:1}}>→ template #{p.template_id}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="row-between" style={{marginTop:10, fontSize:11, color:'hsl(var(--fg-faint))'}}>
                  <span>Executada {a.executada_n_vezes}×</span>
                  <span>{a.ultima_execucao ? 'Última: ' + fmt.relative(a.ultima_execucao) : 'Nunca executada'}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {editing && <AutomacaoModal automacao={editing.id ? editing : null}
        templates={items.filter(x => x.kind === 'template_email' && x.ativo)}
        onClose={()=>setEditing(null)} onSaved={()=>{setEditing(null); load();}}/>}
    </>
  );
}

function AutomacaoModal({ automacao, templates, onClose, onSaved }) {
  const editing = !!automacao?.id;
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const [team, setTeam] = React.useState([]);

  const [form, setForm] = React.useState(() => ({
    nome: automacao?.nome || '',
    kind: automacao?.kind || 'template_email',
    descricao: automacao?.descricao || '',
    ativo: automacao?.ativo ?? true,
    assunto: automacao?.assunto || '',
    corpo: automacao?.corpo || '',
    // Cadência:
    passos: automacao?.config?.passos ? [...automacao.config.passos] : [
      { dias_apos_ultima_atividade: 3, template_id: '' },
    ],
    filtro_decisor: automacao?.config?.filtro?.decisor ?? false,
    filtro_fonte: automacao?.config?.filtro?.fonte || '',
    smtp_user_id: automacao?.config?.smtp_user_id || '',
  }));

  React.useEffect(() => {
    window.API.api('/users/team').then(setTeam).catch(()=>{});
  }, []);

  const set = (k, v) => setForm(f => ({...f, [k]: v}));

  const setPasso = (i, k, v) => setForm(f => ({
    ...f,
    passos: f.passos.map((p, idx) => idx === i ? {...p, [k]: v} : p),
  }));

  const addPasso = () => setForm(f => ({
    ...f,
    passos: [...f.passos, {
      dias_apos_ultima_atividade: (f.passos[f.passos.length-1]?.dias_apos_ultima_atividade || 3) + 4,
      template_id: '',
    }],
  }));

  const removePasso = (i) => setForm(f => ({
    ...f, passos: f.passos.filter((_, idx) => idx !== i),
  }));

  const submit = async () => {
    setErr(null);
    if (!form.nome.trim()) { setErr('Nome é obrigatório'); return; }

    let payload = {
      nome: form.nome.trim(),
      kind: form.kind,
      descricao: form.descricao.trim() || null,
      ativo: form.ativo,
    };
    if (form.kind === 'template_email' || form.kind === 'template_whatsapp') {
      payload.assunto = form.assunto.trim() || null;
      payload.corpo = form.corpo.trim() || null;
      if (!payload.corpo) { setErr('Template precisa de corpo'); return; }
    }
    if (form.kind === 'cadencia_followup') {
      const passos = form.passos
        .filter(p => p.template_id && p.dias_apos_ultima_atividade != null)
        .map(p => ({
          dias_apos_ultima_atividade: Number(p.dias_apos_ultima_atividade),
          template_id: Number(p.template_id),
        }));
      if (passos.length === 0) { setErr('Cadência precisa de pelo menos 1 passo com template'); return; }
      const filtro = {};
      if (form.filtro_decisor) filtro.decisor = true;
      if (form.filtro_fonte) filtro.fonte = form.filtro_fonte;
      payload.config = {
        passos,
        ...(Object.keys(filtro).length ? { filtro } : {}),
        ...(form.smtp_user_id ? { smtp_user_id: Number(form.smtp_user_id) } : {}),
      };
    }

    setBusy(true);
    try {
      if (editing) {
        const upd = {...payload};
        delete upd.kind;  // imutável
        await window.API.api(`/automacoes/${automacao.id}`, { method:'PATCH', body: JSON.stringify(upd) });
      } else {
        await window.API.api('/automacoes', { method:'POST', body: JSON.stringify(payload) });
      }
      onSaved();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const isCadencia = form.kind === 'cadencia_followup';
  const isTemplate = form.kind === 'template_email' || form.kind === 'template_whatsapp';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{maxWidth:680}} onClick={e=>e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="card-title">{editing ? 'Editar automação' : 'Nova automação'}</div>
            {editing && <div className="muted" style={{fontSize:12}}>#{automacao.id}</div>}
          </div>
          <button className="icon-btn" onClick={onClose}><I.x size={16}/></button>
        </div>

        <div className="modal-body" style={{display:'flex', flexDirection:'column', gap:14}}>
          <div className="row" style={{gap:10}}>
            <div style={{flex:2}}>
              <label className="card-section-title">Nome *</label>
              <input className="input" value={form.nome} onChange={e=>set('nome', e.target.value)}
                placeholder="Follow-up 3 dias sem resposta"/>
            </div>
            <div style={{flex:1}}>
              <label className="card-section-title">Tipo *</label>
              <select className="input" value={form.kind} onChange={e=>set('kind', e.target.value)} disabled={editing}>
                <option value="template_email">📧 Template de e-mail</option>
                <option value="template_whatsapp">💬 Template de WhatsApp</option>
                <option value="cadencia_followup">🔁 Cadência follow-up</option>
                <option value="alerta_inatividade">⏰ Alerta de inatividade</option>
                <option value="alerta_sla">🚨 Alerta de SLA</option>
                <option value="regra_score_empresa">📊 Regra de score</option>
              </select>
            </div>
          </div>

          <div>
            <label className="card-section-title">Descrição</label>
            <input className="input" value={form.descricao} onChange={e=>set('descricao', e.target.value)}
              placeholder="Para uso interno — explica o objetivo"/>
          </div>

          {isTemplate && (
            <>
              <div>
                <label className="card-section-title">Assunto</label>
                <input className="input" value={form.assunto} onChange={e=>set('assunto', e.target.value)}
                  placeholder="Olá {{nome}}, soube que a {{empresa}} venceu..."/>
              </div>
              <div>
                <label className="card-section-title">Corpo · {`{{nome}}`}, {`{{empresa}}`}, {`{{cargo}}`}, {`{{remetente}}`}</label>
                <textarea className="input" rows={8} value={form.corpo} onChange={e=>set('corpo', e.target.value)}
                  placeholder="Oi {{nome}},&#10;&#10;Vi que a {{empresa}} ganhou um novo contrato..."
                  style={{resize:'vertical', fontFamily:'inherit'}}/>
              </div>
            </>
          )}

          {isCadencia && (
            <>
              <div className="card" style={{padding:12, background:'hsl(var(--surface-2, var(--surface)))', border:'1px dashed hsl(var(--border))'}}>
                <div className="row-between" style={{marginBottom:10}}>
                  <strong style={{fontSize:13}}>Passos da cadência</strong>
                  <button className="btn btn-xs btn-accent" onClick={addPasso}><I.plus size={10}/>Adicionar passo</button>
                </div>
                <div className="muted" style={{fontSize:12, marginBottom:10}}>
                  Cada passo dispara X dias após a última atividade do contato. Ordem importa: o sistema escolhe o primeiro passo cujo prazo já passou e que ainda não foi enviado.
                </div>
                {form.passos.map((p, i) => (
                  <div key={i} style={{display:'grid', gridTemplateColumns:'auto 100px 1fr auto', gap:10, alignItems:'center', padding:'8px 0', borderTop: i>0 ? '1px dashed hsl(var(--border))' : 'none'}}>
                    <span style={{width:26, height:26, borderRadius:'50%', background:'hsl(var(--b-accent))', color:'white', display:'grid', placeItems:'center', fontSize:12, fontWeight:700}}>
                      {i+1}
                    </span>
                    <div className="row" style={{gap:4, alignItems:'center'}}>
                      <span className="muted" style={{fontSize:11}}>D+</span>
                      <input className="input" type="number" min="0" max="365" style={{width:60, height:30, fontSize:12}}
                        value={p.dias_apos_ultima_atividade} onChange={e=>setPasso(i, 'dias_apos_ultima_atividade', e.target.value)}/>
                      <span className="muted" style={{fontSize:11}}>dias</span>
                    </div>
                    <select className="input" style={{height:30, fontSize:12}} value={p.template_id} onChange={e=>setPasso(i, 'template_id', e.target.value)}>
                      <option value="">— Selecione template e-mail —</option>
                      {templates.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                    </select>
                    <button className="icon-btn" onClick={()=>removePasso(i)} title="Remover" style={{color:'hsl(var(--danger))'}}><I.x size={12}/></button>
                  </div>
                ))}
                {form.passos.length === 0 && <div className="muted" style={{fontSize:12, textAlign:'center', padding:8}}>Adicione o primeiro passo</div>}
                {templates.length === 0 && (
                  <div style={{padding:'10px 12px', borderRadius:8, fontSize:12, marginTop:10, background:'hsl(var(--warning-soft))', color:'hsl(var(--warning))', border:'1px solid hsl(var(--warning) / .25)'}}>
                    ⚠️ Você ainda não tem templates de e-mail ativos. Crie um (tipo "Template de e-mail") antes de configurar a cadência.
                  </div>
                )}
              </div>

              <div className="card" style={{padding:12, background:'hsl(var(--surface-2, var(--surface)))', border:'1px dashed hsl(var(--border))'}}>
                <strong style={{fontSize:13, marginBottom:10, display:'block'}}>Quem entra na cadência (filtros)</strong>
                <div className="row" style={{gap:14, alignItems:'center', flexWrap:'wrap'}}>
                  <label className="row" style={{gap:6, fontSize:12.5}}>
                    <input type="checkbox" checked={form.filtro_decisor} onChange={e=>set('filtro_decisor', e.target.checked)}/>
                    Apenas decisores
                  </label>
                  <div className="row" style={{gap:6, alignItems:'center'}}>
                    <span style={{fontSize:12.5}}>Fonte:</span>
                    <select className="input" style={{height:30, fontSize:12, width:140}} value={form.filtro_fonte} onChange={e=>set('filtro_fonte', e.target.value)}>
                      <option value="">Qualquer</option>
                      <option value="lusha">Lusha</option>
                      <option value="manual">Manual</option>
                      <option value="cnpjws">CNPJ.WS</option>
                      <option value="linkedin">LinkedIn</option>
                    </select>
                  </div>
                </div>
                <div style={{marginTop:12}}>
                  <span style={{fontSize:12.5}}>Enviar como (sender):</span>
                  <select className="input" style={{height:30, fontSize:12, marginTop:4}}
                    value={form.smtp_user_id} onChange={e=>set('smtp_user_id', e.target.value)}>
                    <option value="">Owner do contato (ou empresa, ou admin)</option>
                    {team.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                  </select>
                </div>
              </div>
            </>
          )}

          <label className="row" style={{gap:6, fontSize:13}}>
            <input type="checkbox" checked={form.ativo} onChange={e=>set('ativo', e.target.checked)}/>
            Ativar imediatamente
          </label>

          {err && <div className="login-error" style={{margin:0}}><I.x size={14}/><span>{err}</span></div>}
        </div>
        <div className="modal-foot">
          <button className="btn btn-sm btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-sm btn-accent" onClick={submit} disabled={busy}>
            {busy ? 'Salvando…' : (editing ? 'Salvar' : 'Criar')}
          </button>
        </div>
      </div>
    </div>
  );
}

window.Automacoes = Automacoes;
