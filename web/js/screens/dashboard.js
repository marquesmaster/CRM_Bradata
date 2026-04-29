function Dashboard() {
  return <DashboardExecutive/>;
}

function DashboardExecutive() {
  const { fmt, DEALS, STAGES, COMPANIES, PNCP_CONTRACTS, CURRENT_USER } = window.DATA;
  const [analytics, setAnalytics] = React.useState(null);
  const [loadingA, setLoadingA] = React.useState(true);

  React.useEffect(() => {
    window.API.api('/relatorios/analytics')
      .then(a => { setAnalytics(a); setLoadingA(false); })
      .catch(() => setLoadingA(false));
  }, []);

  const stageById = Object.fromEntries(STAGES.map(s => [s.id, s]));
  const isGanho = (d) => stageById[d.stage]?.is_ganho;
  const pipelineTotal = DEALS.filter(d=>!isGanho(d)).reduce((s,d)=>s+(d.value||0),0);
  const won = DEALS.filter(isGanho).reduce((s,d)=>s+(d.value||0),0);
  const stageSums = STAGES.map(s => ({
    ...s,
    v: DEALS.filter(d=>d.stage===s.id).reduce((a,b)=>a+(b.value||0),0),
    n: DEALS.filter(d=>d.stage===s.id).length,
  }));
  const hotLeads = Object.values(COMPANIES).filter(c=>c.score>=80).sort((a,b)=>b.score-a.score).slice(0,5);
  const recentPncp = PNCP_CONTRACTS.slice().sort((a,b)=>new Date(b.publicado||0)-new Date(a.publicado||0)).slice(0,4);
  const firstName = (CURRENT_USER?.name || '').split(' ')[0] || 'time';

  const a = analytics;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Olá, {firstName} 👋</h1>
          <div className="page-sub">
            {DEALS.length} oportunidades · <strong style={{color:'hsl(var(--b-accent))'}}>{PNCP_CONTRACTS.length} contratos recentes</strong> no PNCP.
          </div>
        </div>
        <div className="actions">
          <button className="btn btn-ghost"><I.download size={14}/>Exportar</button>
          <button className="btn btn-accent"><I.plus size={14}/>Nova oportunidade</button>
        </div>
      </div>

      {/* ==== KPIs principais (dados reais) ==== */}
      <div className="kpi-grid" style={{marginBottom:'var(--gap)'}}>
        <KPI label="Pipeline aberto" value={fmt.brlK(a?.pipeline?.aberto ?? pipelineTotal)}
             foot={`Ponderado ${fmt.brlK(a?.pipeline?.ponderado ?? 0)}`} accent="b-accent"/>
        <KPI label="Receita ganha (YTD)" value={fmt.brlK(a?.pipeline?.receita_ganha_total ?? won)}
             foot={`${fmt.brlK(a?.pipeline?.receita_ganha_30d ?? 0)} nos últimos 30d`} accent="success"/>
        <KPI label="Ticket médio" value={fmt.brlK(a?.deals?.ticket_medio ?? 0)}
             foot={`Ciclo médio ${a?.deals?.ciclo_medio_dias ?? 0}d`} accent="info"/>
        <KPI label="Win rate" value={(a?.deals?.win_rate_pct ?? 0) + '%'}
             foot={`${a?.deals?.ganhos ?? 0} ganhos · ${a?.deals?.perdidos ?? 0} perdidos`} accent="warning"/>
      </div>

      {/* ==== ANÁLISE INTELIGENTE ==== */}
      <div className="card" style={{marginBottom:'var(--gap)', background:'linear-gradient(135deg, hsl(var(--b-primary) / .03), hsl(var(--b-accent) / .04))'}}>
        <div className="card-head">
          <div className="row" style={{gap:10}}>
            <div style={{width:32, height:32, borderRadius:8, background:'linear-gradient(135deg, hsl(var(--b-accent)), hsl(var(--b-accent-light)))', display:'grid', placeItems:'center', color:'white'}}>
              <I.sparkle size={16}/>
            </div>
            <div>
              <div className="card-title">Análise inteligente</div>
              <div className="card-sub">ROI · CAC · LTV · Comissão · Clientes por recência</div>
            </div>
          </div>
          {loadingA && <span className="chip">calculando…</span>}
        </div>
        <div className="card-p">
          {!a && loadingA && (
            <div style={{padding:18, display:'flex', flexDirection:'column', gap:10}}>
              {Array.from({length:3}).map((_,i) => <Skeleton key={i} height={48}/>)}
            </div>
          )}
          {!a && !loadingA && (
            <EmptyState compact icon={<I.chart size={18}/>} title="Sem métricas ainda" description="Crie deals para popular o dashboard."/>
          )}
          {a && <>
            {/* Financeiro */}
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:12, marginBottom:16}}>
              <Metric label="ROI" value={(a.financeiro.roi_estimado >= 0 ? '+' : '') + (a.financeiro.roi_estimado * 100).toFixed(0) + '%'}
                      sub={`Receita vs CAC × ${a.financeiro.meses_ativos} meses`}
                      color={a.financeiro.roi_estimado >= 0 ? 'success' : 'danger'}/>
              <Metric label="CAC" value={fmt.brlK(a.financeiro.cac)} sub="Mensal estimado" color="info"/>
              <Metric label="LTV" value={fmt.brlK(a.financeiro.ltv)} sub="Ticket × retenção" color="b-accent"/>
              <Metric label="LTV / CAC" value={a.financeiro.ltv_cac_ratio.toFixed(1) + 'x'}
                      sub={a.financeiro.ltv_cac_ratio >= 3 ? 'Saudável ≥ 3x' : 'Abaixo do ideal'}
                      color={a.financeiro.ltv_cac_ratio >= 3 ? 'success' : 'warning'}/>
              <Metric label={`Comissão ${a.financeiro.comissao_rate_pct}%`} value={fmt.brlK(a.financeiro.comissao_total)}
                      sub={`${fmt.brlK(a.financeiro.comissao_90d)} últimos 90d`} color="b-accent"/>
              <Metric label="Deals abertos" value={a.deals.abertos} sub={`${a.deals.total} no total`}/>
            </div>

            {/* Clientes por recência */}
            <div style={{borderTop:'1px solid hsl(var(--border))', paddingTop:16}}>
              <div className="row-between" style={{marginBottom:12}}>
                <strong style={{fontSize:13}}>Clientes por recência de última atividade</strong>
                <span className="muted" style={{fontSize:12}}>{a.clientes.total} empresas · {a.clientes.clientes_ativos} com status "cliente"</span>
              </div>
              <div style={{display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:10}}>
                <RecencyBucket label="≤ 30 dias"     value={a.clientes.ativos_30d}  color="success"/>
                <RecencyBucket label="30–60 dias"    value={a.clientes.ativos_60d}  color="b-accent"/>
                <RecencyBucket label="60–90 dias"    value={a.clientes.ativos_90d}  color="info"/>
                <RecencyBucket label="90–180 dias"   value={a.clientes.ativos_180d} color="warning"/>
                <RecencyBucket label="Inativos +180d" value={a.clientes.inativos}    color="danger"/>
              </div>
            </div>
          </>}
        </div>
      </div>

      {/* ==== Funil + IA ==== */}
      <div className="grid-dash">
        <div className="card">
          <div className="card-head">
            <div><div className="card-title">Funil de vendas</div><div className="card-sub">Distribuição por estágio — {fmt.brlK(pipelineTotal)}</div></div>
          </div>
          <div className="card-p">
            <div style={{display:'flex', flexDirection:'column', gap:14}}>
              {stageSums.filter(s=>!s.is_ganho).map(s => {
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
              <div><div className="card-title">Bradata AI</div><div className="card-sub">Insights automáticos</div></div>
            </div>
          </div>
          <div className="card-p" style={{display:'flex', flexDirection:'column', gap:12}}>
            {a && a.financeiro.ltv_cac_ratio < 3 && (
              <AIInsight tone="warning" title="LTV/CAC abaixo de 3x"
                body={`Sua relação LTV/CAC está em ${a.financeiro.ltv_cac_ratio.toFixed(1)}x. Considere aumentar retenção (upsell) ou reduzir CAC.`}
                action="Ver plano"/>
            )}
            {a && a.clientes.inativos > 0 && (
              <AIInsight tone="danger" title={`${a.clientes.inativos} clientes inativos`}
                body="Clientes sem atividade há mais de 180 dias. Risco alto de churn. Priorize reativação."
                action="Abrir lista"/>
            )}
            {a && a.financeiro.comissao_total > 0 && (
              <AIInsight tone="accent" title={`${fmt.brlK(a.financeiro.comissao_total)} em comissão`}
                body={`${a.financeiro.comissao_rate_pct}% sobre receita ganha. ${fmt.brlK(a.financeiro.comissao_90d)} nos últimos 90 dias.`}
                action="Ver detalhado"/>
            )}
          </div>
        </div>
      </div>

      {/* ==== Leads quentes + Radar PNCP ==== */}
      <div className="grid-dash" style={{marginTop:'var(--gap)'}}>
        <div className="card">
          <div className="card-head"><div><div className="card-title">Leads quentes</div><div className="card-sub">Score ≥ 80</div></div></div>
          <table className="table">
            <thead><tr><th>Empresa</th><th>Faturamento</th><th>Contratos</th><th>Score</th><th></th></tr></thead>
            <tbody>
              {hotLeads.length === 0 && <tr><td colSpan="5" style={{textAlign:'center', padding:20, color:'hsl(var(--fg-muted))'}}>Nenhum lead com score alto ainda.</td></tr>}
              {hotLeads.map(c => (
                <tr key={c.id}>
                  <td><div className="row" style={{gap:10}}><UI.Avatar name={c.name} size={30}/><div><strong>{c.name}</strong><div className="muted mono" style={{fontSize:11}}>{fmt.cnpj(c.cnpj)}</div></div></div></td>
                  <td className="mono">{fmt.brlK(c.revenue)}</td>
                  <td><span className="chip primary">{c.contractsPncp}</span></td>
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
            {recentPncp.length === 0 && <div className="muted" style={{textAlign:'center', padding:20}}>Nenhum contrato ainda.</div>}
            {recentPncp.map(p => (
              <div key={p.id} style={{paddingBottom:12, borderBottom:'1px dashed hsl(var(--border))'}}>
                <div className="row-between"><span className="chip info"><I.gov size={10}/>{p.orgao}</span><span className="muted" style={{fontSize:11}}>{fmt.relative(p.publicado)}</span></div>
                <div style={{fontSize:13, fontWeight:600, marginTop:6, lineHeight:1.35}}>{p.objeto}</div>
                <div className="row-between" style={{marginTop:8, fontSize:12}}>
                  <span className="muted">{p.modalidade}</span>
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
      {delta && <div className={`delta ${dir==='up'?'up':dir==='down'?'down':'neutral'}`}>
        {dir==='up'?<I.arrowUp/>:dir==='down'?<I.arrowDown/>:null} {delta}
      </div>}
      <div className="foot">{foot}</div>
      {spark && <div className="spark"><UI.Spark points={spark} color={`var(--${accent||'b-accent'})`}/></div>}
    </div>
  );
}

function Metric({ label, value, sub, color }) {
  const c = color || 'fg';
  return (
    <div style={{padding:14, borderRadius:10, background:'hsl(var(--surface))', border:'1px solid hsl(var(--border))'}}>
      <div className="faint" style={{fontSize:10, textTransform:'uppercase', letterSpacing:'.05em'}}>{label}</div>
      <div style={{fontSize:20, fontWeight:700, color:`hsl(var(--${c}))`, fontVariantNumeric:'tabular-nums', marginTop:4}}>{value}</div>
      {sub && <div className="muted" style={{fontSize:11.5, marginTop:2}}>{sub}</div>}
    </div>
  );
}

function RecencyBucket({ label, value, color }) {
  return (
    <div style={{padding:12, borderRadius:10, background:`hsl(var(--${color}-soft, var(--surface-2)))`, border:`1px solid hsl(var(--${color}) / .25)`, textAlign:'center'}}>
      <div style={{fontSize:24, fontWeight:700, color:`hsl(var(--${color}))`, fontVariantNumeric:'tabular-nums'}}>{value}</div>
      <div className="faint" style={{fontSize:10, textTransform:'uppercase', letterSpacing:'.05em', marginTop:4}}>{label}</div>
    </div>
  );
}

function AIInsight({ tone, title, body, action }) {
  const map = { danger:'danger', info:'info', warning:'warning', accent:'b-accent' };
  const c = map[tone] || 'b-accent';
  return (
    <div style={{padding:12, borderRadius:10, background:`hsl(var(--${c}) / .06)`, border:`1px solid hsl(var(--${c}) / .2)`}}>
      <strong style={{fontSize:13, color:`hsl(var(--${c}))`}}>{title}</strong>
      <p style={{fontSize:12.5, color:'hsl(var(--fg-muted))', margin:'4px 0 10px', lineHeight:1.5}}>{body}</p>
      <button className="btn btn-xs" style={{background:`hsl(var(--${c}))`, color:'white'}}>{action} <I.chevron size={11}/></button>
    </div>
  );
}

window.Dashboard = Dashboard;
