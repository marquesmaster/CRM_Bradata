// /contratos — listagem completa de pncp_contratos com filtros
function Contratos() {
  const { fmt } = window.DATA;
  const [items, setItems] = React.useState([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [q, setQ] = React.useState('');
  const [uf, setUf] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [size] = React.useState(50);

  const load = React.useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page, size });
    if (q) params.set('q', q);
    if (uf) params.set('uf', uf);
    window.API.api('/pncp/contratos?' + params.toString())
      .then(r => { setItems(r.items || []); setTotal(r.total || 0); setLoading(false); })
      .catch(() => setLoading(false));
  }, [q, uf, page, size]);

  React.useEffect(() => { load(); }, [load]);

  const pages = Math.ceil(total / size);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Contratos PNCP</h1>
          <div className="page-sub">{fmt.num(total)} contratos · página {page} de {pages || 1}</div>
        </div>
        <div className="actions">
          <button className="btn btn-ghost btn-sm" onClick={()=>window.__nav('execucoes')}><I.refresh size={12}/>Nova ingestão</button>
        </div>
      </div>

      <div className="filters-bar">
        <div className="row" style={{gap:8, flex:1, minWidth:240}}>
          <I.search size={16}/>
          <input
            className="filter-input"
            placeholder="Buscar no título ou descrição…"
            value={q}
            onChange={e=>{ setQ(e.target.value); setPage(1); }}
            style={{flex:1, border:0, padding:0, background:'transparent'}}
          />
        </div>
        <select className="filter-select" value={uf} onChange={e=>{ setUf(e.target.value); setPage(1); }}>
          <option value="">Todas UFs</option>
          {['DF','SP','RJ','MG','RS','PR','SC','GO','MT','MS','BA','PE','CE'].map(u => <option key={u}>{u}</option>)}
        </select>
      </div>

      <div className="card">
        <table className="table">
          <thead><tr>
            <th>Contrato</th><th>Órgão</th><th>UF</th><th>Modalidade</th><th>Valor</th><th>Assinatura</th><th>IA</th><th></th>
          </tr></thead>
          <tbody>
            {loading && items.length === 0 && <TableLoading rows={8} cols={8}/>}
            {!loading && items.length === 0 && (
              <tr><td colSpan="8" style={{padding:0}}>
                <EmptyState
                  icon={<I.doc size={22}/>}
                  title="Nenhum contrato encontrado"
                  description={q || uf ? "Ajuste os filtros para ampliar a busca." : "Nenhum contrato ainda. Dispare uma ingestão em Execuções."}
                  action={!q && !uf && (
                    <button className="btn btn-accent btn-sm" onClick={() => window.__nav('execucoes')}>
                      <I.refresh size={11}/>Ir para Execuções
                    </button>
                  )}
                />
              </td></tr>
            )}
            {items.map(c => (
              <tr key={c.id}>
                <td>
                  <strong style={{fontSize:12.5}}>{c.titulo || '—'}</strong>
                  <div className="muted mono" style={{fontSize:10.5}}>{c.numero_controle_pncp}</div>
                </td>
                <td>
                  <div style={{fontSize:12.5}}>{c.orgao_nome || '—'}</div>
                  <div className="muted mono" style={{fontSize:10.5}}>{fmt.cnpj(c.orgao_cnpj)}</div>
                </td>
                <td><span className="chip">{c.uf || '—'}</span></td>
                <td style={{fontSize:12}}>{c.modalidade_licitacao_nome || '—'}</td>
                <td><strong className="mono" style={{color:'hsl(var(--b-accent))'}}>{fmt.brlK(c.valor_global)}</strong></td>
                <td className="muted" style={{fontSize:12}}>{fmt.date(c.data_assinatura)}</td>
                <td>{c.ai_classificacao ? <span className={`chip ${c.ai_classificacao==='SIM'?'success':c.ai_classificacao==='TALVEZ'?'warn':''}`}>{c.ai_classificacao}</span> : <span className="chip">—</span>}</td>
                <td><button className="btn btn-xs btn-ghost" onClick={()=>window.__nav('contrato', c.id)}>Ver</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Paginator page={page} total={total} size={size} onPage={setPage}/>
    </>
  );
}

// /contrato/:id — detalhe do contrato
function ContratoDetail({ contratoId, onBack }) {
  const { fmt } = window.DATA;
  const [c, setC] = React.useState(null);
  const [compra, setCompra] = React.useState(null);
  const [itens, setItens] = React.useState([]);
  const [resultados, setResultados] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState(null);

  React.useEffect(() => {
    if (!contratoId) return;
    setLoading(true);
    window.API.api(`/pncp/contratos/${contratoId}`)
      .then(setC)
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, [contratoId]);

  const processarCompra = async () => {
    try {
      const result = await window.API.api(`/pncp/contratos/${contratoId}/compra`, { method: 'POST' });
      setCompra(result);
      const itensR = await window.API.api(`/pncp/compras/${result.id}/itens`);
      setItens(itensR || []);
      for (const it of (itensR || [])) {
        const res = await window.API.api(`/pncp/itens/${it.id}/resultados`);
        setResultados(prev => [...prev, ...(res || [])]);
      }
    } catch (e) { window.toast.error(e.message); }
  };

  const classificarIa = async () => {
    try {
      const r = await window.API.api(`/pncp/contratos/${contratoId}/classificar-ia`, { method: 'POST' });
      setC(prev => ({ ...prev, ...r }));
    } catch (e) { window.toast.error(e.message); }
  };

  if (loading) return (
    <div className="card" style={{padding:24, display:'flex', flexDirection:'column', gap:12}}>
      <Skeleton height={28} width="60%"/>
      <Skeleton height={14} width="40%"/>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:8}}>
        {Array.from({length:8}).map((_,i) => <Skeleton key={i} height={36}/>)}
      </div>
    </div>
  );
  if (err) return <div className="card" style={{padding:20, color:'hsl(var(--danger))'}}>{err}</div>;
  if (!c) return null;

  return (
    <>
      <div className="page-head">
        <div>
          <button className="btn btn-xs btn-ghost" onClick={onBack} style={{marginBottom:8}}>← Voltar</button>
          <h1 className="page-title">{c.titulo || c.numero_controle_pncp}</h1>
          <div className="page-sub mono">{c.numero_controle_pncp}</div>
        </div>
        <div className="actions">
          <button className="btn btn-ghost btn-sm" onClick={classificarIa}><I.sparkle size={12}/>Classificar IA</button>
          <button className="btn btn-accent btn-sm" onClick={processarCompra}><I.refresh size={12}/>Processar compra</button>
        </div>
      </div>

      <div className="grid-dash">
        <div style={{display:'flex', flexDirection:'column', gap:'var(--gap)'}}>
          <div className="card">
            <div className="card-head"><div className="card-title">Dados do contrato</div></div>
            <div className="card-p" style={{display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:16}}>
              <Info label="Órgão" value={c.orgao_nome}/>
              <Info label="CNPJ do órgão" value={fmt.cnpj(c.orgao_cnpj)}/>
              <Info label="Unidade" value={c.unidade_nome}/>
              <Info label="UF / Município" value={`${c.uf || '—'} / ${c.municipio_nome || '—'}`}/>
              <Info label="Modalidade" value={c.modalidade_licitacao_nome}/>
              <Info label="Situação" value={c.situacao_nome}/>
              <Info label="Tipo" value={c.tipo_contrato_nome}/>
              <Info label="Valor global" value={fmt.brlK(c.valor_global)} hot/>
              <Info label="Assinatura" value={fmt.date(c.data_assinatura)}/>
              <Info label="Vigência" value={`${fmt.date(c.data_inicio_vigencia)} → ${fmt.date(c.data_fim_vigencia)}`}/>
            </div>
            {c.descricao && (
              <div style={{padding:'0 var(--card-p) var(--card-p)'}}>
                <div className="faint" style={{fontSize:10, textTransform:'uppercase', letterSpacing:'.04em', marginBottom:6}}>Descrição</div>
                <div style={{fontSize:13, lineHeight:1.6, whiteSpace:'pre-wrap'}}>{c.descricao}</div>
              </div>
            )}
          </div>
        </div>

        <div style={{display:'flex', flexDirection:'column', gap:'var(--gap)'}}>
          <div className="card halo">
            <div className="card-head">
              <div className="row" style={{gap:8}}>
                <I.sparkle size={14}/>
                <div className="card-title">Classificação IA</div>
              </div>
            </div>
            <div className="card-p">
              {c.ai_classificacao ? (
                <>
                  <div style={{fontSize:28, fontWeight:700, textAlign:'center', color: c.ai_classificacao==='SIM'?'hsl(var(--success))':c.ai_classificacao==='TALVEZ'?'hsl(var(--warning))':'hsl(var(--fg-muted))'}}>
                    {c.ai_classificacao}
                  </div>
                  <div style={{textAlign:'center', fontSize:12, color:'hsl(var(--fg-muted))', marginTop:4}}>Confiança: {c.ai_confianca != null ? Math.round(c.ai_confianca * 100) + '%' : '—'}</div>
                  {c.ai_motivo && <p style={{fontSize:12.5, marginTop:12, lineHeight:1.5}}>{c.ai_motivo}</p>}
                  {c.ai_oportunidade && (
                    <>
                      <div className="divider"/>
                      <div className="faint" style={{fontSize:10, textTransform:'uppercase', letterSpacing:'.04em', marginBottom:4}}>Oportunidade bodyshop</div>
                      <p style={{fontSize:12.5, lineHeight:1.5}}>{c.ai_oportunidade}</p>
                    </>
                  )}
                </>
              ) : (
                <div style={{textAlign:'center', padding:20, color:'hsl(var(--fg-muted))'}}>
                  <div style={{marginBottom:10, fontSize:13}}>Ainda não classificado</div>
                  <button className="btn btn-sm btn-accent" onClick={classificarIa}><I.sparkle size={12}/>Classificar agora</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Info({ label, value, hot }) {
  return (
    <div>
      <div className="faint" style={{fontSize:10, textTransform:'uppercase', letterSpacing:'.05em'}}>{label}</div>
      <div style={{fontSize:14, fontWeight:600, color: hot?'hsl(var(--b-accent))':'hsl(var(--fg))', marginTop:2}}>{value || '—'}</div>
    </div>
  );
}

window.Contratos = Contratos;
window.ContratoDetail = ContratoDetail;
