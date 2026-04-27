// /propostas — listagem de propostas
function Propostas({ dealId }) {
  const { fmt, DEALS, COMPANIES } = window.DATA;
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [showModal, setShowModal] = React.useState(false);

  const load = React.useCallback(() => {
    setLoading(true);
    const params = dealId ? `?oportunidade_id=${dealId}` : '';
    window.API.api('/propostas' + params)
      .then(r => { setItems(r || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [dealId]);

  React.useEffect(() => { load(); }, [load]);

  const filtered = items.filter(p => statusFilter === 'all' || p.status === statusFilter);

  const dealTitles = {};
  DEALS.forEach(d => { dealTitles[d.id] = d; });

  const statusColor = {
    rascunho: '',
    enviada: 'info',
    em_analise: 'warn',
    aceita: 'success',
    rejeitada: 'danger',
    expirada: '',
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Propostas{dealId && ' do deal #' + dealId}</h1>
          <div className="page-sub">{filtered.length} propostas · {filtered.filter(p=>p.status==='aceita').length} aceitas</div>
        </div>
        <div className="actions">
          {dealId && <button className="btn btn-ghost btn-sm" onClick={()=>window.__nav('deals')}>← Todos os deals</button>}
          <button className="btn btn-accent btn-sm" onClick={()=>setShowModal(true)}><I.plus size={12}/>Nova proposta</button>
        </div>
      </div>

      <div className="filters-bar">
        <div className="segment-ctrl">
          {['all','rascunho','enviada','em_analise','aceita','rejeitada'].map(s => (
            <button key={s} className={statusFilter===s?'active':''} onClick={()=>setStatusFilter(s)} style={{textTransform:'capitalize'}}>
              {s==='all'?'Todas':s.replace('_',' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <table className="table">
          <thead><tr>
            <th>#</th><th>Título</th><th>Deal</th><th>Empresa</th><th>Valor</th><th>Status</th><th>Enviada</th><th>Validade</th><th></th>
          </tr></thead>
          <tbody>
            {loading && <tr><td colSpan="9" style={{textAlign:'center', padding:32, color:'hsl(var(--fg-muted))'}}>Carregando…</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan="9" style={{textAlign:'center', padding:32, color:'hsl(var(--fg-muted))'}}>Nenhuma proposta.</td></tr>}
            {filtered.map(p => {
              const deal = dealTitles[String(p.oportunidade_id)];
              const empresa = deal ? COMPANIES[deal.company] : null;
              return (
                <tr key={p.id}>
                  <td className="mono faint">#{p.numero || p.id}{p.versao > 1 && ` v${p.versao}`}</td>
                  <td><strong style={{fontSize:12.5}}>{p.titulo}</strong></td>
                  <td style={{fontSize:12}}>{deal?.title || `#${p.oportunidade_id}`}</td>
                  <td style={{fontSize:12}}>{empresa?.name || '—'}</td>
                  <td><strong className="mono">{fmt.brlK(p.valor_total)}</strong></td>
                  <td><span className={`chip ${statusColor[p.status]||''}`} style={{textTransform:'capitalize'}}>{p.status.replace('_',' ')}</span></td>
                  <td className="muted" style={{fontSize:12}}>{fmt.date(p.enviada_em)}</td>
                  <td className="muted" style={{fontSize:12}}>{fmt.date(p.validade_em)}</td>
                  <td><button className="btn btn-xs btn-ghost" onClick={()=>window.__nav('proposta', p.id)}>Abrir</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showModal && <NewPropostaModal defaultDealId={dealId} onClose={()=>setShowModal(false)} onCreated={()=>{ setShowModal(false); load(); }}/>}
    </>
  );
}

function NewPropostaModal({ defaultDealId, onClose, onCreated }) {
  const { DEALS } = window.DATA;
  const [titulo, setTitulo] = React.useState('');
  const [oportunidadeId, setOpId] = React.useState(defaultDealId || DEALS[0]?.id || '');
  const [valor, setValor] = React.useState('');
  const [escopo, setEscopo] = React.useState('');

  const submit = async () => {
    try {
      await window.API.api('/propostas', {
        method: 'POST',
        body: {
          titulo, oportunidade_id: Number(oportunidadeId),
          valor_total: valor ? Number(valor) : null,
          escopo,
        },
      });
      onCreated();
    } catch (e) { window.toast.error(e.message); }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{maxWidth:600}} onClick={e=>e.stopPropagation()}>
        <div className="modal-head">
          <div style={{fontSize:16, fontWeight:700}}>Nova proposta</div>
          <button className="icon-btn" onClick={onClose}><I.close size={16}/></button>
        </div>
        <div className="modal-body" style={{display:'flex', flexDirection:'column', gap:14}}>
          <FormField label="Título">
            <input className="input" value={titulo} onChange={e=>setTitulo(e.target.value)} placeholder="Bodyshop Java 12 meses — v1"/>
          </FormField>
          <FormField label="Deal relacionado">
            <select className="input" value={oportunidadeId} onChange={e=>setOpId(e.target.value)}>
              {DEALS.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
            </select>
          </FormField>
          <FormField label="Valor total (R$)">
            <input className="input" type="number" value={valor} onChange={e=>setValor(e.target.value)}/>
          </FormField>
          <FormField label="Escopo resumido">
            <textarea className="input" rows="5" value={escopo} onChange={e=>setEscopo(e.target.value)} style={{resize:'vertical'}}/>
          </FormField>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancelar</button>
          <button className="btn btn-accent btn-sm" onClick={submit} disabled={!titulo}>Criar</button>
        </div>
      </div>
    </div>
  );
}

// /proposta/:id — detalhe
function PropostaDetail({ propostaId, onBack }) {
  const { fmt, DEALS, COMPANIES } = window.DATA;
  const [p, setP] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setLoading(true);
    window.API.api(`/propostas/${propostaId}`)
      .then(setP).catch(()=>setP(null)).finally(()=>setLoading(false));
  }, [propostaId]);

  const update = async (patch) => {
    try {
      const r = await window.API.api(`/propostas/${propostaId}`, { method: 'PATCH', body: patch });
      setP(r);
    } catch (e) { window.toast.error(e.message); }
  };

  if (loading) return <div style={{padding:40, textAlign:'center'}}>Carregando…</div>;
  if (!p) return <div className="card" style={{padding:20}}>Proposta não encontrada. <button className="btn btn-xs btn-ghost" onClick={onBack}>Voltar</button></div>;

  const deal = DEALS.find(d => String(d.id) === String(p.oportunidade_id));
  const empresa = deal ? COMPANIES[deal.company] : null;

  return (
    <>
      <div className="page-head">
        <div>
          <button className="btn btn-xs btn-ghost" onClick={onBack} style={{marginBottom:8}}>← Propostas</button>
          <h1 className="page-title">{p.titulo}</h1>
          <div className="page-sub">
            <span className={`chip ${p.status==='aceita'?'success':p.status==='rejeitada'?'danger':p.status==='enviada'?'info':''}`}>{p.status}</span>
            {deal && <> · Deal: <strong>{deal.title}</strong></>}
            {empresa && <> · {empresa.name}</>}
          </div>
        </div>
        <div className="actions">
          {p.status === 'rascunho' && <button className="btn btn-accent btn-sm" onClick={()=>update({status:'enviada'})}><I.send size={12}/>Marcar como enviada</button>}
          {(p.status === 'enviada' || p.status === 'em_analise') && <>
            <button className="btn btn-ghost btn-sm" onClick={()=>update({status:'aceita'})}><I.check size={12}/>Aceita</button>
            <button className="btn btn-ghost btn-sm" onClick={()=>{ const m = prompt('Motivo da rejeição?'); if(m!==null) update({status:'rejeitada', motivo_rejeicao: m}); }}>Rejeitada</button>
          </>}
        </div>
      </div>

      <div className="grid-dash">
        <div className="card">
          <div className="card-head"><div className="card-title">Detalhes da proposta</div></div>
          <div className="card-p" style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
            <Info label="Número" value={p.numero || p.id}/>
            <Info label="Versão" value={`v${p.versao}`}/>
            <Info label="Valor total" value={fmt.brlK(p.valor_total)} hot/>
            <Info label="Desconto" value={p.desconto_percentual != null ? p.desconto_percentual + '%' : '—'}/>
            <Info label="Prazo execução" value={p.prazo_execucao}/>
            <Info label="Validade" value={fmt.date(p.validade_em)}/>
            <Info label="Enviada em" value={p.enviada_em ? fmt.relative(p.enviada_em) : '—'}/>
            <Info label="Aceita em" value={p.aceita_em ? fmt.relative(p.aceita_em) : '—'}/>
          </div>
          {p.escopo && (
            <div style={{padding:'0 var(--card-p) var(--card-p)'}}>
              <div className="faint" style={{fontSize:10, textTransform:'uppercase', letterSpacing:'.04em', marginBottom:6}}>Escopo</div>
              <div style={{fontSize:13, whiteSpace:'pre-wrap'}}>{p.escopo}</div>
            </div>
          )}
          {p.condicoes_pagamento && (
            <div style={{padding:'0 var(--card-p) var(--card-p)'}}>
              <div className="faint" style={{fontSize:10, textTransform:'uppercase', letterSpacing:'.04em', marginBottom:6}}>Condições de pagamento</div>
              <div style={{fontSize:13, whiteSpace:'pre-wrap'}}>{p.condicoes_pagamento}</div>
            </div>
          )}
          {p.motivo_rejeicao && (
            <div style={{padding:'0 var(--card-p) var(--card-p)'}}>
              <div className="faint" style={{fontSize:10, textTransform:'uppercase', color:'hsl(var(--danger))'}}>Motivo da rejeição</div>
              <div style={{fontSize:13, whiteSpace:'pre-wrap', color:'hsl(var(--danger))'}}>{p.motivo_rejeicao}</div>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-head"><div className="card-title">Perfis propostos</div></div>
          <div className="card-p">
            {(!p.perfis || p.perfis.length === 0) && <div className="muted">Nenhum perfil definido.</div>}
            {(p.perfis || []).map((perfil, i) => (
              <div key={i} style={{padding:'10px 0', borderBottom:'1px dashed hsl(var(--border))'}}>
                <strong>{perfil.cargo || '—'}</strong>
                <div className="muted" style={{fontSize:12}}>
                  {perfil.qtd || 1}× · {perfil.horas || 0}h · R$ {perfil.valor_hora || 0}/h
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

window.Propostas = Propostas;
window.PropostaDetail = PropostaDetail;
