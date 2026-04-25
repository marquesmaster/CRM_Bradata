// /fornecedores — lista completa com filtros, sort, paginação e export
const ITEMS_PER_PAGE_FORN = 20;

const CLASSIFICACAO_CONFIG = {
  alto:  { label: 'Alto Valor',  color: 'success' },
  medio: { label: 'Médio Valor', color: 'warn' },
  baixo: { label: 'Baixo Valor', color: '' },
};

const PORTE_OPTIONS = [
  { value: 'all',    label: 'Todos' },
  { value: 'mei',    label: 'MEI' },
  { value: 'me',     label: 'ME (Microempresa)' },
  { value: 'epp',    label: 'EPP (Pequeno Porte)' },
  { value: 'demais', label: 'Demais' },
];

const FAIXA_FATURAMENTO_OPTIONS = [
  { value: 'all', label: 'Todas' },
  { value: 'Até R$ 81 mil', label: 'Até R$ 81 mil' },
  { value: 'R$ 81 mil - R$ 360 mil', label: 'R$ 81 mil - R$ 360 mil' },
  { value: 'R$ 360 mil - R$ 4,8 milhões', label: 'R$ 360 mil - R$ 4,8 milhões' },
  { value: 'R$ 4,8 milhões - R$ 300 milhões', label: 'R$ 4,8 milhões - R$ 300 milhões' },
  { value: 'Acima de R$ 300 milhões', label: 'Acima de R$ 300 milhões' },
];

function Accounts() {
  const { fmt, COMPANY_LIST } = window.DATA;
  const [q, setQ] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [sortField, setSortField] = React.useState('totalContratos');
  const [sortOrder, setSortOrder] = React.useState('desc');

  const [classificacaoFilter, setClassificacaoFilter] = React.useState('all');
  const [setorFilter, setSetorFilter] = React.useState('all');
  const [porteFilter, setPorteFilter] = React.useState('all');
  const [faixaFilter, setFaixaFilter] = React.useState('all');
  const [showFilters, setShowFilters] = React.useState(false);
  const [setores, setSetores] = React.useState([]);

  React.useEffect(() => {
    window.API.api('/empresas/setores').then(r => setSetores(r?.setores || [])).catch(() => {});
  }, []);

  const activeCount = [
    classificacaoFilter !== 'all',
    setorFilter !== 'all',
    porteFilter !== 'all',
    faixaFilter !== 'all',
  ].filter(Boolean).length;

  const clearFilters = () => {
    setClassificacaoFilter('all');
    setSetorFilter('all');
    setPorteFilter('all');
    setFaixaFilter('all');
    setPage(1);
  };

  const filtered = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    let result = COMPANY_LIST.filter(f => {
      if (term) {
        const nm = (f.name || '').toLowerCase();
        const cn = (f.cnpj || '').toLowerCase();
        if (!nm.includes(term) && !cn.includes(term)) return false;
      }
      if (classificacaoFilter !== 'all' && f.classificacao !== classificacaoFilter) return false;
      if (setorFilter !== 'all' && f.sector !== setorFilter) return false;
      if (porteFilter !== 'all') {
        const p = (f.porte || '').toLowerCase();
        if (porteFilter === 'mei' && !p.includes('mei')) return false;
        if (porteFilter === 'me'  && !p.includes('micro') && p !== 'me') return false;
        if (porteFilter === 'epp' && !p.includes('pequeno') && !p.includes('epp')) return false;
        if (porteFilter === 'demais' && !p.includes('demais') && !p.includes('grande') && !p.includes('médio')) return false;
      }
      if (faixaFilter !== 'all' && f.faixa_faturamento !== faixaFilter) return false;
      return true;
    });
    const cmpStr = (a,b) => (a||'').localeCompare(b||'');
    const cmpNum = (a,b) => (a||0) - (b||0);
    const classOrder = { alto: 3, medio: 2, baixo: 1 };
    result.sort((a,b) => {
      let c = 0;
      if (sortField === 'nome')               c = cmpStr(a.name, b.name);
      else if (sortField === 'totalContratos') c = cmpNum(a.totalContratos, b.totalContratos);
      else if (sortField === 'valorTotal')     c = cmpNum(a.valorTotalContratos, b.valorTotalContratos);
      else if (sortField === 'classificacao')  c = cmpNum(classOrder[a.classificacao], classOrder[b.classificacao]);
      return sortOrder === 'asc' ? c : -c;
    });
    return result;
  }, [COMPANY_LIST, q, classificacaoFilter, setorFilter, porteFilter, faixaFilter, sortField, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE_FORN));
  const start = (page - 1) * ITEMS_PER_PAGE_FORN;
  const pageItems = filtered.slice(start, start + ITEMS_PER_PAGE_FORN);

  const handleSort = (field) => {
    if (sortField === field) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder(field === 'nome' ? 'asc' : 'desc'); }
    setPage(1);
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <span style={{opacity:.4, marginLeft:4, fontSize:10}}>⇅</span>;
    return <span style={{marginLeft:4, fontSize:10}}>{sortOrder === 'asc' ? '↑' : '↓'}</span>;
  };

  const handleExport = () => {
    if (filtered.length === 0) { alert('Nada para exportar'); return; }
    const headers = ['Nome','CNPJ','Setor','Porte','Faixa Faturamento','Contratos','Valor Total','Classificação','UF','Score ICP','Status'];
    const rows = filtered.map(f => [
      f.name || '', f.cnpj || '', f.sector || '', f.porte || '',
      f.faixa_faturamento || '', f.totalContratos || 0,
      f.valorTotalContratos || 0,
      CLASSIFICACAO_CONFIG[f.classificacao]?.label || f.classificacao,
      f.uf || '', f.score || 0, f.status || '',
    ]);
    const csv = [
      headers.join(';'),
      ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';'))
    ].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fornecedores_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Fornecedores</h1>
          <div className="page-sub">Lista de fornecedores identificados nos contratos PNCP</div>
        </div>
        <div className="actions">
          <button className="btn btn-ghost btn-sm" onClick={async () => {
            if (!confirm('Enriquecer todas empresas sem website (CNPJ.WS, ~2/s)?')) return;
            try {
              const r = await window.API.api('/empresas/enriquecer-pendentes?limit=500', { method: 'POST' });
              alert(r.message + '\nAcompanhe nos logs. Em alguns minutos, recarregue.');
            } catch (e) { alert(e.message); }
          }}><I.refresh size={12}/>Enriquecer pendentes</button>
          <span className="chip">{filtered.length} fornecedores</span>
        </div>
      </div>

      {/* Busca + filtros */}
      <div className="filters-bar" style={{flexDirection:'column', alignItems:'stretch', gap:12}}>
        <div className="row" style={{gap:10, flexWrap:'wrap'}}>
          <div className="row" style={{gap:8, flex:1, minWidth:240, padding:'0 14px', background:'hsl(var(--surface))', border:'1px solid hsl(var(--border))', borderRadius:8, height:38}}>
            <I.search size={16}/>
            <input
              placeholder="Buscar por nome ou CNPJ…"
              value={q}
              onChange={e=>{ setQ(e.target.value); setPage(1); }}
              style={{flex:1, border:0, padding:0, background:'transparent', outline:'none', fontSize:13.5, color:'hsl(var(--fg))'}}
            />
          </div>
          <button className={`btn btn-sm ${showFilters ? 'btn-accent' : 'btn-ghost'}`} onClick={()=>setShowFilters(!showFilters)}>
            <I.filter size={12}/>Filtros
            {activeCount > 0 && <span className="chip primary" style={{fontSize:10, padding:'1px 6px', marginLeft:4}}>{activeCount}</span>}
          </button>
          {activeCount > 0 && (
            <button className="btn btn-sm btn-ghost" onClick={clearFilters}><I.close size={12}/>Limpar</button>
          )}
          <button className="btn btn-sm btn-ghost" onClick={handleExport}><I.download size={12}/>Exportar CSV</button>
        </div>

        {showFilters && (
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:14, paddingTop:14, borderTop:'1px solid hsl(var(--border))'}}>
            <div>
              <div className="form-label">Classificação</div>
              <select className="filter-select" style={{width:'100%'}} value={classificacaoFilter} onChange={e=>{ setClassificacaoFilter(e.target.value); setPage(1); }}>
                <option value="all">Todas</option>
                <option value="alto">Alto Valor</option>
                <option value="medio">Médio Valor</option>
                <option value="baixo">Baixo Valor</option>
              </select>
            </div>
            <div>
              <div className="form-label">Setor</div>
              <select className="filter-select" style={{width:'100%'}} value={setorFilter} onChange={e=>{ setSetorFilter(e.target.value); setPage(1); }}>
                <option value="all">Todos</option>
                {setores.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <div className="form-label">Porte</div>
              <select className="filter-select" style={{width:'100%'}} value={porteFilter} onChange={e=>{ setPorteFilter(e.target.value); setPage(1); }}>
                {PORTE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <div className="form-label">Faixa de faturamento</div>
              <select className="filter-select" style={{width:'100%'}} value={faixaFilter} onChange={e=>{ setFaixaFilter(e.target.value); setPage(1); }}>
                {FAIXA_FATURAMENTO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Tabela */}
      <div className="card">
        <table className="table">
          <thead><tr>
            <th style={{cursor:'pointer'}} onClick={()=>handleSort('nome')}>Fornecedor <SortIcon field="nome"/></th>
            <th>CNPJ</th>
            <th>Setor</th>
            <th>Porte</th>
            <th>Faturamento</th>
            <th style={{textAlign:'center', cursor:'pointer'}} onClick={()=>handleSort('totalContratos')}>Contratos <SortIcon field="totalContratos"/></th>
            <th style={{cursor:'pointer'}} onClick={()=>handleSort('valorTotal')}>Valor total <SortIcon field="valorTotal"/></th>
            <th style={{cursor:'pointer'}} onClick={()=>handleSort('classificacao')}>Classif. <SortIcon field="classificacao"/></th>
            <th>Status</th>
            <th></th>
          </tr></thead>
          <tbody>
            {pageItems.length === 0 && (
              <tr><td colSpan="10" style={{textAlign:'center', padding:40, color:'hsl(var(--fg-muted))'}}>
                {q || activeCount > 0 ? 'Nenhum fornecedor com esses filtros.' : 'Nenhum fornecedor ainda. Rode um ETL PNCP.'}
              </td></tr>
            )}
            {pageItems.map(f => {
              const cfg = CLASSIFICACAO_CONFIG[f.classificacao] || CLASSIFICACAO_CONFIG.baixo;
              const enriched = !!(f.sector && f.sector !== '—');
              return (
                <tr key={f.id} style={{cursor:'pointer'}} onClick={()=>window.__nav('lead', f.id)}>
                  <td>
                    <div className="row" style={{gap:10}}>
                      <div style={{position:'relative', width:34, height:34, borderRadius:8, background:'hsl(var(--b-accent) / .1)', display:'grid', placeItems:'center', color:'hsl(var(--b-accent))', flex:'0 0 auto'}}>
                        <I.building size={16}/>
                        <span
                          title={enriched ? 'Dados enriquecidos' : 'Pendente de enriquecimento'}
                          style={{position:'absolute', top:-4, right:-4, width:14, height:14, borderRadius:'50%',
                                  background: enriched ? 'hsl(var(--success))' : 'hsl(var(--border-strong))',
                                  display:'grid', placeItems:'center', color:'white', fontSize:8, fontWeight:900,
                                  border:'2px solid hsl(var(--surface))'}}>
                          {enriched ? '✓' : '·'}
                        </span>
                      </div>
                      <div style={{minWidth:0}}>
                        <strong style={{fontSize:13}}>{f.name || 'Nome não informado'}</strong>
                        <div className="muted" style={{fontSize:11}}>{f.city ? `${f.city}, ${f.uf || ''}` : (f.uf || '—')}</div>
                      </div>
                    </div>
                  </td>
                  <td className="mono faint" style={{fontSize:11}}>{fmt.cnpj(f.cnpj)}</td>
                  <td style={{fontSize:12.5}}>{f.sector || <span className="faint">—</span>}</td>
                  <td style={{fontSize:12.5}}>{f.porte || <span className="faint">—</span>}</td>
                  <td className="mono" style={{fontSize:12}}>{f.revenue ? fmt.brlK(f.revenue) : '—'}</td>
                  <td style={{textAlign:'center'}}><span className="chip">{f.totalContratos}</span></td>
                  <td><strong className="mono" style={{color:'hsl(var(--b-accent))'}}>{fmt.brlK(f.valorTotalContratos)}</strong></td>
                  <td><span className={`chip ${cfg.color}`}>{cfg.label}</span></td>
                  <td><span className={`chip ${f.status==='cliente'?'success':f.status==='lead'?'info':''}`}>{f.status}</span></td>
                  <td>
                    <button className="btn btn-xs btn-ghost" onClick={e=>{ e.stopPropagation(); window.__nav('lead', f.id); }}>
                      <I.doc size={12}/>Detalhes
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Paginator page={page} total={filtered.length} size={ITEMS_PER_PAGE_FORN} onPage={setPage}/>
    </>
  );
}

window.Accounts = Accounts;
