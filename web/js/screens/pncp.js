// /pncp — Descoberta de Fornecedores via PNCP.
// O PNCP alimenta o CRM com empresas que ganharam contratos públicos —
// essas empresas são os LEADS. Esta tela é uma ferramenta de DESCOBERTA
// e PRIORIZAÇÃO desses leads, não um catálogo de contratos.

const PNCP_PAGE_SIZE = 25;

// Mapeia porte legível → trecho que aparece no campo Empresa.porte
const PORTE_OPTS = [
  { key: 'mei',    label: 'MEI',                   match: (p) => /mei/i.test(p) },
  { key: 'me',     label: 'ME (Microempresa)',     match: (p) => /micro|^me$/i.test(p) },
  { key: 'epp',    label: 'EPP (Pequeno Porte)',   match: (p) => /pequeno|epp/i.test(p) },
  { key: 'medio',  label: 'Médio Porte',           match: (p) => /médio|medio/i.test(p) },
  { key: 'grande', label: 'Grande Porte / Demais', match: (p) => /grande|demais/i.test(p) },
];

const CLASSIFICACAO_OPTS = [
  { key: 'alto',  label: 'Alto Valor',  color: 'success' },
  { key: 'medio', label: 'Médio Valor', color: 'warn' },
  { key: 'baixo', label: 'Baixo Valor', color: '' },
];

function _classifMeta(k) { return CLASSIFICACAO_OPTS.find(c => c.key === k) || CLASSIFICACAO_OPTS[2]; }
function _porteKey(p) {
  if (!p) return null;
  const m = PORTE_OPTS.find(o => o.match(p));
  return m ? m.key : null;
}

// Calcula "lead heat" baseado em volume + classificação. Heurística
// simples enquanto não temos data do contrato mais recente no payload.
function _leadHeat(e) {
  const v = e.valor_total_contratos || 0;
  const n = e.contracts_pncp || 0;
  if (e.classificacao_valor === 'alto' && n >= 3) return { key: 'hot', label: '🔥 Quente', color: 'danger' };
  if (e.classificacao_valor === 'alto' || n >= 5) return { key: 'warm', label: '🌡️ Morno', color: 'warn' };
  if (n >= 1) return { key: 'cold', label: '❄️ Frio', color: 'info' };
  return { key: 'none', label: '—', color: '' };
}

function PNCP() {
  const { fmt } = window.DATA;
  const [empresas, setEmpresas] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState(null);

  // filtros
  const [search, setSearch] = React.useState('');
  const [ufFilter, setUfFilter] = React.useState([]);
  const [porteFilter, setPorteFilter] = React.useState([]);
  const [classifFilter, setClassifFilter] = React.useState([]);
  const [sectorFilter, setSectorFilter] = React.useState([]);
  const [icpOnly, setIcpOnly] = React.useState(false);
  const [heatFilter, setHeatFilter] = React.useState(null); // 'hot' | 'warm' | 'cold' | null

  // sort + paginação + seleção
  const [sortField, setSortField] = React.useState('valor');
  const [sortOrder, setSortOrder] = React.useState('desc');
  const [page, setPage] = React.useState(1);
  const [selected, setSelected] = React.useState(() => new Set());

  const load = React.useCallback(() => {
    setLoading(true); setErr(null);
    window.API.api('/empresas?origem=pncp&size=200')
      .then(r => { setEmpresas(r.items || []); setLoading(false); })
      .catch(e => { setErr(e.message); setLoading(false); });
  }, []);

  React.useEffect(() => { load(); }, [load]);

  // opções dinâmicas dos filtros (extraídas do dataset)
  const filterOpts = React.useMemo(() => {
    const ufs = [...new Set(empresas.map(e => e.uf).filter(Boolean))].sort();
    const portesPresent = new Set();
    empresas.forEach(e => { const k = _porteKey(e.porte); if (k) portesPresent.add(k); });
    const portes = PORTE_OPTS.filter(o => portesPresent.has(o.key)).map(o => o.key);
    const sectors = [...new Set(empresas.map(e => e.sector).filter(Boolean))].sort();
    return { ufs, portes, sectors };
  }, [empresas]);

  // pipeline filtro → ordena
  const filtered = React.useMemo(() => {
    let r = empresas.filter(e => {
      if (search) {
        const s = search.toLowerCase();
        const m = (e.razao_social || '').toLowerCase().includes(s)
          || (e.nome_fantasia || '').toLowerCase().includes(s)
          || (e.cnpj || '').includes(search.replace(/\D/g, ''));
        if (!m) return false;
      }
      if (ufFilter.length && !ufFilter.includes(e.uf)) return false;
      if (porteFilter.length) {
        const pk = _porteKey(e.porte);
        if (!pk || !porteFilter.includes(pk)) return false;
      }
      if (classifFilter.length && !classifFilter.includes(e.classificacao_valor)) return false;
      if (sectorFilter.length && !sectorFilter.includes(e.sector)) return false;
      if (icpOnly && !e.is_icp) return false;
      if (heatFilter && _leadHeat(e).key !== heatFilter) return false;
      return true;
    });
    r.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'razao': cmp = (a.razao_social || '').localeCompare(b.razao_social || ''); break;
        case 'contratos': cmp = (a.contracts_pncp || 0) - (b.contracts_pncp || 0); break;
        case 'valor': cmp = (a.valor_total_contratos || 0) - (b.valor_total_contratos || 0); break;
        case 'faturamento': cmp = (a.faturamento_estimado || 0) - (b.faturamento_estimado || 0); break;
        case 'classif': {
          const ord = { alto: 3, medio: 2, baixo: 1 };
          cmp = (ord[a.classificacao_valor] || 0) - (ord[b.classificacao_valor] || 0); break;
        }
        case 'uf': cmp = (a.uf || '').localeCompare(b.uf || ''); break;
        case 'icp': cmp = (a.icp_score || 0) - (b.icp_score || 0); break;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    return r;
  }, [empresas, search, ufFilter, porteFilter, classifFilter, sectorFilter, icpOnly, heatFilter, sortField, sortOrder]);

  return _renderPNCP({
    fmt, loading, err, empresas, filtered, filterOpts,
    search, setSearch,
    ufFilter, setUfFilter, porteFilter, setPorteFilter,
    classifFilter, setClassifFilter, sectorFilter, setSectorFilter,
    icpOnly, setIcpOnly, heatFilter, setHeatFilter,
    sortField, setSortField, sortOrder, setSortOrder,
    page, setPage, selected, setSelected, load,
  });
}
window.PNCP = PNCP;

function _renderPNCP(p) {
  const {
    fmt, loading, err, empresas, filtered, filterOpts,
    search, setSearch,
    ufFilter, setUfFilter, porteFilter, setPorteFilter,
    classifFilter, setClassifFilter, sectorFilter, setSectorFilter,
    icpOnly, setIcpOnly, heatFilter, setHeatFilter,
    sortField, setSortField, sortOrder, setSortOrder,
    page, setPage, selected, setSelected, load,
  } = p;

  // stats em cima do filtrado pra dar feedback imediato
  const stats = React.useMemo(() => ({
    total: filtered.length,
    alto:  filtered.filter(e => e.classificacao_valor === 'alto').length,
    medio: filtered.filter(e => e.classificacao_valor === 'medio').length,
    baixo: filtered.filter(e => e.classificacao_valor === 'baixo').length,
    icp:   filtered.filter(e => e.is_icp).length,
    hot:   filtered.filter(e => _leadHeat(e).key === 'hot').length,
    warm:  filtered.filter(e => _leadHeat(e).key === 'warm').length,
    valor: filtered.reduce((s, e) => s + (e.valor_total_contratos || 0), 0),
    contratos: filtered.reduce((s, e) => s + (e.contracts_pncp || 0), 0),
  }), [filtered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PNCP_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PNCP_PAGE_SIZE, safePage * PNCP_PAGE_SIZE);

  const clearFilters = () => {
    setSearch(''); setUfFilter([]); setPorteFilter([]); setClassifFilter([]);
    setSectorFilter([]); setIcpOnly(false); setHeatFilter(null); setPage(1);
  };
  const hasFilters = search || ufFilter.length || porteFilter.length || classifFilter.length
    || sectorFilter.length || icpOnly || heatFilter;

  const handleSort = (field) => {
    if (sortField === field) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder(field === 'razao' || field === 'uf' ? 'asc' : 'desc'); }
    setPage(1);
  };

  const allOnPageSelected = paginated.length > 0 && paginated.every(e => selected.has(e.id));
  const toggleAll = () => {
    const ns = new Set(selected);
    if (allOnPageSelected) paginated.forEach(e => ns.delete(e.id));
    else paginated.forEach(e => ns.add(e.id));
    setSelected(ns);
  };
  const toggleOne = (id) => {
    const ns = new Set(selected);
    ns.has(id) ? ns.delete(id) : ns.add(id);
    setSelected(ns);
  };

  const exportCSV = () => {
    const items = selected.size > 0 ? filtered.filter(e => selected.has(e.id)) : filtered;
    if (!items.length) { window.toast.warn('Nenhum fornecedor pra exportar'); return; }
    const headers = ['Razão Social','Nome Fantasia','CNPJ','UF','Município','Porte','Setor','CNAE','Faturamento','Funcionários','Contratos PNCP','Valor Total','Classificação','ICP','Website','LinkedIn'];
    const rows = items.map(e => [
      e.razao_social || '', e.nome_fantasia || '', e.cnpj || '', e.uf || '', e.municipio || '',
      e.porte || '', e.sector || '', e.cnae_principal || '', e.faturamento_estimado || 0,
      e.num_funcionarios || 0, e.contracts_pncp || 0, e.valor_total_contratos || 0,
      e.classificacao_valor || '', e.is_icp ? 'Sim' : 'Não', e.website || '', e.linkedin_url || '',
    ]);
    const csv = [headers.join(';'), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';'))].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fornecedores_pncp_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    window.toast.success(`${items.length} fornecedores exportados`);
  };

  if (err) {
    return (
      <div className="card" style={{padding:32, textAlign:'center'}}>
        <p style={{color:'hsl(var(--danger))', marginBottom:12}}>Falha ao carregar fornecedores: {err}</p>
        <button className="btn btn-ghost btn-sm" onClick={load}>Tentar novamente</button>
      </div>
    );
  }

  return _renderPNCPLayout({
    fmt, loading, empresas, filtered, paginated, filterOpts, stats,
    search, setSearch,
    ufFilter, setUfFilter, porteFilter, setPorteFilter,
    classifFilter, setClassifFilter, sectorFilter, setSectorFilter,
    icpOnly, setIcpOnly, heatFilter, setHeatFilter,
    sortField, sortOrder, handleSort,
    page: safePage, setPage, totalPages,
    selected, setSelected, toggleOne, toggleAll, allOnPageSelected,
    clearFilters, hasFilters, exportCSV, load,
  });
}

function _PNCPHeader({ filtered, empresas, selected, exportCSV, load }) {
  return (
    <div className="page-head">
      <div>
        <h1 className="page-title">
          Descoberta PNCP
          <span className="chip success" style={{marginLeft:8}}><span className="dot"/>sync ativo</span>
        </h1>
        <div className="page-sub">
          {filtered.length} de {empresas.length} fornecedores · descobertos via PNCP
          {selected.size > 0 && <span style={{color:'hsl(var(--b-accent))', marginLeft:6}}>· {selected.size} selecionados</span>}
        </div>
      </div>
      <div className="actions">
        <button className="btn btn-ghost btn-sm" onClick={load}><I.refresh size={12}/>Atualizar</button>
        <button className="btn btn-ghost btn-sm" onClick={exportCSV}>
          <I.download size={12}/>Exportar {selected.size > 0 ? `(${selected.size})` : 'CSV'}
        </button>
        <button className="btn btn-accent btn-sm" onClick={() => window.__nav('execucoes')}>
          <I.refresh size={12}/>Nova ingestão
        </button>
      </div>
    </div>
  );
}

function _PNCPStatCard({ label, value, sub, icon, active, onClick, color }) {
  const bg = color ? `hsl(var(--${color}-soft))` : 'hsl(var(--surface))';
  const fg = color ? `hsl(var(--${color}))` : 'hsl(var(--fg))';
  return (
    <div
      onClick={onClick}
      className="card"
      style={{
        padding:16, cursor: onClick ? 'pointer' : 'default',
        borderColor: active ? fg : undefined,
        background: active ? bg : undefined,
        transition:'.15s',
      }}
    >
      <div className="row" style={{gap:8, color: fg, marginBottom:6, fontSize:11.5, fontWeight:600, textTransform:'uppercase', letterSpacing:'.04em'}}>
        {icon}
        <span>{label}</span>
      </div>
      <div style={{fontSize:24, fontWeight:700, fontVariantNumeric:'tabular-nums'}}>{value}</div>
      {sub && <div style={{fontSize:11, color:'hsl(var(--fg-muted))', marginTop:2}}>{sub}</div>}
    </div>
  );
}

function _PNCPTable({ fmt, loading, paginated, filtered, sortField, sortOrder, handleSort, allOnPageSelected, toggleAll, toggleOne, selected, hasFilters }) {
  return (
    <div className="card">
      <div style={{overflowX:'auto'}}>
        <table className="table">
          <thead>
            <tr>
              <th style={{width:36}}>
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  onChange={toggleAll}
                  style={{cursor:'pointer'}}
                />
              </th>
              <SortHeader field="razao" current={sortField} order={sortOrder} onSort={handleSort}>Empresa</SortHeader>
              <th>Setor</th>
              <SortHeader field="uf" current={sortField} order={sortOrder} onSort={handleSort}>UF</SortHeader>
              <th>Porte</th>
              <SortHeader field="contratos" current={sortField} order={sortOrder} onSort={handleSort} align="right">Contratos</SortHeader>
              <SortHeader field="valor" current={sortField} order={sortOrder} onSort={handleSort} align="right">Valor Total</SortHeader>
              <SortHeader field="classif" current={sortField} order={sortOrder} onSort={handleSort}>Classificação</SortHeader>
              <th>Lead Heat</th>
              <SortHeader field="icp" current={sortField} order={sortOrder} onSort={handleSort}>ICP</SortHeader>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan="11" style={{padding:24}}>
                <div style={{display:'flex', flexDirection:'column', gap:10}}>
                  {[0,1,2,3,4].map(i => <Skeleton key={i} height={28}/>)}
                </div>
              </td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan="11" style={{textAlign:'center', padding:48, color:'hsl(var(--fg-muted))'}}>
                {hasFilters
                  ? 'Nenhum fornecedor bate os filtros. Tente afrouxar a busca.'
                  : 'Nenhum fornecedor descoberto via PNCP ainda. Dispare uma ingestão em Execuções.'}
              </td></tr>
            )}
            {!loading && paginated.map(e => (
              <_PNCPRow
                key={e.id}
                e={e}
                fmt={fmt}
                isSelected={selected.has(e.id)}
                onToggle={toggleOne}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function _PNCPPager({ page, totalPages, setPage, filtered }) {
  if (totalPages <= 1) return null;
  const startIdx = (page - 1) * PNCP_PAGE_SIZE;
  const endIdx = Math.min(page * PNCP_PAGE_SIZE, filtered.length);
  const pages = [];
  // Mostra até 5 páginas; centraliza ao redor da página atual
  const maxBtns = 5;
  let from = Math.max(1, page - Math.floor(maxBtns / 2));
  let to = Math.min(totalPages, from + maxBtns - 1);
  from = Math.max(1, to - maxBtns + 1);
  for (let i = from; i <= to; i++) pages.push(i);
  return (
    <div className="row-between" style={{marginTop:16, padding:'0 4px'}}>
      <div className="muted" style={{fontSize:12}}>
        Mostrando {startIdx + 1}–{endIdx} de {filtered.length}
      </div>
      <div className="row" style={{gap:6}}>
        <button className="btn btn-xs btn-ghost" disabled={page === 1} onClick={() => setPage(page - 1)}>
          <I.chevron size={11} style={{transform:'rotate(90deg)'}}/>
        </button>
        {pages.map(n => (
          <button
            key={n}
            className={`btn btn-xs ${n === page ? 'btn-accent' : 'btn-ghost'}`}
            style={{minWidth:30}}
            onClick={() => setPage(n)}
          >{n}</button>
        ))}
        <button className="btn btn-xs btn-ghost" disabled={page === totalPages} onClick={() => setPage(page + 1)}>
          <I.chevron size={11} style={{transform:'rotate(-90deg)'}}/>
        </button>
      </div>
    </div>
  );
}

function _PNCPBulkBar({ selected, setSelected, filtered, exportCSV }) {
  if (selected.size === 0) return null;

  const markAsLead = async () => {
    const items = filtered.filter(e => selected.has(e.id));
    let ok = 0, err = 0;
    for (const e of items) {
      try {
        await window.API.api(`/empresas/${e.id}`, {
          method: 'PATCH',
          body: { status: 'lead' },
        });
        ok++;
      } catch { err++; }
    }
    if (ok) window.toast.success(`${ok} empresa${ok>1?'s':''} marcada${ok>1?'s':''} como lead`);
    if (err) window.toast.error(`${err} falharam`);
    setSelected(new Set());
  };

  return (
    <div
      className="card"
      style={{
        padding:'12px 16px', marginBottom:14,
        background:'hsl(var(--b-accent-soft))', borderColor:'hsl(var(--b-accent) / .35)',
        display:'flex', alignItems:'center', gap:12, flexWrap:'wrap',
      }}
    >
      <strong style={{color:'hsl(var(--b-accent))', fontSize:13}}>
        {selected.size} fornecedor{selected.size>1?'es':''} selecionado{selected.size>1?'s':''}
      </strong>
      <div style={{flex:1}}/>
      <button className="btn btn-sm btn-ghost" onClick={markAsLead}>
        <I.target size={12}/>Marcar como lead
      </button>
      <button className="btn btn-sm btn-ghost" onClick={exportCSV}>
        <I.download size={12}/>Exportar selecionados
      </button>
      <button className="btn btn-sm btn-ghost" onClick={() => setSelected(new Set())}>
        <I.close size={12}/>Limpar
      </button>
    </div>
  );
}

function _renderPNCPLayout(p) {
  const {
    fmt, loading, empresas, filtered, paginated, filterOpts, stats,
    search, setSearch, ufFilter, setUfFilter, porteFilter, setPorteFilter,
    classifFilter, setClassifFilter, sectorFilter, setSectorFilter,
    icpOnly, setIcpOnly, heatFilter, setHeatFilter,
    sortField, sortOrder, handleSort,
    page, setPage, totalPages,
    selected, setSelected, toggleOne, toggleAll, allOnPageSelected,
    clearFilters, hasFilters, exportCSV, load,
  } = p;
  return (
    <>
      <_PNCPHeader
        filtered={filtered} empresas={empresas} selected={selected}
        exportCSV={exportCSV} load={load}
      />
      <_PNCPStats
        fmt={fmt} stats={stats}
        classifFilter={classifFilter} setClassifFilter={setClassifFilter}
        heatFilter={heatFilter} setHeatFilter={setHeatFilter}
        icpOnly={icpOnly} setIcpOnly={setIcpOnly}
        setPage={setPage}
      />
      <_PNCPFilters
        filterOpts={filterOpts}
        search={search} setSearch={setSearch}
        ufFilter={ufFilter} setUfFilter={setUfFilter}
        porteFilter={porteFilter} setPorteFilter={setPorteFilter}
        classifFilter={classifFilter} setClassifFilter={setClassifFilter}
        sectorFilter={sectorFilter} setSectorFilter={setSectorFilter}
        hasFilters={hasFilters} clearFilters={clearFilters} setPage={setPage}
      />
      <_PNCPBulkBar
        selected={selected} setSelected={setSelected}
        filtered={filtered} exportCSV={exportCSV}
      />
      <_PNCPTable
        fmt={fmt} loading={loading}
        paginated={paginated} filtered={filtered}
        sortField={sortField} sortOrder={sortOrder} handleSort={handleSort}
        allOnPageSelected={allOnPageSelected} toggleAll={toggleAll}
        toggleOne={toggleOne} selected={selected} hasFilters={hasFilters}
      />
      <_PNCPPager page={page} totalPages={totalPages} setPage={setPage} filtered={filtered}/>
    </>
  );
}

function _PNCPRow({ e, fmt, isSelected, onToggle }) {
  const heat = _leadHeat(e);
  const classif = _classifMeta(e.classificacao_valor);
  const open = () => window.__nav('lead', e.id);
  return (
    <tr
      onClick={open}
      style={{cursor:'pointer', background: isSelected ? 'hsl(var(--b-accent-soft) / .35)' : undefined}}
    >
      <td onClick={(ev) => ev.stopPropagation()} style={{width:36}}>
        <input type="checkbox" checked={isSelected} onChange={() => onToggle(e.id)} style={{cursor:'pointer'}}/>
      </td>
      <td>
        <div className="row" style={{gap:10}}>
          <UI.Avatar name={e.razao_social || e.nome_fantasia || '?'} size={32}/>
          <div style={{minWidth:0}}>
            <div style={{fontWeight:600, fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:280}}>
              {e.razao_social || e.nome_fantasia || '(sem nome)'}
            </div>
            <div className="muted mono" style={{fontSize:10.5}}>{fmt.cnpj(e.cnpj)}</div>
          </div>
        </div>
      </td>
      <td style={{fontSize:12}}>
        {e.sector || e.cnae_principal_descricao || <span className="faint">—</span>}
      </td>
      <td><span className="chip">{e.uf || '—'}</span></td>
      <td style={{fontSize:12}}>{e.porte || <span className="faint">—</span>}</td>
      <td className="mono" style={{textAlign:'right', fontWeight:600}}>{e.contracts_pncp || 0}</td>
      <td className="mono" style={{textAlign:'right', fontWeight:700, color:'hsl(var(--b-accent))'}}>
        {fmt.brlK(e.valor_total_contratos || 0)}
      </td>
      <td>
        <span className={`chip ${classif.color}`}>{classif.label}</span>
      </td>
      <td>
        <span className={`chip ${heat.color}`}>{heat.label}</span>
      </td>
      <td>
        {e.is_icp
          ? <span className="chip success"><I.target size={10}/>ICP</span>
          : <span className="faint" style={{fontSize:11}}>—</span>}
      </td>
      <td onClick={(ev) => ev.stopPropagation()}>
        <button className="btn btn-xs btn-ghost" onClick={open}>Abrir</button>
      </td>
    </tr>
  );
}

function _PNCPFilters({ filterOpts, search, setSearch, ufFilter, setUfFilter, porteFilter, setPorteFilter, classifFilter, setClassifFilter, sectorFilter, setSectorFilter, hasFilters, clearFilters, setPage }) {
  const porteLabel = (k) => (PORTE_OPTS.find(p => p.key === k) || {}).label || k;
  const classifLabel = (k) => (CLASSIFICACAO_OPTS.find(c => c.key === k) || {}).label || k;
  return (
    <div className="filters-bar">
      <div className="row" style={{gap:8, flex:1, minWidth:240, padding:'0 10px', height:34, background:'hsl(var(--surface))', border:'1px solid hsl(var(--border))', borderRadius:8, alignItems:'center'}}>
        <I.search size={14}/>
        <input
          placeholder="Buscar por razão social, fantasia ou CNPJ…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          style={{flex:1, border:0, padding:0, background:'transparent', fontSize:13, outline:'none', color:'hsl(var(--fg))'}}
        />
      </div>
      <MultiSelect
        label="UF" width={110}
        options={filterOpts.ufs}
        selected={ufFilter}
        onChange={v => { setUfFilter(v); setPage(1); }}
      />
      <MultiSelect
        label="Porte" width={170}
        options={filterOpts.portes}
        selected={porteFilter}
        onChange={v => { setPorteFilter(v); setPage(1); }}
        formatOption={porteLabel}
      />
      <MultiSelect
        label="Classificação" width={150}
        options={CLASSIFICACAO_OPTS.map(c => c.key)}
        selected={classifFilter}
        onChange={v => { setClassifFilter(v); setPage(1); }}
        formatOption={classifLabel}
      />
      <MultiSelect
        label="Setor" width={170}
        options={filterOpts.sectors}
        selected={sectorFilter}
        onChange={v => { setSectorFilter(v); setPage(1); }}
      />
      {hasFilters && (
        <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
          <I.close size={11}/>Limpar
        </button>
      )}
    </div>
  );
}

function _PNCPStats({ fmt, stats, classifFilter, setClassifFilter, heatFilter, setHeatFilter, icpOnly, setIcpOnly, setPage }) {
  return (
    <div className="grid-3" style={{gridTemplateColumns:'repeat(auto-fit, minmax(170px, 1fr))', gap:12, marginBottom:20}}>
      <_PNCPStatCard
        label="Total" value={fmt.num(stats.total)}
        sub={`${fmt.num(stats.contratos)} contratos · ${fmt.brlK(stats.valor)}`}
        icon={<I.building size={12}/>}
      />
      <_PNCPStatCard
        label="Quentes 🔥" value={stats.hot} sub="Alto valor + 3+ contratos"
        color="danger" active={heatFilter === 'hot'}
        onClick={() => { setHeatFilter(heatFilter === 'hot' ? null : 'hot'); setPage(1); }}
      />
      <_PNCPStatCard
        label="Mornos 🌡️" value={stats.warm} sub="Alto valor ou 5+ contratos"
        color="warning" active={heatFilter === 'warm'}
        onClick={() => { setHeatFilter(heatFilter === 'warm' ? null : 'warm'); setPage(1); }}
      />
      <_PNCPStatCard
        label="Alto Valor" value={stats.alto} sub="≥ R$ 1MM em contratos"
        color="success" active={classifFilter.includes('alto')}
        onClick={() => { setClassifFilter(classifFilter.includes('alto') ? [] : ['alto']); setPage(1); }}
      />
      <_PNCPStatCard
        label="Médio" value={stats.medio}
        color="warning" active={classifFilter.includes('medio')}
        onClick={() => { setClassifFilter(classifFilter.includes('medio') ? [] : ['medio']); setPage(1); }}
      />
      <_PNCPStatCard
        label="Baixo" value={stats.baixo}
        active={classifFilter.includes('baixo')}
        onClick={() => { setClassifFilter(classifFilter.includes('baixo') ? [] : ['baixo']); setPage(1); }}
      />
      <_PNCPStatCard
        label="ICP" value={stats.icp} sub="Bate o perfil ideal"
        color="info" active={icpOnly}
        onClick={() => { setIcpOnly(!icpOnly); setPage(1); }}
        icon={<I.target size={12}/>}
      />
    </div>
  );
}
