function LeadDetail({ companyId, onBack }) {
  const { fmt, COMPANIES, PNCP_CONTRACTS, DEALS } = window.DATA;
  const c = COMPANIES[companyId] || Object.values(COMPANIES)[0];
  const contracts = PNCP_CONTRACTS.filter(p => p.cnpj_fornecedor === c.cnpj);
  const deals = DEALS.filter(d => d.company === c.id);
  const totalPncp = contracts.reduce((s,p)=>s+p.valor,0);

  return (
    <>
      <div className="page-head">
        <div>
          <button className="btn btn-xs btn-ghost" onClick={onBack} style={{marginBottom:8}}><I.chevron size={10} style={{transform:'rotate(180deg)'}}/>Voltar</button>
          <div className="row" style={{gap:16}}>
            <UI.Avatar name={c.name} size={56}/>
            <div>
              <h1 className="page-title" style={{margin:0}}>{c.name}</h1>
              <div className="row" style={{gap:8, marginTop:4}}>
                <span className="mono muted" style={{fontSize:12}}>{fmt.cnpj(c.cnpj)}</span>
                <span className="muted">·</span>
                <span className="muted" style={{fontSize:13}}>{c.city}, {c.uf}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="actions">
          <button className="btn btn-ghost btn-sm"><I.mail size={12}/>E-mail</button>
          <button className="btn btn-ghost btn-sm"><I.phone size={12}/>Ligar</button>
          <button className="btn btn-accent btn-sm"><I.plus size={12}/>Nova oportunidade</button>
        </div>
      </div>
      <div className="grid-dash">
        <div style={{display:'flex', flexDirection:'column', gap:'var(--gap)'}}>
          <div className="card">
            <div className="card-head"><div className="card-title">Perfil enriquecido</div><span className="chip success"><I.check size={10}/>CNPJ.ws</span></div>
            <div className="card-p" style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:16}}>
              <Info label="Faturamento" value={fmt.brlK(c.revenue)} hot={c.revenue >= 100_000_000}/>
              <Info label="Funcionários" value={fmt.num(c.employees)}/>
              <Info label="Setor" value={c.sector}/>
              <Info label="Contratos PNCP" value={c.contractsPncp}/>
              <Info label="Ativos em Governo" value={c.ativosGov}/>
              <Info label="Ticket médio" value={fmt.brlK(c.ticketMedio)}/>
            </div>
            <div style={{padding:'0 20px 18px'}}>
              <div className="faint" style={{fontSize:10, textTransform:'uppercase', marginBottom:6}}>Stack técnica</div>
              <div className="row" style={{gap:6, flexWrap:'wrap'}}>
                {(c.stack||[]).map(s => <span key={s} className="chip primary">{s}</span>)}
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-head"><div className="card-title">Histórico PNCP</div><span className="chip">{contracts.length} contratos · {fmt.brlK(totalPncp)}</span></div>
            <table className="table">
              <thead><tr><th>Órgão</th><th>Objeto</th><th>Valor</th><th>Publicado</th></tr></thead>
              <tbody>
                {contracts.map(p => (
                  <tr key={p.id}>
                    <td><strong>{p.orgao}</strong><div className="muted mono" style={{fontSize:10}}>{p.numero}</div></td>
                    <td style={{maxWidth:280, fontSize:12.5}}>{p.objeto}</td>
                    <td><strong className="mono" style={{color:'hsl(var(--b-accent))'}}>{fmt.brlK(p.valor)}</strong></td>
                    <td className="muted">{fmt.date(p.publicado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div style={{display:'flex', flexDirection:'column', gap:'var(--gap)'}}>
          <div className="card halo">
            <div className="card-p" style={{textAlign:'center'}}>
              <div className="faint" style={{fontSize:10, textTransform:'uppercase', marginBottom:10}}>Bradata Score</div>
              <UI.ScoreRing value={c.score} size={100} stroke={8}/>
              <div style={{marginTop:10, fontWeight:700, fontSize:13, color: c.score>=80?'hsl(var(--success))':'hsl(var(--warning))'}}>
                {c.score >= 80 ? '🔥 Lead prioritário' : c.score >= 60 ? 'Potencial médio' : 'Baixa prioridade'}
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-head"><div className="row" style={{gap:8}}><div style={{width:26, height:26, borderRadius:8, background:'linear-gradient(135deg, hsl(var(--b-accent)), hsl(var(--b-accent-light)))', display:'grid', placeItems:'center', color:'white'}}><I.sparkle size={12}/></div><div className="card-title">Resumo IA Bradata</div></div></div>
            <div className="card-p" style={{fontSize:13, lineHeight:1.6}}>
              <p>{c.name} é {c.sector}, {fmt.num(c.employees)} funcionários, faturamento de {fmt.brlK(c.revenue)}.</p>
              <p>{c.contractsPncp} contratos no PNCP, {c.ativosGov} ativos em governo. Stack: {(c.stack||[]).slice(0,2).join(', ')}.</p>
              <p><strong style={{color:'hsl(var(--b-accent))'}}>Sugestão:</strong> enviar pitch de Bodyshop. Timing ideal por contrato recente em {contracts[0]?.orgao || 'órgão federal'}.</p>
            </div>
          </div>
          {deals.length>0 && <div className="card">
            <div className="card-head"><div className="card-title">Oportunidades ativas</div></div>
            <div className="card-p" style={{padding:0}}>
              {deals.map(d => (
                <div key={d.id} style={{padding:'12px 20px', borderBottom:'1px solid hsl(var(--border))'}}>
                  <div style={{fontSize:12.5, fontWeight:600}}>{d.title}</div>
                  <div className="row-between" style={{fontSize:11.5, marginTop:4}}>
                    <span className="chip" style={{fontSize:10}}>{window.DATA.STAGES.find(s=>s.id===d.stage)?.label}</span>
                    <strong className="mono">{fmt.brlK(d.value)}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>}
        </div>
      </div>
    </>
  );
}

function Info({ label, value, hot }) {
  return (
    <div>
      <div className="faint" style={{fontSize:10, textTransform:'uppercase'}}>{label}</div>
      <div style={{fontSize:15, fontWeight:700, color: hot?'hsl(var(--b-accent))':'hsl(var(--fg))'}}>
        {value} {hot && <I.fire size={12} style={{display:'inline', verticalAlign:'middle'}}/>}
      </div>
    </div>
  );
}

window.LeadDetail = LeadDetail;
