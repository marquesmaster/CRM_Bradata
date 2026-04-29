// Tela global de Contatos: filtra contatos extraídos (Lusha, manual, CNPJ.WS)
// por empresa, cargo, decisor, fonte. Permite enviar e-mail direto.

function Contatos() {
  const [items, setItems] = React.useState([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [filters, setFilters] = React.useState({
    q: '', cargo: '', decisor: '', fonte: '', has_email: 'true', uf: '', sector: '',
  });
  const [cargosSugest, setCargosSugest] = React.useState([]);
  const [emailFor, setEmailFor] = React.useState(null);
  const [setores, setSetores] = React.useState([]);

  const SIZE = 50;

  React.useEffect(() => {
    window.API.api('/contatos/cargos/distinct').then(setCargosSugest).catch(()=>{});
    window.API.api('/empresas/setores').then(d => setSetores(d.setores || [])).catch(()=>{});
  }, []);

  const load = React.useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams({ page, size: SIZE });
    Object.entries(filters).forEach(([k, v]) => { if (v !== '' && v != null) qs.set(k, v); });
    window.API.api(`/contatos?${qs}`)
      .then(p => { setItems(p.items || []); setTotal(p.total || 0); })
      .finally(() => setLoading(false));
  }, [filters, page]);

  React.useEffect(load, [load]);

  const update = (k, v) => { setPage(1); setFilters(f => ({...f, [k]: v})); };

  const exportCsv = () => {
    const header = ['Nome','Cargo','Email','Telefone','Empresa','UF','Setor','Decisor','Fonte'];
    const rows = items.map(c => [
      c.nome, c.cargo || '', c.email || '', c.telefone || '',
      c.empresa?.razao_social || c.empresa?.nome_fantasia || '',
      c.empresa?.uf || '', c.empresa?.sector || '',
      c.decisor ? 'sim' : '', c.fonte || '',
    ]);
    const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(';')).join('\n');
    const blob = new Blob(['﻿' + csv], { type:'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `contatos_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Contatos</h1>
          <div className="page-sub">{total.toLocaleString('pt-BR')} contatos · busca por empresa, cargo, decisor</div>
        </div>
        <div className="actions">
          <button className="btn btn-ghost btn-sm" onClick={exportCsv} disabled={items.length===0}>
            <I.download size={12}/>Exportar CSV
          </button>
        </div>
      </div>

      <div className="card" style={{padding:14, marginBottom:'var(--gap)', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:10}}>
        <input className="input" placeholder="Nome ou e-mail…" value={filters.q} onChange={e=>update('q', e.target.value)}/>
        <input list="cargos-sug" className="input" placeholder="Cargo (ex: CTO)…" value={filters.cargo} onChange={e=>update('cargo', e.target.value)}/>
        <datalist id="cargos-sug">{cargosSugest.map(c => <option key={c} value={c}/>)}</datalist>
        <select className="input" value={filters.fonte} onChange={e=>update('fonte', e.target.value)}>
          <option value="">Qualquer fonte</option>
          <option value="lusha">Lusha</option>
          <option value="manual">Manual</option>
          <option value="cnpjws">CNPJ.WS</option>
          <option value="linkedin">LinkedIn</option>
        </select>
        <select className="input" value={filters.decisor} onChange={e=>update('decisor', e.target.value)}>
          <option value="">Decisor: qualquer</option>
          <option value="true">Apenas decisores</option>
          <option value="false">Não-decisores</option>
        </select>
        <select className="input" value={filters.has_email} onChange={e=>update('has_email', e.target.value)}>
          <option value="">E-mail: qualquer</option>
          <option value="true">Com e-mail</option>
          <option value="false">Sem e-mail</option>
        </select>
        <select className="input" value={filters.uf} onChange={e=>update('uf', e.target.value)}>
          <option value="">UF: qualquer</option>
          {['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'].map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <select className="input" value={filters.sector} onChange={e=>update('sector', e.target.value)}>
          <option value="">Setor: qualquer</option>
          {setores.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="card" style={{padding:0}}>
        <table className="table">
          <thead>
            <tr>
              <th>Contato</th>
              <th>Cargo</th>
              <th>Empresa</th>
              <th>Contato</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && <TableLoading rows={6} cols={5}/>}
            {!loading && items.length === 0 && (
              <tr><td colSpan={5} style={{padding:0}}>
                <EmptyState
                  icon={<I.user size={22}/>}
                  title="Nenhum contato encontrado"
                  description="Tente ajustar os filtros ou enriquecer empresas via Lusha pra criar contatos."
                />
              </td></tr>
            )}
            {!loading && items.map(c => (
              <tr key={c.id}>
                <td>
                  <div className="row" style={{gap:10}}>
                    <UI.Avatar name={c.nome} size={32}/>
                    <div>
                      <div style={{fontWeight:600, fontSize:13}}>
                        {c.nome}
                        {c.decisor && <span className="chip warn" style={{fontSize:9, padding:'1px 5px', marginLeft:6}}>decisor</span>}
                      </div>
                      {c.fonte && <div className="muted" style={{fontSize:10.5, marginTop:2}}>via {c.fonte}</div>}
                    </div>
                  </div>
                </td>
                <td><span style={{fontSize:12.5}}>{c.cargo || '—'}</span>{c.departamento && <div className="muted" style={{fontSize:10.5}}>{c.departamento}</div>}</td>
                <td>
                  {c.empresa ? (
                    <button className="link" style={{background:'none', border:0, padding:0, textAlign:'left', cursor:'pointer', color:'hsl(var(--b-accent))', fontWeight:500, fontSize:12.5}} onClick={() => window.__nav('lead', String(c.empresa_id))}>
                      {c.empresa.razao_social || c.empresa.nome_fantasia}
                    </button>
                  ) : '—'}
                  {c.empresa && (c.empresa.uf || c.empresa.sector) && (
                    <div className="muted" style={{fontSize:10.5, marginTop:2}}>
                      {c.empresa.uf || ''}{c.empresa.uf && c.empresa.sector ? ' · ' : ''}{c.empresa.sector || ''}
                    </div>
                  )}
                </td>
                <td style={{fontSize:11.5}} className="mono">
                  {c.email && <div>{c.email}</div>}
                  {c.telefone && <div className="muted">📞 {c.telefone}</div>}
                  {c.celular && <div className="muted">📱 {c.celular}</div>}
                </td>
                <td>
                  <div className="row" style={{gap:4, justifyContent:'flex-end'}}>
                    {c.linkedin_url && <a href={c.linkedin_url} target="_blank" rel="noreferrer" className="icon-btn" title="LinkedIn"><I.linkedin size={14}/></a>}
                    {c.email && <button className="icon-btn" title="Enviar e-mail" onClick={() => setEmailFor(c)}><I.mail size={14}/></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Paginator page={page} total={total} size={SIZE} onPage={setPage}/>

      {emailFor && (
        <ContatoEmailModal contato={emailFor} onClose={() => setEmailFor(null)}/>
      )}
    </>
  );
}

function ContatoEmailModal({ contato, onClose }) {
  // Reaproveitamos o EmailModal de lead.js, mas precisamos passar a empresa
  const empresa = contato.empresa ? { id: contato.empresa_id, name: contato.empresa.razao_social || contato.empresa.nome_fantasia } : { id: null, name: '—' };
  return <EmailModal contato={contato} empresa={empresa} onClose={onClose} onSent={onClose}/>;
}

window.Contatos = Contatos;
