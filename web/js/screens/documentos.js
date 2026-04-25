// /documentos — admin: lista templates DOCX + permite upload e teste de geração
function Documentos() {
  const [templates, setTemplates] = React.useState([]);
  const [docs, setDocs] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [showUpload, setShowUpload] = React.useState(false);
  const [generating, setGenerating] = React.useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      window.API.api('/documentos/templates'),
      window.API.api('/documentos?limit=50'),
    ]).then(([t, d]) => { setTemplates(t); setDocs(d); })
      .finally(() => setLoading(false));
  };
  React.useEffect(load, []);

  const remove = async (t) => {
    if (!confirm(`Remover template "${t.nome}"?`)) return;
    try {
      await window.API.api(`/documentos/templates/${t.id}`, { method: 'DELETE' });
      load();
    } catch (e) { alert(e.message); }
  };

  const removeDoc = async (d) => {
    if (!confirm(`Remover documento gerado "${d.nome}"?`)) return;
    try {
      await window.API.api(`/documentos/${d.id}`, { method: 'DELETE' });
      load();
    } catch (e) { alert(e.message); }
  };

  const kindIcon = { contrato: '📄', proposta: '📋', aditivo: '✏️', nda: '🔒', outro: '📁' };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Documentos</h1>
          <div className="page-sub">{templates.length} templates · {docs.length} gerados recentes</div>
        </div>
        <div className="actions">
          <button className="btn btn-accent btn-sm" onClick={()=>setShowUpload(true)}>
            <I.plus size={12}/>Subir template DOCX
          </button>
        </div>
      </div>

      {loading && <div className="muted" style={{padding:32, textAlign:'center'}}>Carregando…</div>}

      {!loading && templates.length === 0 && (
        <div className="card empty-state" style={{padding:60, textAlign:'center'}}>
          <div style={{fontSize:40, marginBottom:12}}>📄</div>
          <h3 style={{margin:'0 0 6px'}}>Nenhum template ainda</h3>
          <p className="muted" style={{marginBottom:16, maxWidth:520, marginLeft:'auto', marginRight:'auto', fontSize:13.5}}>
            Suba um <code>.docx</code> com placeholders Jinja como <code>{`{{ empresa.razao_social }}`}</code>, <code>{`{{ deal.valor }}`}</code>, <code>{`{{ contato.nome }}`}</code>. O sistema preenche automaticamente quando você gerar contratos/propostas a partir de um deal.
          </p>
          <button className="btn btn-accent btn-sm" onClick={()=>setShowUpload(true)}>
            <I.plus size={12}/>Subir primeiro template
          </button>
        </div>
      )}

      {!loading && templates.length > 0 && (
        <div className="grid-2" style={{marginBottom:'var(--gap)'}}>
          {templates.map(t => (
            <div key={t.id} className="card">
              <div className="card-head">
                <div>
                  <div className="card-title" style={{display:'flex', alignItems:'center', gap:6}}>
                    <span>{kindIcon[t.kind] || '📁'}</span>
                    <span>{t.nome}</span>
                  </div>
                  <div className="card-sub">{t.kind} · {t.file_name_original}</div>
                </div>
                <div className="row" style={{gap:4}}>
                  <button className="icon-btn" title="Gerar documento de teste" onClick={()=>setGenerating(t)}><I.send size={14}/></button>
                  <button className="icon-btn" title="Excluir" onClick={()=>remove(t)} style={{color:'hsl(var(--danger))'}}><I.x size={14}/></button>
                </div>
              </div>
              <div className="card-p">
                {t.descricao && <p className="muted" style={{fontSize:13, margin:'0 0 10px'}}>{t.descricao}</p>}
                <div className="card-section-title">Variáveis detectadas ({(t.variaveis_disponiveis||[]).length})</div>
                <div className="row" style={{gap:4, flexWrap:'wrap', marginTop:6}}>
                  {(t.variaveis_disponiveis || []).slice(0, 12).map(v => (
                    <span key={v.nome} className="chip" style={{fontSize:10, fontFamily:'JetBrains Mono, monospace'}}>{`{{${v.nome}}}`}</span>
                  ))}
                  {(t.variaveis_disponiveis || []).length > 12 && (
                    <span className="muted" style={{fontSize:10.5}}>+{t.variaveis_disponiveis.length - 12}</span>
                  )}
                  {(t.variaveis_disponiveis || []).length === 0 && (
                    <span className="muted" style={{fontSize:11.5}}>Nenhuma variável detectada</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && docs.length > 0 && (
        <div className="card">
          <div className="card-head"><div className="card-title">Documentos gerados (recentes)</div></div>
          <table className="table">
            <thead><tr><th>Nome</th><th>Empresa</th><th>Quando</th><th></th></tr></thead>
            <tbody>
              {docs.map(d => (
                <tr key={d.id}>
                  <td><strong style={{fontSize:12.5}}>{d.nome}</strong></td>
                  <td>
                    {d.empresa_id ? (
                      <button className="link" style={{background:'none', border:0, padding:0, cursor:'pointer', fontSize:12, color:'hsl(var(--b-accent))'}}
                        onClick={()=>window.__nav('lead', String(d.empresa_id))}>ver empresa</button>
                    ) : <span className="muted">—</span>}
                  </td>
                  <td className="muted" style={{fontSize:11.5}}>{new Date(d.created_at).toLocaleString('pt-BR')}</td>
                  <td>
                    <div className="row" style={{gap:4, justifyContent:'flex-end'}}>
                      <a href={`/api/v1/documentos/${d.id}/download`} className="icon-btn" title="Download" target="_blank" rel="noreferrer"><I.download size={12}/></a>
                      <button className="icon-btn" onClick={()=>removeDoc(d)} title="Excluir" style={{color:'hsl(var(--danger))'}}><I.x size={12}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showUpload && <UploadTemplateModal onClose={()=>setShowUpload(false)} onSaved={()=>{setShowUpload(false); load();}}/>}
      {generating && <GerarDocumentoModal template={generating} onClose={()=>setGenerating(null)} onGenerated={(d)=>{setGenerating(null); load(); setTimeout(()=>window.open(`/api/v1/documentos/${d.id}/download`,'_blank'), 100);}}/>}
    </>
  );
}

function UploadTemplateModal({ onClose, onSaved }) {
  const [nome, setNome] = React.useState('');
  const [kind, setKind] = React.useState('contrato');
  const [descricao, setDescricao] = React.useState('');
  const [file, setFile] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);

  const submit = async () => {
    if (!file) { setErr('Selecione um arquivo .docx'); return; }
    if (!nome.trim()) { setErr('Nome obrigatório'); return; }
    setBusy(true); setErr(null);
    try {
      const fd = new FormData();
      fd.append('nome', nome);
      fd.append('kind', kind);
      if (descricao) fd.append('descricao', descricao);
      fd.append('file', file);
      const token = window.API.auth.token();
      const r = await fetch('/api/v1/documentos/templates', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: fd,
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(t || 'Erro');
      }
      onSaved();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:560}}>
        <div className="modal-head">
          <div className="card-title">Novo template DOCX</div>
          <button className="icon-btn" onClick={onClose}><I.x size={16}/></button>
        </div>
        <div className="modal-body" style={{display:'flex', flexDirection:'column', gap:14}}>
          <div>
            <label className="card-section-title">Nome *</label>
            <input className="input" value={nome} onChange={e=>setNome(e.target.value)} placeholder="Contrato Bodyshop CTO Bradata"/>
          </div>
          <div>
            <label className="card-section-title">Tipo *</label>
            <select className="input" value={kind} onChange={e=>setKind(e.target.value)}>
              <option value="contrato">📄 Contrato</option>
              <option value="proposta">📋 Proposta</option>
              <option value="aditivo">✏️ Aditivo</option>
              <option value="nda">🔒 NDA</option>
              <option value="outro">📁 Outro</option>
            </select>
          </div>
          <div>
            <label className="card-section-title">Descrição</label>
            <input className="input" value={descricao} onChange={e=>setDescricao(e.target.value)} placeholder="Modelo padrão, jurídico aprovado..."/>
          </div>
          <div>
            <label className="card-section-title">Arquivo .docx *</label>
            <input className="input" type="file" accept=".docx" onChange={e=>setFile(e.target.files?.[0])}/>
            <div className="muted" style={{fontSize:11.5, marginTop:6}}>
              Use placeholders Jinja: <code>{`{{ empresa.razao_social }}`}</code>, <code>{`{{ deal.valor }}`}</code>, <code>{`{{ contato.nome }}`}</code>, <code>{`{{ data_hoje }}`}</code>
            </div>
          </div>
          {err && <div className="login-error" style={{margin:0}}><I.x size={14}/><span>{err}</span></div>}
        </div>
        <div className="modal-foot">
          <button className="btn btn-sm btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-sm btn-accent" onClick={submit} disabled={busy}>
            {busy ? 'Subindo…' : 'Subir template'}
          </button>
        </div>
      </div>
    </div>
  );
}

function GerarDocumentoModal({ template, onClose, onGenerated }) {
  const [empresaSearch, setEmpresaSearch] = React.useState('');
  const [empresas, setEmpresas] = React.useState([]);
  const [empresa, setEmpresa] = React.useState(null);
  const [oportunidade, setOportunidade] = React.useState(null);
  const [oportunidades, setOportunidades] = React.useState([]);
  const [extras, setExtras] = React.useState({});
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);

  // search empresa
  React.useEffect(() => {
    const q = empresaSearch.trim();
    if (q.length < 2) { setEmpresas([]); return; }
    const t = setTimeout(() => {
      window.API.api(`/empresas?q=${encodeURIComponent(q)}&size=10`)
        .then(p => setEmpresas(p.items || [])).catch(()=>{});
    }, 250);
    return () => clearTimeout(t);
  }, [empresaSearch]);

  // ao escolher empresa, carrega oportunidades dela
  React.useEffect(() => {
    if (!empresa) { setOportunidades([]); return; }
    window.API.api(`/oportunidades?empresa_id=${empresa.id}&size=20`)
      .then(p => setOportunidades(p.items || [])).catch(()=>{});
  }, [empresa]);

  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await window.API.api('/documentos/gerar', {
        method: 'POST',
        body: {
          template_id: template.id,
          empresa_id: empresa?.id,
          oportunidade_id: oportunidade?.id,
          extras: Object.keys(extras).length > 0 ? extras : null,
        },
      });
      onGenerated(r);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  // Variáveis customizadas que aparecem no template mas não estão no contexto padrão
  const standardKeys = new Set(['data_hoje','data_iso','agora','empresa','deal','proposta','remetente']);
  const customVars = (template.variaveis_disponiveis || [])
    .filter(v => !standardKeys.has(v.nome.split('.')[0]));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:560}}>
        <div className="modal-head">
          <div>
            <div className="card-title">Gerar: {template.nome}</div>
            <div className="muted" style={{fontSize:12}}>{template.kind}</div>
          </div>
          <button className="icon-btn" onClick={onClose}><I.x size={16}/></button>
        </div>
        <div className="modal-body" style={{display:'flex', flexDirection:'column', gap:14}}>
          <div>
            <label className="card-section-title">Empresa</label>
            {!empresa && (
              <>
                <input className="input" value={empresaSearch} onChange={e=>setEmpresaSearch(e.target.value)} placeholder="Buscar por nome ou CNPJ…"/>
                {empresas.length > 0 && (
                  <div style={{maxHeight:160, overflowY:'auto', border:'1px solid hsl(var(--border))', borderRadius:8, marginTop:6}}>
                    {empresas.map(e => (
                      <button key={e.id} type="button"
                        onClick={()=>{setEmpresa(e); setEmpresaSearch(''); setEmpresas([]);}}
                        style={{width:'100%', textAlign:'left', padding:'8px 12px', background:'transparent', border:0, borderBottom:'1px solid hsl(var(--border))', cursor:'pointer', fontSize:12.5}}>
                        <strong>{e.razao_social}</strong>
                        <div className="muted mono" style={{fontSize:10}}>{e.cnpj} · {e.uf}</div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            {empresa && (
              <div className="row" style={{gap:8, padding:'8px 12px', border:'1px solid hsl(var(--border))', borderRadius:8}}>
                <UI.Avatar name={empresa.razao_social} size={28}/>
                <div style={{flex:1, minWidth:0}}><strong style={{fontSize:13}}>{empresa.razao_social}</strong></div>
                <button className="icon-btn" onClick={()=>{setEmpresa(null); setOportunidade(null);}}><I.x size={12}/></button>
              </div>
            )}
          </div>

          {empresa && oportunidades.length > 0 && (
            <div>
              <label className="card-section-title">Oportunidade (opcional)</label>
              <select className="input" value={oportunidade?.id || ''} onChange={e=>setOportunidade(oportunidades.find(o => o.id == e.target.value))}>
                <option value="">— sem oportunidade —</option>
                {oportunidades.map(o => <option key={o.id} value={o.id}>{o.titulo} · R$ {(o.valor_estimado || 0).toLocaleString('pt-BR')}</option>)}
              </select>
            </div>
          )}

          {customVars.length > 0 && (
            <div>
              <label className="card-section-title">Variáveis customizadas do template</label>
              <div style={{display:'flex', flexDirection:'column', gap:8}}>
                {customVars.map(v => (
                  <div key={v.nome}>
                    <div style={{fontSize:11, fontWeight:600, marginBottom:3}}>{v.label || v.nome}</div>
                    <input className="input" value={extras[v.nome] || ''} onChange={e=>setExtras({...extras, [v.nome]: e.target.value})}
                      placeholder={`{{ ${v.nome} }}`}/>
                  </div>
                ))}
              </div>
            </div>
          )}

          {err && <div className="login-error" style={{margin:0}}><I.x size={14}/><span>{err}</span></div>}
        </div>
        <div className="modal-foot">
          <button className="btn btn-sm btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-sm btn-accent" onClick={submit} disabled={busy}>
            <I.download size={12}/>{busy ? 'Gerando…' : 'Gerar e baixar'}
          </button>
        </div>
      </div>
    </div>
  );
}

window.Documentos = Documentos;
window.GerarDocumentoModal = GerarDocumentoModal;
