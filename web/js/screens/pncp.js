function PNCP() {
  const { fmt, PNCP_CONTRACTS, COMPANIES } = window.DATA;
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Descoberta PNCP <span className="chip success" style={{marginLeft:8}}><span className="dot"/>sync ativo</span></h1>
          <div className="page-sub">{PNCP_CONTRACTS.length} contratos rastreados · classificados por IA</div>
        </div>
        <div className="actions">
          <button className="btn btn-ghost btn-sm"><I.refresh size={12}/>Atualizar</button>
          <button className="btn btn-accent btn-sm"><I.sparkle size={12}/>IA: Ranquear por fit</button>
        </div>
      </div>
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
                  <div><div className="faint" style={{fontSize:10, textTransform:'uppercase'}}>Valor</div><div className="mono" style={{fontWeight:700, color:'hsl(var(--b-accent))'}}>{fmt.brlK(p.valor)}</div></div>
                  <div><div className="faint" style={{fontSize:10, textTransform:'uppercase'}}>Vigência</div><div style={{fontSize:12, fontWeight:600}}>{p.vigencia}</div></div>
                  <div><div className="faint" style={{fontSize:10, textTransform:'uppercase'}}>Faturamento</div><div style={{fontSize:12, fontWeight:600}}>{company ? fmt.brlK(company.revenue) : '—'}</div></div>
                </div>
                {company && company.revenue >= 100_000_000 && (
                  <div style={{marginTop:12, padding:'8px 10px', background:'hsl(var(--b-accent-soft))', borderRadius:8, fontSize:11.5, color:'hsl(var(--b-accent))', fontWeight:600, display:'flex', alignItems:'center', gap:6}}>
                    <I.sparkle size={12}/> Empresa 100MM+ · fit para Bodyshop
                  </div>
                )}
              </div>
              <div style={{padding:'12px 20px', borderTop:'1px solid hsl(var(--border))', display:'flex', gap:6, background:'hsl(var(--surface-2))'}}>
                <button className="btn btn-xs btn-ghost" style={{flex:1}} onClick={()=>company && window.__nav('lead', company.id)}>Ver perfil</button>
                <button className="btn btn-xs btn-accent" style={{flex:1}}><I.plus size={10}/>Criar lead</button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
window.PNCP = PNCP;
