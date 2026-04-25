// Lead Detail - full profile w/ PNCP history, score breakdown, AI summary
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
                <span className="muted">·</span>
                <a href="#" style={{color:'hsl(var(--b-accent))', fontSize:13, fontWeight:600}}>{c.website}</a>
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
            <div className="card-head">
              <div className="card-title">Perfil enriquecido</div>
              <span className="chip success"><I.check size={10}/>CNPJ.ws</span>
            </div>
            <div className="card-p" style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:16}}>
              <InfoField label="Faturamento" value={fmt.brlK(c.revenue)} hot={c.revenue >= 100_000_000}/>
              <InfoField label="Funcionários" value={fmt.num(c.employees)}/>
              <InfoField label="Setor" value={c.sector}/>
              <InfoField label="Contratos PNCP" value={c.contractsPncp}/>
              <InfoField label="Ativos em Governo" value={c.ativosGov}/>
              <InfoField label="Ticket médio" value={fmt.brlK(c.ticketMedio)}/>
            </div>
            <div style={{padding:'0 20px 18px'}}>
              <div className="faint" style={{fontSize:10, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:6}}>Stack técnica</div>
              <div className="row" style={{gap:6, flexWrap:'wrap'}}>
                {c.stack.map(s => <span key={s} className="chip primary">{s}</span>)}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <div className="card-title">Histórico PNCP</div>
              <span className="chip">{contracts.length} contratos · {fmt.brlK(totalPncp)}</span>
            </div>
            <table className="table">
              <thead><tr><th>Órgão</th><th>Objeto</th><th>Valor</th><th>Publicado</th></tr></thead>
              <tbody>
                {contracts.map(p => (
                  <tr key={p.id}>
                    <td><strong style={{fontSize:12.5}}>{p.orgao}</strong><div className="muted mono" style={{fontSize:10}}>{p.numero}</div></td>
                    <td style={{maxWidth:280, fontSize:12.5}}>{p.objeto}</td>
                    <td><strong className="mono" style={{color:'hsl(var(--b-accent))'}}>{fmt.brlK(p.valor)}</strong></td>
                    <td className="muted" style={{fontSize:12}}>{fmt.date(p.publicado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <div className="card-head"><div className="card-title">Atividades & Timeline</div></div>
            <div className="card-p">
              {[
                { i:'sparkle', t:'IA gerou resumo da última interação', s:'Análise automática concluída', when:'há 2h'},
                { i:'mail', t:'E-mail enviado para Ana Paula (CTO)', s:'Proposta de bodyshop Java', when:'hoje 09:12'},
                { i:'phone', t:'Ligação realizada', s:'Amanda Costa · 14 min', when:'ontem'},
                { i:'doc', t:'Contrato PNCP atualizado', s:'INSS — R$ 41M', when:'há 4 dias'},
              ].map((e,i) => (
                <div key={i} className="timeline-event">
                  <div className="te-ico">{React.createElement(I[e.i], {size:14})}</div>
                  <div className="te-body"><strong>{e.t}</strong><div className="muted">{e.s}</div></div>
                  <div className="te-time">{e.when}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{display:'flex', flexDirection:'column', gap:'var(--gap)'}}>
          <div className="card halo">
            <div className="card-p" style={{textAlign:'center'}}>
              <div className="faint" style={{fontSize:10, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:10}}>Bradata Score</div>
              <UI.ScoreRing value={c.score} size={100} stroke={8}/>
              <div style={{marginTop:10, fontWeight:700, fontSize:13, color: c.score>=80?'hsl(var(--success))':'hsl(var(--warning))'}}>
                {c.score >= 80 ? '🔥 Lead prioritário' : c.score >= 60 ? 'Potencial médio' : 'Baixa prioridade'}
              </div>
              <div className="divider"/>
              <div style={{textAlign:'left'}}>
                {[
                  { l:'Faturamento (100MM+)', v: c.revenue >= 100_000_000 ? 25 : 10, max: 25 },
                  { l:'Fit setorial', v: 20, max: 20 },
                  { l:'Contratos ativos Gov', v: Math.min(20, c.ativosGov/3), max: 20 },
                  { l:'Stack compatível', v: 15, max: 20 },
                  { l:'Engajamento', v: 12, max: 15 },
                ].map(b => (
                  <div key={b.l} style={{marginBottom:10}}>
                    <div className="row-between" style={{fontSize:11.5, marginBottom:3}}><span className="muted">{b.l}</span><strong className="mono">{Math.round(b.v)}/{b.max}</strong></div>
                    <div className="progress" style={{height:4}}><span style={{width:`${(b.v/b.max)*100}%`}}/></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <div className="row" style={{gap:8}}>
                <div style={{width:26, height:26, borderRadius:8, background:'linear-gradient(135deg, hsl(var(--b-accent)), hsl(var(--b-accent-light)))', display:'grid', placeItems:'center', color:'white'}}><I.sparkle size={12}/></div>
                <div className="card-title">Resumo IA Bradata</div>
              </div>
            </div>
            <div className="card-p" style={{fontSize:13, lineHeight:1.6}}>
              <p style={{margin:'0 0 10px'}}>{c.name} é {c.sector === 'Integradora' ? 'uma das maiores integradoras do Brasil' : 'um player relevante em TI'}, com <strong>{fmt.num(c.employees)} funcionários</strong> e faturamento de <strong>{fmt.brlK(c.revenue)}</strong>.</p>
              <p style={{margin:'0 0 10px'}}>Possui <strong>{c.contractsPncp} contratos</strong> no PNCP, sendo <strong>{c.ativosGov} ativos em governo</strong>. Stack predominante inclui {c.stack.slice(0,2).join(', ')}.</p>
              <p style={{margin:0}}><strong style={{color:'hsl(var(--b-accent))'}}>Sugestão:</strong> enviar pitch de Bodyshop para a CTO. Timing ideal por ter contrato de {fmt.brlK(contracts[0]?.valor || 0)} recente em {contracts[0]?.orgao || 'órgão federal'}.</p>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><div className="card-title">Contatos-chave</div><button className="btn btn-xs btn-ghost"><I.plus size={10}/></button></div>
            <div className="card-p" style={{padding:0}}>
              {[
                {n:'Ana Paula Souza', r:'CTO', e:'ana.souza@'+c.website},
                {n:'Carlos Mendes', r:'Head de TI', e:'carlos.m@'+c.website},
                {n:'Juliana Rocha', r:'Gerente de Contratos', e:'juliana.r@'+c.website},
              ].slice(0, c.contactsN).map((p,i) => (
                <div key={i} style={{padding:'12px 20px', borderBottom:'1px solid hsl(var(--border))', display:'flex', alignItems:'center', gap:10}}>
                  <UI.Avatar name={p.n} size={32}/>
                  <div style={{flex:1, minWidth:0}}>
                    <strong style={{fontSize:13}}>{p.n}</strong>
                    <div className="muted" style={{fontSize:11}}>{p.r} · <span className="mono">{p.e}</span></div>
                  </div>
                  <button className="icon-btn"><I.mail size={14}/></button>
                </div>
              ))}
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

function InfoField({ label, value, hot }) {
  return (
    <div>
      <div className="faint" style={{fontSize:10, textTransform:'uppercase', letterSpacing:'.05em'}}>{label}</div>
      <div style={{fontSize:15, fontWeight:700, color: hot?'hsl(var(--b-accent))':'hsl(var(--fg))', fontVariantNumeric:'tabular-nums'}}>
        {value} {hot && <I.fire size={12} style={{display:'inline', verticalAlign:'middle'}}/>}
      </div>
    </div>
  );
}

window.LeadDetail = LeadDetail;
