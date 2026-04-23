// /automacoes — CRUD de automações/templates
function Automacoes() {
  const { fmt } = window.DATA;
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [showModal, setShowModal] = React.useState(false);

  const load = () => {
    setLoading(true);
    window.API.api('/automacoes')
      .then(r => setItems(r || []))
      .finally(() => setLoading(false));
  };
  React.useEffect(() => { load(); }, []);

  const toggle = async (a) => {
    try {
      const r = await window.API.api(`/automacoes/${a.id}`, { method: 'PATCH', body: { ativo: !a.ativo } });
      setItems(xs => xs.map(x => x.id===a.id ? r : x));
    } catch (e) { alert(e.message); }
  };

  const remove = async (a) => {
    if (!confirm('Remover automação "' + a.nome + '"?')) return;
    try {
      await window.API.api(`/automacoes/${a.id}`, { method: 'DELETE' });
      setItems(xs => xs.filter(x => x.id !== a.id));
    } catch (e) { alert(e.message); }
  };

  const kindLabel = {
    template_email: '📧 Template de e-mail',
    template_whatsapp: '💬 Template de WhatsApp',
    alerta_inatividade: '⏰ Alerta de inatividade',
    alerta_sla: '🚨 Alerta de SLA',
    cadencia_followup: '🔁 Cadência follow-up',
    regra_score_empresa: '📊 Regra de score',
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Automações</h1>
          <div className="page-sub">{items.filter(a=>a.ativo).length} ativas · {items.length} no total</div>
        </div>
        <div className="actions">
          <button className="btn btn-accent btn-sm" onClick={()=>setShowModal(true)}><I.plus size={12}/>Nova automação</button>
        </div>
      </div>

      {loading && <div style={{padding:40, textAlign:'center', color:'hsl(var(--fg-muted))'}}>Carregando…</div>}

      {!loading && items.length === 0 && (
        <div className="card empty-state" style={{padding:60, textAlign:'center'}}>
          <div style={{fontSize:40, marginBottom:12}}>⚡</div>
          <h3 style={{margin:'0 0 6px'}}>Nenhuma automação</h3>
          <p className="muted" style={{marginBottom:16}}>Crie templates de e-mail, alertas de SLA ou cadências de follow-up.</p>
          <button className="btn btn-accent btn-sm" onClick={()=>setShowModal(true)}><I.plus size={12}/>Criar primeira</button>
        </div>
      )}

      <div className="grid-2">
        {items.map(a => (
          <div key={a.id} className="card">
            <div className="card-head">
              <div>
                <div className="card-title">{a.nome}</div>
                <div className="card-sub">{kindLabel[a.kind] || a.kind}</div>
              </div>
              <div className="row" style={{gap:6}}>
                <span className={`chip ${a.ativo?'success':''}`}>{a.ativo?'ativa':'inativa'}</span>
                <button className="icon-btn" title={a.ativo?'Desativar':'Ativar'} onClick={()=>toggle(a)}>
                  {a.ativo ? <I.close size={14}/> : <I.check size={14}/>}
                </button>
                <button className="icon-btn" onClick={()=>remove(a)}><I.close size={14}/></button>
              </div>
            </div>
            <div className="card-p">
              {a.descricao && <p style={{fontSize:13, marginTop:0, color:'hsl(var(--fg-muted))'}}>{a.descricao}</p>}
              {a.assunto && <div style={{fontSize:12.5, marginBottom:6}}><strong>Assunto:</strong> {a.assunto}</div>}
              {a.corpo && <div style={{fontSize:12.5, whiteSpace:'pre-wrap', padding:10, background:'hsl(var(--surface-2))', borderRadius:6, maxHeight:120, overflow:'auto'}}>{a.corpo}</div>}
              <div className="row-between" style={{marginTop:10, fontSize:11, color:'hsl(var(--fg-faint))'}}>
                <span>Executada {a.executada_n_vezes}×</span>
                <span>{a.ultima_execucao ? 'Última: ' + fmt.relative(a.ultima_execucao) : '—'}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && <NewAutomacaoModal onClose={()=>setShowModal(false)} onCreated={()=>{ setShowModal(false); load(); }}/>}
    </>
  );
}

function NewAutomacaoModal({ onClose, onCreated }) {
  const [nome, setNome] = React.useState('');
  const [kind, setKind] = React.useState('template_email');
  const [descricao, setDescricao] = React.useState('');
  const [assunto, setAssunto] = React.useState('');
  const [corpo, setCorpo] = React.useState('');

  const submit = async () => {
    try {
      await window.API.api('/automacoes', {
        method: 'POST',
        body: { nome, kind, descricao, assunto, corpo, ativo: true },
      });
      onCreated();
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{maxWidth:600}} onClick={e=>e.stopPropagation()}>
        <div className="modal-head">
          <div style={{fontSize:16, fontWeight:700}}>Nova automação</div>
          <button className="icon-btn" onClick={onClose}><I.close size={16}/></button>
        </div>
        <div className="modal-body" style={{display:'flex', flexDirection:'column', gap:14}}>
          <FormField label="Nome">
            <input className="input" value={nome} onChange={e=>setNome(e.target.value)} placeholder="Follow-up 3 dias sem resposta"/>
          </FormField>
          <FormField label="Tipo">
            <select className="input" value={kind} onChange={e=>setKind(e.target.value)}>
              <option value="template_email">Template de e-mail</option>
              <option value="template_whatsapp">Template de WhatsApp</option>
              <option value="alerta_inatividade">Alerta de inatividade</option>
              <option value="alerta_sla">Alerta de SLA</option>
              <option value="cadencia_followup">Cadência follow-up</option>
              <option value="regra_score_empresa">Regra de score empresa</option>
            </select>
          </FormField>
          <FormField label="Descrição">
            <input className="input" value={descricao} onChange={e=>setDescricao(e.target.value)}/>
          </FormField>
          {(kind==='template_email' || kind==='template_whatsapp') && (
            <>
              <FormField label="Assunto">
                <input className="input" value={assunto} onChange={e=>setAssunto(e.target.value)}/>
              </FormField>
              <FormField label="Corpo da mensagem">
                <textarea className="input" rows="5" value={corpo} onChange={e=>setCorpo(e.target.value)} style={{resize:'vertical'}}/>
              </FormField>
            </>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancelar</button>
          <button className="btn btn-accent btn-sm" onClick={submit} disabled={!nome}>Criar</button>
        </div>
      </div>
    </div>
  );
}

window.Automacoes = Automacoes;
