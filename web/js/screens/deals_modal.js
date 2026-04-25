// Modal compartilhado para criar/editar oportunidade
// Usado pelas telas /deals e /pipeline

function DealModal({ deal, onClose, onSaved }) {
  const editing = !!deal?.id;
  const [empresas, setEmpresas] = React.useState([]);
  const [empresaSearch, setEmpresaSearch] = React.useState('');
  const [contatos, setContatos] = React.useState([]);
  const [pipelines, setPipelines] = React.useState([]);
  const [team, setTeam] = React.useState([]);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);

  const [form, setForm] = React.useState(() => ({
    titulo: deal?.titulo || '',
    empresa_id: deal?.empresa_id || null,
    contato_id: deal?.contato_id || null,
    pipeline_id: deal?.pipeline_id || null,
    estagio_id: deal?.estagio_id || null,
    valor_estimado: deal?.valor_estimado || '',
    probabilidade: deal?.probabilidade ?? '',
    data_fechamento_prevista: deal?.data_fechamento_prevista || '',
    descricao: deal?.descricao || '',
    owner_id: deal?.owner_id || null,
    tags: (deal?.tags || []).join(', '),
  }));

  React.useEffect(() => {
    window.API.api('/pipelines').then(ps => {
      setPipelines(ps);
      if (!form.pipeline_id && ps[0]) {
        setForm(f => ({...f, pipeline_id: ps[0].id, estagio_id: ps[0].estagios?.[0]?.id || null}));
      }
    }).catch(()=>{});
    window.API.api('/users/team').then(setTeam).catch(()=>{});
  }, []);

  // Quando pipeline muda, garante que estagio_id é válido
  React.useEffect(() => {
    if (!form.pipeline_id) return;
    const p = pipelines.find(x => x.id === form.pipeline_id);
    if (!p) return;
    if (!p.estagios.some(e => e.id === form.estagio_id)) {
      setForm(f => ({...f, estagio_id: p.estagios[0]?.id || null}));
    }
  }, [form.pipeline_id, pipelines]);

  // Carrega contatos da empresa selecionada
  React.useEffect(() => {
    if (!form.empresa_id) { setContatos([]); return; }
    window.API.api(`/empresas/${form.empresa_id}/contatos`).then(setContatos).catch(()=>{});
  }, [form.empresa_id]);

  // Search empresa
  React.useEffect(() => {
    const q = empresaSearch.trim();
    if (q.length < 2) { setEmpresas([]); return; }
    const t = setTimeout(() => {
      window.API.api(`/empresas?q=${encodeURIComponent(q)}&size=20`)
        .then(p => setEmpresas(p.items || []))
        .catch(()=>{});
    }, 250);
    return () => clearTimeout(t);
  }, [empresaSearch]);

  const set = (k, v) => setForm(f => ({...f, [k]: v}));

  const submit = async () => {
    setErr(null);
    if (!form.titulo.trim()) { setErr('Título é obrigatório'); return; }
    if (!form.empresa_id) { setErr('Selecione uma empresa'); return; }
    if (!form.pipeline_id || !form.estagio_id) { setErr('Selecione pipeline e estágio'); return; }
    setBusy(true);
    try {
      const payload = {
        titulo: form.titulo.trim(),
        empresa_id: Number(form.empresa_id),
        contato_id: form.contato_id ? Number(form.contato_id) : null,
        pipeline_id: Number(form.pipeline_id),
        estagio_id: Number(form.estagio_id),
        valor_estimado: form.valor_estimado === '' ? null : Number(form.valor_estimado),
        probabilidade: form.probabilidade === '' ? null : Number(form.probabilidade),
        data_fechamento_prevista: form.data_fechamento_prevista || null,
        descricao: form.descricao.trim() || null,
        owner_id: form.owner_id ? Number(form.owner_id) : null,
        tags: form.tags ? form.tags.split(',').map(s=>s.trim()).filter(Boolean) : null,
      };
      let saved;
      if (editing) {
        // PATCH não aceita pipeline_id nem empresa_id
        const upd = {...payload};
        delete upd.pipeline_id;
        delete upd.empresa_id;
        saved = await window.API.api(`/oportunidades/${deal.id}`, {
          method: 'PATCH', body: JSON.stringify(upd),
        });
      } else {
        saved = await window.API.api('/oportunidades', {
          method: 'POST', body: JSON.stringify(payload),
        });
      }
      onSaved(saved);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const empresaSelected = form.empresa_id ? empresas.find(e => e.id === form.empresa_id) || deal?.empresa : null;
  const pipeline = pipelines.find(p => p.id === form.pipeline_id);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:600}}>
        <div className="modal-head">
          <div>
            <div className="card-title">{editing ? 'Editar oportunidade' : 'Nova oportunidade'}</div>
            <div className="muted" style={{fontSize:12}}>
              {editing ? `#${deal.id}` : 'Crie um novo deal no pipeline'}
            </div>
          </div>
          <button className="icon-btn" onClick={onClose}><I.x size={16}/></button>
        </div>

        <div className="modal-body" style={{display:'flex', flexDirection:'column', gap:14}}>
          <div>
            <label className="card-section-title">Título *</label>
            <input className="input" value={form.titulo} onChange={e=>set('titulo', e.target.value)}
              placeholder="ex: Bodyshop CTO TI Receita Federal — 8 squads"/>
          </div>

          {!editing && (
            <div>
              <label className="card-section-title">Empresa *</label>
              {!empresaSelected && (
                <>
                  <input className="input" value={empresaSearch} onChange={e=>setEmpresaSearch(e.target.value)}
                    placeholder="Buscar por nome ou CNPJ…"/>
                  {empresas.length > 0 && (
                    <div style={{maxHeight:160, overflowY:'auto', border:'1px solid hsl(var(--border))', borderRadius:8, marginTop:6}}>
                      {empresas.map(e => (
                        <button key={e.id} type="button"
                          onClick={()=>{set('empresa_id', e.id); setEmpresaSearch(''); setEmpresas([]);}}
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
                <div className="row" style={{gap:8, padding:'8px 12px', border:'1px solid hsl(var(--border))', borderRadius:8, background:'hsl(var(--surface-2,var(--surface)))'}}>
                  <UI.Avatar name={empresaSelected.razao_social || empresaSelected.name} size={28}/>
                  <div style={{flex:1, minWidth:0}}>
                    <strong style={{fontSize:13}}>{empresaSelected.razao_social || empresaSelected.name}</strong>
                    <div className="muted mono" style={{fontSize:10}}>{empresaSelected.cnpj}</div>
                  </div>
                  <button className="icon-btn" type="button" onClick={()=>{set('empresa_id', null); setEmpresaSearch('');}}><I.x size={12}/></button>
                </div>
              )}
            </div>
          )}

          <div className="row" style={{gap:10}}>
            <div style={{flex:1}}>
              <label className="card-section-title">Pipeline *</label>
              <select className="input" value={form.pipeline_id || ''} onChange={e=>set('pipeline_id', Number(e.target.value))}
                disabled={editing}>
                {pipelines.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
            <div style={{flex:1}}>
              <label className="card-section-title">Estágio *</label>
              <select className="input" value={form.estagio_id || ''} onChange={e=>set('estagio_id', Number(e.target.value))}>
                {(pipeline?.estagios || []).map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </div>
          </div>

          <div className="row" style={{gap:10}}>
            <div style={{flex:1}}>
              <label className="card-section-title">Valor estimado (R$)</label>
              <input className="input" type="number" min="0" step="1000"
                value={form.valor_estimado} onChange={e=>set('valor_estimado', e.target.value)}
                placeholder="500000"/>
            </div>
            <div style={{width:130}}>
              <label className="card-section-title">Probabilidade %</label>
              <input className="input" type="number" min="0" max="100" step="5"
                value={form.probabilidade} onChange={e=>set('probabilidade', e.target.value)}
                placeholder="50"/>
            </div>
          </div>

          <div className="row" style={{gap:10}}>
            <div style={{flex:1}}>
              <label className="card-section-title">Fechamento previsto</label>
              <input className="input" type="date"
                value={form.data_fechamento_prevista || ''} onChange={e=>set('data_fechamento_prevista', e.target.value)}/>
            </div>
            <div style={{flex:1}}>
              <label className="card-section-title">Responsável</label>
              <select className="input" value={form.owner_id || ''} onChange={e=>set('owner_id', e.target.value || null)}>
                <option value="">— eu mesmo —</option>
                {team.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </div>
          </div>

          {contatos.length > 0 && (
            <div>
              <label className="card-section-title">Contato principal (opcional)</label>
              <select className="input" value={form.contato_id || ''} onChange={e=>set('contato_id', e.target.value || null)}>
                <option value="">— sem contato definido —</option>
                {contatos.map(c => <option key={c.id} value={c.id}>{c.nome}{c.cargo ? ` · ${c.cargo}` : ''}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="card-section-title">Tags (separadas por vírgula)</label>
            <input className="input" value={form.tags} onChange={e=>set('tags', e.target.value)}
              placeholder="bodyshop, gov, urgente"/>
          </div>

          <div>
            <label className="card-section-title">Descrição</label>
            <textarea className="input" rows={3} value={form.descricao} onChange={e=>set('descricao', e.target.value)}
              placeholder="Contexto, escopo previsto, próximos passos..."/>
          </div>

          {err && <div className="login-error" style={{margin:0}}><I.x size={14}/><span>{err}</span></div>}
        </div>

        <div className="modal-foot">
          <button className="btn btn-sm btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-sm btn-accent" onClick={submit} disabled={busy}>
            {busy ? 'Salvando…' : (editing ? 'Salvar' : 'Criar oportunidade')}
          </button>
        </div>
      </div>
    </div>
  );
}

function CloseDealModal({ deal, onClose, onSaved }) {
  // Modal pra fechar deal (ganha/perdida com motivo)
  const [outcome, setOutcome] = React.useState('ganha');
  const [motivo, setMotivo] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const r = await window.API.api(`/oportunidades/${deal.id}/fechar`, {
        method: 'POST',
        body: JSON.stringify({
          status: outcome,
          motivo_perda: outcome === 'perdida' ? motivo.trim() || null : null,
        }),
      });
      onSaved(r);
    } catch (e) { alert(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:440}}>
        <div className="modal-head">
          <div className="card-title">Fechar oportunidade</div>
          <button className="icon-btn" onClick={onClose}><I.x size={16}/></button>
        </div>
        <div className="modal-body" style={{display:'flex', flexDirection:'column', gap:14}}>
          <div className="muted" style={{fontSize:13}}><strong>{deal.titulo}</strong></div>
          <div className="row" style={{gap:8}}>
            <button className={`btn ${outcome==='ganha'?'btn-accent':'btn-ghost'}`} onClick={()=>setOutcome('ganha')} style={{flex:1}}>
              <I.check size={12}/>Ganha
            </button>
            <button className={`btn ${outcome==='perdida'?'btn-accent':'btn-ghost'}`} onClick={()=>setOutcome('perdida')} style={{flex:1}}>
              <I.x size={12}/>Perdida
            </button>
          </div>
          {outcome === 'perdida' && (
            <div>
              <label className="card-section-title">Motivo (opcional)</label>
              <textarea className="input" rows={3} value={motivo} onChange={e=>setMotivo(e.target.value)}
                placeholder="ex: cliente fechou com concorrente, escopo mudou..."/>
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn btn-sm btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-sm btn-accent" onClick={submit} disabled={busy}>
            {busy ? 'Salvando…' : `Marcar como ${outcome}`}
          </button>
        </div>
      </div>
    </div>
  );
}

window.DealModal = DealModal;
window.CloseDealModal = CloseDealModal;
