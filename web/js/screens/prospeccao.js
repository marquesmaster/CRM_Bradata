// /prospeccao — triagem de leads (backend /leads)
function Prospeccao() {
  const { fmt } = window.DATA;
  const [items, setItems] = React.useState([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [filterStatus, setFilterStatus] = React.useState('all');
  const [scoreMin, setScoreMin] = React.useState(0);
  const [page, setPage] = React.useState(1);

  const load = React.useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page, size: 50 });
    if (filterStatus !== 'all') params.set('status', filterStatus);
    if (scoreMin > 0) params.set('score_min', scoreMin);
    window.API.api('/leads?' + params.toString())
      .then(r => { setItems(r.items || []); setTotal(r.total || 0); setLoading(false); })
      .catch(() => setLoading(false));
  }, [filterStatus, scoreMin, page]);

  React.useEffect(() => { load(); }, [load]);

  const empresas = window.DATA.COMPANIES;
  const counts = items.reduce((a, l) => { a[l.status] = (a[l.status]||0)+1; return a; }, {});

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Prospecção</h1>
          <div className="page-sub">{fmt.num(total)} leads · {counts.qualificado || 0} qualificados · {counts.novo || 0} novos</div>
        </div>
        <div className="actions">
          <button className="btn btn-accent btn-sm"><I.plus size={12}/>Novo lead</button>
        </div>
      </div>

      <div className="filters-bar">
        <div className="segment-ctrl">
          {['all','novo','em_contato','qualificado','desqualificado','convertido'].map(s => (
            <button key={s} className={filterStatus===s?'active':''} onClick={()=>{ setFilterStatus(s); setPage(1); }}>
              {s==='all'?'Todos':s.replace('_',' ')}
            </button>
          ))}
        </div>
        <div style={{flex:1}}/>
        <label style={{fontSize:12, color:'hsl(var(--fg-muted))'}}>Score mín.</label>
        <input
          className="filter-input"
          type="number" min="0" max="100" step="10"
          value={scoreMin}
          onChange={e=>{ setScoreMin(+e.target.value||0); setPage(1); }}
          style={{width:80}}
        />
      </div>

      <div className="card">
        <table className="table">
          <thead><tr>
            <th>Empresa</th><th>Origem</th><th>Status</th><th>Score</th><th>Owner</th><th>Criado</th><th></th>
          </tr></thead>
          <tbody>
            {loading && items.length === 0 && <TableLoading rows={5} cols={7}/>}
            {!loading && items.length === 0 && (
              <tr><td colSpan="7" style={{padding:0}}>
                <EmptyState icon={<I.target size={22}/>} title="Nenhum lead encontrado" description="Ajuste os filtros ou rode uma ingestão PNCP em Execuções para popular o pipeline."/>
              </td></tr>
            )}
            {items.map(l => {
              const c = empresas[String(l.empresa_id)];
              return (
                <tr key={l.id}>
                  <td>
                    <div className="row" style={{gap:10}}>
                      <UI.Avatar name={c?.name || '?'} size={28}/>
                      <div>
                        <strong style={{fontSize:12.5}}>{c?.name || `Empresa #${l.empresa_id}`}</strong>
                        <div className="muted mono" style={{fontSize:10.5}}>{c?.cnpj ? fmt.cnpj(c.cnpj) : ''}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className="chip">{l.origem}</span></td>
                  <td>
                    <span className={`chip ${l.status==='qualificado'?'success':l.status==='novo'?'info':l.status==='convertido'?'accent':''}`}>{l.status}</span>
                  </td>
                  <td className="mono" style={{fontWeight:700}}>{l.score}</td>
                  <td className="muted" style={{fontSize:12}}>{l.owner_id || '—'}</td>
                  <td className="muted" style={{fontSize:12}}>{fmt.relative(l.created_at)}</td>
                  <td><button className="btn btn-xs btn-ghost" onClick={()=>window.__nav('prospeccaoDetail', l.id)}>Abrir</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// /prospeccao/:id — detalhe + converter para oportunidade
function ProspeccaoDetail({ leadId, onBack }) {
  const { fmt, COMPANIES, STAGES, _pipeline } = window.DATA;
  const [lead, setLead] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [showConvert, setShowConvert] = React.useState(false);

  React.useEffect(() => {
    setLoading(true);
    window.API.api(`/leads/${leadId}`)
      .then(setLead)
      .catch(() => setLead(null))
      .finally(() => setLoading(false));
  }, [leadId]);

  const qualificar = async (novoStatus) => {
    try {
      const r = await window.API.api(`/leads/${leadId}`, { method: 'PATCH', body: { status: novoStatus } });
      setLead(r);
    } catch (e) { window.toast.error(e.message); }
  };

  if (loading) return (
    <div className="card" style={{padding:24, display:'flex', flexDirection:'column', gap:12}}>
      <Skeleton height={28} width="55%"/>
      <Skeleton height={14} width="35%"/>
      {Array.from({length:6}).map((_,i) => <Skeleton key={i} height={42}/>)}
    </div>
  );
  if (!lead) return <div className="card" style={{padding:20}}>Lead não encontrado. <button className="btn btn-xs btn-ghost" onClick={onBack}>Voltar</button></div>;

  const c = COMPANIES[String(lead.empresa_id)];

  return (
    <>
      <div className="page-head">
        <div>
          <button className="btn btn-xs btn-ghost" onClick={onBack} style={{marginBottom:8}}>← Voltar</button>
          <h1 className="page-title">Lead #{lead.id}</h1>
          <div className="page-sub">{c?.name || 'Empresa'} · <span className={`chip ${lead.status==='qualificado'?'success':''}`}>{lead.status}</span></div>
        </div>
        <div className="actions">
          {lead.status !== 'qualificado' && lead.status !== 'convertido' && (
            <button className="btn btn-ghost btn-sm" onClick={()=>qualificar('qualificado')}>Marcar como qualificado</button>
          )}
          {lead.status !== 'convertido' && (
            <button className="btn btn-accent btn-sm" onClick={()=>setShowConvert(true)}><I.target size={12}/>Converter em oportunidade</button>
          )}
        </div>
      </div>
      <div className="grid-dash">
        <div className="card">
          <div className="card-head"><div className="card-title">Dados do lead</div></div>
          <div className="card-p" style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14}}>
            <Info label="Empresa" value={c?.name}/>
            <Info label="CNPJ" value={c?.cnpj && fmt.cnpj(c.cnpj)}/>
            <Info label="Origem" value={lead.origem}/>
            <Info label="Status" value={lead.status}/>
            <Info label="Score" value={lead.score}/>
            <Info label="Owner ID" value={lead.owner_id}/>
            <Info label="Criado" value={fmt.date(lead.created_at)}/>
            <Info label="Qualificado" value={lead.qualificado_em ? fmt.date(lead.qualificado_em) : '—'}/>
          </div>
          {lead.observacoes && <div style={{padding:'0 var(--card-p) var(--card-p)', fontSize:13}}>{lead.observacoes}</div>}
        </div>
      </div>
      {showConvert && <ConvertLeadModal lead={lead} onClose={()=>setShowConvert(false)} onDone={(op)=>{ setShowConvert(false); window.__nav('pipeline'); }}/>}
    </>
  );
}

function ConvertLeadModal({ lead, onClose, onDone }) {
  const { STAGES, _pipeline } = window.DATA;
  const [titulo, setTitulo] = React.useState('');
  const [valor, setValor] = React.useState('');
  const [estagioId, setEstagioId] = React.useState(STAGES[0]?.id || '');

  const submit = async () => {
    try {
      const op = await window.API.api(`/leads/${lead.id}/converter`, {
        method: 'POST',
        body: {
          titulo_oportunidade: titulo,
          pipeline_id: _pipeline?.id || 1,
          estagio_id: Number(estagioId),
          valor_estimado: valor ? Number(valor) : null,
        },
      });
      window.toast.success('Lead convertido em oportunidade');
      onDone(op);
    } catch (e) { window.toast.error(e.message); }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-head">
          <div style={{fontSize:16, fontWeight:700}}>Converter em oportunidade</div>
          <button className="icon-btn" onClick={onClose}><I.close size={16}/></button>
        </div>
        <div className="modal-body" style={{display:'flex', flexDirection:'column', gap:14}}>
          <FormField label="Título da oportunidade">
            <input className="input" value={titulo} onChange={e=>setTitulo(e.target.value)} placeholder="Bodyshop Java — 12 meses"/>
          </FormField>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
            <FormField label="Valor estimado (R$)">
              <input className="input" type="number" value={valor} onChange={e=>setValor(e.target.value)}/>
            </FormField>
            <FormField label="Estágio inicial">
              <select className="input" value={estagioId} onChange={e=>setEstagioId(e.target.value)}>
                {STAGES.filter(s=>!s.is_ganho&&!s.is_perda).map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </FormField>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancelar</button>
          <button className="btn btn-accent btn-sm" onClick={submit} disabled={!titulo}>Converter</button>
        </div>
      </div>
    </div>
  );
}

window.Prospeccao = Prospeccao;
window.ProspeccaoDetail = ProspeccaoDetail;
