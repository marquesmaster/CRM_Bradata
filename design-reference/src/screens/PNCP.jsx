// PNCP Discovery - 3 variants
function PNCP() {
  const variant = window.__TWEAKS__.discoveryVariant || 'cards';
  if (variant === 'table') return <PNCPTable/>;
  if (variant === 'radar') return <PNCPRadar/>;
  return <PNCPCards/>;
}

function PNCPFilters({ uf, setUf, faixa, setFaixa, modalidade, setModalidade }) {
  return (
    <div className="filters-bar">
      <div className="row" style={{gap:8, flex:1, minWidth:240}}>
        <I.search size={16}/>
        <input className="filter-input" placeholder="Buscar por CNPJ, fornecedor ou objeto do contrato…" style={{flex:1, border:0, padding:0, background:'transparent'}}/>
      </div>
      <select className="filter-select" value={uf} onChange={e=>setUf(e.target.value)}>
        <option value="">Todas UFs</option>
        <option>SP</option><option>RJ</option><option>DF</option><option>MG</option><option>RS</option><option>PR</option>
      </select>
      <select className="filter-select" value={faixa} onChange={e=>setFaixa(e.target.value)}>
        <option value="">Faixa faturamento</option>
        <option>100MM - 500MM</option>
        <option>500MM - 1Bi</option>
        <option>1Bi+</option>
      </select>
      <select className="filter-select" value={modalidade} onChange={e=>setModalidade(e.target.value)}>
        <option value="">Modalidade</option>
        <option>Pregão Eletrônico</option><option>Dispensa</option><option>Inexigibilidade</option>
      </select>
      <button className="btn btn-ghost btn-sm"><I.filter size={12}/>Filtros avançados</button>
      <button className="btn btn-accent btn-sm"><I.sparkle size={12}/>IA: Ranquear por fit</button>
    </div>
  );
}

function PNCPHeader({ subtitle }) {
  return (
    <div className="page-head">
      <div>
        <h1 className="page-title">Descoberta PNCP <span className="chip success" style={{marginLeft:8, verticalAlign:'middle'}}><span className="dot"/>sync ativo</span></h1>
        <div className="page-sub">{subtitle}</div>
      </div>
      <div className="actions">
        <button className="btn btn-ghost btn-sm"><I.refresh size={12}/>Atualizar</button>
        <button className="btn btn-ghost btn-sm"><I.download size={12}/>Exportar</button>
        <button className="btn btn-primary btn-sm"><I.plus size={12}/>Adicionar manual</button>
      </div>
    </div>
  );
}

// --- VARIANT A: CARDS  ---
function PNCPCards() {
  const { fmt, PNCP_CONTRACTS, COMPANIES } = window.DATA;
  const [uf, setUf] = React.useState('');
  const [faixa, setFaixa] = React.useState('');
  const [modalidade, setModalidade] = React.useState('');

  return (
    <>
      <PNCPHeader subtitle="3.847 empresas rastreadas · 12.491 contratos · atualizado há 8 min"/>
      <PNCPFilters {...{uf,setUf,faixa,setFaixa,modalidade,setModalidade}}/>

      <div className="grid-3" style={{gridTemplateColumns:'repeat(auto-fill, minmax(360px, 1fr))'}}>
        {PNCP_CONTRACTS.map(p => {
          const company = Object.values(COMPANIES).find(c => c.cnpj === p.cnpj_fornecedor);
          return (
            <div key={p.id} className="card" style={{display:'flex', flexDirection:'column'}}>
              <div className="card-p" style={{paddingBottom:12}}>
                <div className="row-between" style={{marginBottom:10}}>
                  <span className="chip info"><I.gov size={10}/>{p.orgao}</span>
                  <span className="chip">{p.modalidade}</span>
                </div>
                <div style={{fontSize:14, fontWeight:600, lineHeight:1.4, minHeight:38}}>{p.objeto}</div>

                <div style={{marginTop:14, display:'grid', gridTemplateColumns:'1fr auto', alignItems:'center', padding:'12px 0', borderTop:'1px solid hsl(var(--border))', borderBottom:'1px solid hsl(var(--border))'}}>
                  <div className="row" style={{gap:10}}>
                    <UI.Avatar name={p.fornecedor} size={34}/>
                    <div>
                      <strong style={{fontSize:13}}>{p.fornecedor}</strong>
                      <div className="muted mono" style={{fontSize:11}}>{fmt.cnpj(p.cnpj_fornecedor)}</div>
                    </div>
                  </div>
                  {company && <UI.ScoreRing value={company.score} size={38} stroke={4}/>}
                </div>

                <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8, marginTop:12}}>
                  <div>
                    <div className="faint" style={{fontSize:10, textTransform:'uppercase', letterSpacing:'.04em'}}>Valor</div>
                    <div className="mono" style={{fontWeight:700, color:'hsl(var(--b-accent))'}}>{fmt.brlK(p.valor)}</div>
                  </div>
                  <div>
                    <div className="faint" style={{fontSize:10, textTransform:'uppercase', letterSpacing:'.04em'}}>Vigência</div>
                    <div style={{fontSize:12, fontWeight:600}}>{p.vigencia}</div>
                  </div>
                  <div>
                    <div className="faint" style={{fontSize:10, textTransform:'uppercase', letterSpacing:'.04em'}}>Faturamento</div>
                    <div style={{fontSize:12, fontWeight:600}}>{company ? fmt.brlK(company.revenue) : '—'}</div>
                  </div>
                </div>

                {company && company.revenue >= 100_000_000 && (
                  <div style={{marginTop:12, padding:'8px 10px', background:'hsl(var(--b-accent-soft))', borderRadius:8, fontSize:11.5, color:'hsl(var(--b-accent))', fontWeight:600, display:'flex', alignItems:'center', gap:6}}>
                    <I.sparkle size={12}/> Empresa 100MM+ · fit para Bodyshop
                  </div>
                )}
              </div>
              <div style={{padding:'12px 20px', borderTop:'1px solid hsl(var(--border))', display:'flex', gap:6, background:'hsl(var(--surface-2))'}}>
                <button className="btn btn-xs btn-ghost" style={{flex:1}}>Ver perfil</button>
                <button className="btn btn-xs btn-accent" style={{flex:1}}><I.plus size={10}/>Criar lead</button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// --- VARIANT B: TABLE ---
function PNCPTable() {
  const { fmt, PNCP_CONTRACTS, COMPANIES } = window.DATA;
  const [uf, setUf] = React.useState(''); const [faixa, setFaixa] = React.useState(''); const [modalidade, setModalidade] = React.useState('');
  return (
    <>
      <PNCPHeader subtitle="Tabela densa — ideal para comparar e exportar"/>
      <PNCPFilters {...{uf,setUf,faixa,setFaixa,modalidade,setModalidade}}/>
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Órgão</th>
              <th>Fornecedor</th>
              <th>CNPJ</th>
              <th>Objeto</th>
              <th>Valor</th>
              <th>Modalidade</th>
              <th>Publicado</th>
              <th>Fit</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {PNCP_CONTRACTS.map(p => {
              const company = Object.values(COMPANIES).find(c => c.cnpj === p.cnpj_fornecedor);
              return (
                <tr key={p.id}>
                  <td><div className="row" style={{gap:6}}><I.gov size={12}/><strong style={{fontSize:12.5}}>{p.orgao}</strong></div><div className="muted mono" style={{fontSize:11}}>{p.numero}</div></td>
                  <td><div className="row" style={{gap:8}}><UI.Avatar name={p.fornecedor} size={26}/><strong style={{fontSize:12.5}}>{p.fornecedor}</strong></div></td>
                  <td className="mono faint" style={{fontSize:11}}>{fmt.cnpj(p.cnpj_fornecedor)}</td>
                  <td style={{maxWidth:280}}><div style={{fontSize:12.5, lineHeight:1.35, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden'}}>{p.objeto}</div></td>
                  <td><strong className="mono" style={{color:'hsl(var(--b-accent))'}}>{fmt.brlK(p.valor)}</strong></td>
                  <td><span className="chip">{p.modalidade}</span></td>
                  <td className="muted" style={{fontSize:12}}>{fmt.date(p.publicado)}</td>
                  <td>{company && <UI.ScoreRing value={company.score} size={34} stroke={4}/>}</td>
                  <td><button className="btn btn-xs btn-ghost">Abrir</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// --- VARIANT C: Radar / Map-like ---
function PNCPRadar() {
  const { fmt, PNCP_CONTRACTS, COMPANIES } = window.DATA;
  const [uf, setUf] = React.useState(''); const [faixa, setFaixa] = React.useState(''); const [modalidade, setModalidade] = React.useState('');
  // Group by orgao
  const byOrgao = {};
  PNCP_CONTRACTS.forEach(p => { if (!byOrgao[p.orgao]) byOrgao[p.orgao] = []; byOrgao[p.orgao].push(p); });
  return (
    <>
      <PNCPHeader subtitle="Radar por órgão — agrupe, compare e priorize oportunidades"/>
      <PNCPFilters {...{uf,setUf,faixa,setFaixa,modalidade,setModalidade}}/>
      <div className="grid-2">
        {Object.entries(byOrgao).map(([orgao, items]) => {
          const total = items.reduce((s,i)=>s+i.valor,0);
          return (
            <div key={orgao} className="card">
              <div className="card-head">
                <div>
                  <div className="row" style={{gap:8}}>
                    <div style={{width:32, height:32, borderRadius:9, background:'hsl(var(--info-soft))', display:'grid', placeItems:'center', color:'hsl(var(--info))'}}><I.gov size={15}/></div>
                    <div>
                      <div className="card-title">{orgao}</div>
                      <div className="card-sub">{items.length} contrato{items.length>1?'s':''} · {fmt.brlK(total)}</div>
                    </div>
                  </div>
                </div>
                <button className="btn btn-xs btn-ghost">Monitorar <I.bell size={10}/></button>
              </div>
              <div className="card-p" style={{padding:0}}>
                {items.map((p,i) => {
                  const company = Object.values(COMPANIES).find(c => c.cnpj === p.cnpj_fornecedor);
                  return (
                    <div key={p.id} style={{padding:'12px 20px', borderBottom: i<items.length-1?'1px solid hsl(var(--border))':'none', display:'grid', gridTemplateColumns:'1fr auto', gap:10, alignItems:'center'}}>
                      <div>
                        <div style={{fontSize:13, fontWeight:600, lineHeight:1.35, marginBottom:4}}>{p.objeto}</div>
                        <div className="row" style={{gap:8, fontSize:12}}>
                          <strong>{p.fornecedor}</strong>
                          <span className="muted">·</span>
                          <span className="muted">{p.modalidade}</span>
                          <span className="muted">·</span>
                          <span className="muted">{fmt.date(p.publicado)}</span>
                        </div>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <div className="mono" style={{fontWeight:700, color:'hsl(var(--b-accent))'}}>{fmt.brlK(p.valor)}</div>
                        {company && <div className="chip" style={{fontSize:10, marginTop:2}}>Score {company.score}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

window.PNCP = PNCP;
