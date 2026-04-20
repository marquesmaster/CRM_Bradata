function Dashboard() {
  return <DashboardExecutive/>;
}

function DashboardExecutive() {
  const { fmt, DEALS, STAGES, COMPANIES, PNCP_CONTRACTS } = window.DATA;
  const pipelineTotal = DEALS.filter(d=>d.stage!=='ganho').reduce((s,d)=>s+d.value,0);
  const won = DEALS.filter(d=>d.stage==='ganho').reduce((s,d)=>s+d.value,0);
  const stageSums = STAGES.map(s => ({ ...s, v: DEALS.filter(d=>d.stage===s.id).reduce((a,b)=>a+b.value,0), n: DEALS.filter(d=>d.stage===s.id).length }));
  const hotLeads = Object.values(COMPANIES).filter(c=>c.score>=80).sort((a,b)=>b.score-a.score).slice(0,5);
  const recentPncp = PNCP_CONTRACTS.slice().sort((a,b)=>new Date(b.publicado)-new Date(a.publicado)).slice(0,4);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Bom dia, Rafael 👋</h1>
          <div className="page-sub">Você tem <strong>7 atividades pendentes</strong> e <strong style={{color:'hsl(var(--b-accent))'}}>3 novos leads</strong> detectados no PNCP hoje.</div>
        </div>
        <div className="actions">
          <button className="btn btn-ghost"><I.download size={14}/>Exportar</button>
          <button className="btn btn-accent"><I.plus size={14}/>Nova oportunidade</button>
        </div>
      </div>
      <div className="kpi-grid" style={{marginBottom:'var(--gap)'}}>
        <KPI label="Pipeline aberto" value={fmt.brlK(pipelineTotal)} delta="+18%" dir="up" foot="vs. mês anterior" spark={[20,24,22,28,32,30,36,42,46]} accent="b-accent"/>
        <KPI label="Ganhos no mês" value={fmt.brlK(won)} delta="+R$ 820k" dir="up" foot="2 deals fechados" spark={[10,12,14,18,16,22,28,32,38]} accent="success"/>
        <KPI label="Leads PNCP ativos" value="127" delta="+12 esta semana" dir="up" foot="Score médio: 74" spark={[40,42,38,45,52,48,58,62,68]} accent="info"/>
        <KPI label="Taxa de conversão" value="34%" delta="-2pp" dir="down" foot="Meta: 40%" spark={[30,34,38,35,40,36,32,34,34]} accent="warning"/>
      </div>
      <div className="grid-dash">
        <div className="card">
          <div className="card-head"><div><div className="card-title">Funil de vendas</div><div className="card-sub">Distribuição por estágio — {fmt.brlK(pipelineTotal)} total</div></div></div>
          <div className="card-p">
            <div style={{display:'flex', flexDirection:'column', gap:14}}>
              {stageSums.filter(s=>s.id!=='ganho').map(s => {
                const pct = pipelineTotal ? (s.v / pipelineTotal) * 100 : 0;
                return (
                  <div key={s.id}>
                    <div className="row-between" style={{fontSize:13, marginBottom:6}}>
                      <div className="row" style={{gap:8}}>
                        <span style={{width:8, height:8, borderRadius:'50%', background:s.color}}/>
                        <strong>{s.label}</strong>
                        <span className="muted">{s.n} deals</span>
                      </div>
                      <strong className="mono">{fmt.brlK(s.v)}</strong>
                    </div>
                    <div className="progress" style={{height:10}}>
                      <span style={{width: `${pct}%`, background: s.color}}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="card halo">
          <div className="card-head">
            <div className="row" style={{gap:8}}>
              <div style={{width:28, height:28, borderRadius:8, background:'linear-gradient(135deg, hsl(var(--b-accent)), hsl(var(--b-accent-light)))', display:'grid', placeItems:'center', color:'white'}}><I.sparkle size={14}/></div>
              <div><div className="card-title">Bradata AI</div><div className="card-sub">Insights de hoje</div></div>
            </div>
          </div>
          <div className="card-p" style={{display:'flex', flexDirection:'column', gap:12}}>
            <AIInsight tone="danger" title="SLA em risco — SERPRO" body="Deal de R$ 4,2M sem movimento há 5 dias." action="Enviar proposta agora"/>
            <AIInsight tone="accent" title="3 leads acabaram de cruzar 100MM" body="TIVIT, Stefanini e CI&T aumentaram faturamento." action="Abrir cadência"/>
            <AIInsight tone="info" title="Novo contrato PNCP — TCU" body="Everis venceu R$ 15,4M em AI aplicada." action="Ver contrato"/>
          </div>
        </div>
      </div>
      <div className="grid-dash" style={{marginTop:'var(--gap)'}}>
        <div className="card">
          <div className="card-head"><div><div className="card-title">Leads quentes</div><div className="card-sub">Score ≥ 80</div></div></div>
          <table className="table">
            <thead><tr><th>Empresa</th><th>Faturamento</th><th>Contratos PNCP</th><th>Score</th><th></th></tr></thead>
            <tbody>
              {hotLeads.map(c => (
                <tr key={c.id}>
                  <td><div className="row" style={{gap:10}}><UI.Avatar name={c.name} size={30}/><div><strong>{c.name}</strong><div className="muted mono" style={{fontSize:11}}>{fmt.cnpj(c.cnpj)}</div></div></div></td>
                  <td className="mono">{fmt.brlK(c.revenue)}</td>
                  <td><span className="chip primary">{c.contractsPncp} contratos</span></td>
                  <td><UI.ScoreRing value={c.score} size={40} stroke={4}/></td>
                  <td style={{textAlign:'right'}}><button className="btn btn-xs btn-ghost" onClick={()=>window.__nav('lead', c.id)}>Abrir</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <div className="card-head"><div className="card-title">PNCP — radar</div><span className="chip success"><span className="dot"/>ao vivo</span></div>
          <div className="card-p" style={{display:'flex', flexDirection:'column', gap:14}}>
            {recentPncp.map(p => (
              <div key={p.id} style={{paddingBottom:12, borderBottom:'1px dashed hsl(var(--border))'}}>
                <div className="row-between"><span className="chip info"><I.gov size={10}/>{p.orgao}</span><span className="muted" style={{fontSize:11}}>{fmt.relative(p.publicado)}</span></div>
                <div style={{fontSize:13, fontWeight:600, marginTop:6, lineHeight:1.35}}>{p.objeto}</div>
                <div className="row-between" style={{marginTop:8, fontSize:12}}>
                  <span className="muted">{p.fornecedor} · {p.modalidade}</span>
                  <strong className="mono" style={{color:'hsl(var(--b-accent))'}}>{fmt.brlK(p.valor)}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function KPI({ label, value, delta, dir, foot, spark, accent }) {
  return (
    <div className="kpi">
      <div className="glyph"/>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      <div className={`delta ${dir==='up'?'up':dir==='down'?'down':'neutral'}`}>
        {dir==='up'?<I.arrowUp/>:dir==='down'?<I.arrowDown/>:null} {delta}
      </div>
      <div className="foot">{foot}</div>
      {spark && <div className="spark"><UI.Spark points={spark} color={`var(--${accent||'b-accent'})`}/></div>}
    </div>
  );
}

function AIInsight({ tone, title, body, action }) {
  const c = tone==='danger'?'danger':tone==='info'?'info':'b-accent';
  return (
    <div style={{padding:12, borderRadius:10, background:`hsl(var(--${c}) / .06)`, border:`1px solid hsl(var(--${c}) / .2)`}}>
      <strong style={{fontSize:13, color:`hsl(var(--${c}))`}}>{title}</strong>
      <p style={{fontSize:12.5, color:'hsl(var(--fg-muted))', margin:'4px 0 10px', lineHeight:1.5}}>{body}</p>
      <button className="btn btn-xs" style={{background:`hsl(var(--${c}))`, color:'white'}}>{action} <I.chevron size={11}/></button>
    </div>
  );
}

window.Dashboard = Dashboard;
