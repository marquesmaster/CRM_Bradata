// Dashboard screen - 3 variants
const { useState: uS_d, useMemo: uM_d } = React;

function Dashboard() {
  const variant = window.__TWEAKS__.dashboardVariant || 'executive';
  if (variant === 'pulse') return <DashboardPulse/>;
  if (variant === 'operator') return <DashboardOperator/>;
  return <DashboardExecutive/>;
}

// --- Executive: KPIs + pipeline + leads quentes ---
function DashboardExecutive() {
  const { fmt, DEALS, STAGES, COMPANIES, NOTIFICATIONS, PNCP_CONTRACTS } = window.DATA;
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
          <div className="page-sub">Você tem <strong style={{color:'hsl(var(--fg))'}}>7 atividades pendentes</strong> e <strong style={{color:'hsl(var(--b-accent))'}}>3 novos leads</strong> detectados no PNCP hoje.</div>
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
        {/* Pipeline Funnel */}
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Funil de vendas</div>
              <div className="card-sub">Distribuição por estágio — {fmt.brlK(pipelineTotal)} total</div>
            </div>
            <div className="segment-ctrl">
              <button className="active">Valor</button>
              <button>Quantidade</button>
            </div>
          </div>
          <div className="card-p">
            <div style={{display:'flex', flexDirection:'column', gap:14}}>
              {stageSums.filter(s=>s.id!=='ganho').map((s,i) => {
                const pct = (s.v / pipelineTotal) * 100;
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
            <div className="divider"/>
            <div className="row-between">
              <div>
                <div className="muted" style={{fontSize:11}}>Previsão ponderada (90d)</div>
                <div style={{fontSize:22, fontWeight:700, fontVariantNumeric:'tabular-nums', letterSpacing:'-.02em'}}>
                  {fmt.brlK(DEALS.filter(d=>d.stage!=='ganho').reduce((s,d)=>s+d.value*(d.prob/100),0))}
                </div>
              </div>
              <button className="btn btn-sm btn-ghost">Ver pipeline completo <I.chevron/></button>
            </div>
          </div>
        </div>

        {/* AI insights */}
        <div className="card halo">
          <div className="card-head">
            <div className="row" style={{gap:8}}>
              <div style={{width:28, height:28, borderRadius:8, background:'linear-gradient(135deg, hsl(var(--b-accent)), hsl(var(--b-accent-light)))', display:'grid', placeItems:'center', color:'white'}}>
                <I.sparkle size={14}/>
              </div>
              <div>
                <div className="card-title">Bradata AI</div>
                <div className="card-sub">Insights de hoje</div>
              </div>
            </div>
          </div>
          <div className="card-p" style={{display:'flex', flexDirection:'column', gap:12}}>
            <AIInsight
              tone="danger"
              title="SLA em risco — SERPRO"
              body="Deal de R$ 4,2M sem movimento há 5 dias. Rafael tem call agendada, mas proposta não foi enviada."
              action="Enviar proposta agora"/>
            <AIInsight
              tone="accent"
              title="3 leads acabaram de cruzar 100MM"
              body="TIVIT, Stefanini e CI&T aumentaram faturamento no último trimestre. Prioridade alta."
              action="Abrir cadência"/>
            <AIInsight
              tone="info"
              title="Novo contrato PNCP — TCU"
              body="Everis venceu R$ 15,4M em AI aplicada. Match com nosso squad de ML."
              action="Ver contrato"/>
          </div>
        </div>
      </div>

      <div className="grid-dash" style={{marginTop:'var(--gap)'}}>
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Leads quentes</div>
              <div className="card-sub">Score ≥ 80 — prontos para cadência</div>
            </div>
            <button className="btn btn-sm btn-ghost">Ver todos <I.chevron/></button>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Faturamento</th>
                <th>Contratos PNCP</th>
                <th>Score</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {hotLeads.map(c => (
                <tr key={c.id}>
                  <td>
                    <div className="row" style={{gap:10}}>
                      <UI.Avatar name={c.name} size={30}/>
                      <div>
                        <strong>{c.name}</strong>
                        <div className="muted mono" style={{fontSize:11}}>{fmt.cnpj(c.cnpj)}</div>
                      </div>
                    </div>
                  </td>
                  <td className="mono">{fmt.brlK(c.revenue)}</td>
                  <td><span className="chip primary">{c.contractsPncp} contratos</span></td>
                  <td><UI.ScoreRing value={c.score} size={40} stroke={4}/></td>
                  <td style={{textAlign:'right'}}>
                    <button className="btn btn-xs btn-ghost">Abrir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="card-title">PNCP — radar</div>
            <span className="chip success"><span className="dot"/> ao vivo</span>
          </div>
          <div className="card-p" style={{display:'flex', flexDirection:'column', gap:14}}>
            {recentPncp.map(p => (
              <div key={p.id} style={{paddingBottom:12, borderBottom:'1px dashed hsl(var(--border))'}}>
                <div className="row-between">
                  <span className="chip info"><I.gov size={10}/> {p.orgao}</span>
                  <span className="muted" style={{fontSize:11}}>{fmt.relative(p.publicado)}</span>
                </div>
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
  const toneClass = tone==='danger'?'danger': tone==='info'?'info':'accent';
  return (
    <div style={{
      padding: 12, borderRadius: 10,
      background: `hsl(var(--${tone==='danger'?'danger':tone==='info'?'info':'b-accent'}) / .06)`,
      border: `1px solid hsl(var(--${tone==='danger'?'danger':tone==='info'?'info':'b-accent'}) / .2)`,
    }}>
      <div className="row-between" style={{marginBottom:4}}>
        <strong style={{fontSize:13, color:`hsl(var(--${tone==='danger'?'danger':tone==='info'?'info':'b-accent'}))`}}>{title}</strong>
      </div>
      <p style={{fontSize:12.5, color:'hsl(var(--fg-muted))', margin:'0 0 10px', lineHeight:1.5}}>{body}</p>
      <button className="btn btn-xs" style={{background:`hsl(var(--${tone==='danger'?'danger':tone==='info'?'info':'b-accent'}))`, color:'white'}}>{action} <I.chevron size={11}/></button>
    </div>
  );
}

// --- Variant 2: Pulse (real-time operational) ---
function DashboardPulse() {
  const { fmt, DEALS, ACTIVITIES, COMPANIES, NOTIFICATIONS, PNCP_CONTRACTS } = window.DATA;
  const today = ACTIVITIES.filter(a=>a.status==='pendente').slice(0,6);
  return (
    <>
      <div className="page-head">
        <div>
          <div className="chip accent" style={{marginBottom:8}}>● Modo Pulse — tempo real</div>
          <h1 className="page-title">Operação do dia</h1>
          <div className="page-sub">Sexta-feira, 19 de abril de 2026</div>
        </div>
      </div>
      <div className="grid-4" style={{marginBottom:'var(--gap)'}}>
        <MiniStat label="Ligações hoje" value="12" target="20" color="info"/>
        <MiniStat label="E-mails enviados" value="34" target="50" color="success"/>
        <MiniStat label="Reuniões agendadas" value="4" target="6" color="warning"/>
        <MiniStat label="Deals criados" value="2" target="3" color="danger"/>
      </div>
      <div className="grid-dash">
        <div className="card">
          <div className="card-head">
            <div className="card-title">Agenda de hoje</div>
            <button className="btn btn-sm btn-ghost"><I.plus size={12}/>Adicionar</button>
          </div>
          <div className="card-p" style={{padding: '0'}}>
            {today.map((a,i) => (
              <div key={a.id} style={{display:'grid', gridTemplateColumns:'64px 1fr auto', gap:14, padding:'14px 20px', borderBottom: i<today.length-1?'1px solid hsl(var(--border))':'none', alignItems:'center'}}>
                <div style={{fontFamily:'var(--font-mono)', fontSize:12, color:'hsl(var(--fg-muted))', textAlign:'center', padding:'8px 0', background:'hsl(var(--surface-2))', borderRadius:8}}>
                  <div style={{fontWeight:700, color:'hsl(var(--fg))'}}>{new Date(a.when).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</div>
                  <div style={{fontSize:10, marginTop:2}}>{new Date(a.when).toDateString() === new Date('2026-04-19').toDateString() ? 'hoje' : fmt.relative(a.when)}</div>
                </div>
                <div>
                  <div style={{fontWeight:600}}>{a.title}</div>
                  <div className="muted" style={{fontSize:12}}>
                    <span className="chip" style={{padding:'1px 6px'}}>{a.type}</span> · {a.owner}
                  </div>
                </div>
                <div className="row" style={{gap:4}}>
                  {a.priority==='alta' && <span className="chip danger" style={{padding:'2px 6px'}}>Alta</span>}
                  <button className="icon-btn"><I.more size={14}/></button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{display:'flex', flexDirection:'column', gap:'var(--gap)'}}>
          <div className="card">
            <div className="card-head"><div className="card-title">Feed PNCP ao vivo</div><span className="chip success"><span className="dot" style={{animation:'liveP 1.5s infinite'}}/>ao vivo</span></div>
            <div className="card-p" style={{padding:0}}>
              {PNCP_CONTRACTS.slice(0,5).map((p,i) => (
                <div key={p.id} style={{padding:'12px 20px', borderBottom: i<4?'1px solid hsl(var(--border))':'none', fontSize:12.5}}>
                  <div className="row-between" style={{marginBottom:2}}>
                    <strong>{p.orgao}</strong>
                    <span className="mono" style={{color:'hsl(var(--b-accent))', fontWeight:700}}>{fmt.brlK(p.valor)}</span>
                  </div>
                  <div className="muted" style={{fontSize:11.5}}>{p.fornecedor} · {fmt.relative(p.publicado)}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-head"><div className="card-title">Ranking da equipe</div><span className="chip">abril</span></div>
            <div className="card-p" style={{display:'flex', flexDirection:'column', gap:10}}>
              {[
                { name:'Amanda Costa', pts: 142, deals: 3, ribbon: '🥇' },
                { name:'Rafael Marques', pts: 118, deals: 2, ribbon: '🥈' },
                { name:'Tiago Alencar', pts: 76, deals: 1, ribbon: '🥉' },
              ].map(p => (
                <div key={p.name} className="row" style={{gap:12}}>
                  <span style={{fontSize:20}}>{p.ribbon}</span>
                  <UI.Avatar name={p.name} size={32}/>
                  <div style={{flex:1}}>
                    <strong style={{fontSize:13}}>{p.name}</strong>
                    <div className="progress" style={{marginTop:4, height:5}}><span style={{width: `${(p.pts/150)*100}%`}}/></div>
                  </div>
                  <div className="mono" style={{fontSize:13, fontWeight:700}}>{p.pts} pts</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function MiniStat({ label, value, target, color }) {
  const pct = (parseInt(value) / parseInt(target)) * 100;
  return (
    <div className="kpi" style={{padding:'14px 16px'}}>
      <div className="label">{label}</div>
      <div style={{display:'flex', alignItems:'baseline', gap:6, marginTop:4}}>
        <div className="value" style={{fontSize:24}}>{value}</div>
        <div className="muted" style={{fontSize:12}}>/ {target}</div>
      </div>
      <div className="progress" style={{marginTop:10, height:5}}><span style={{width:`${Math.min(pct,100)}%`, background:`hsl(var(--${color}))`}}/></div>
    </div>
  );
}

// --- Variant 3: Operator (dense, data-centric) ---
function DashboardOperator() {
  const { fmt, DEALS, STAGES, COMPANY_LIST, PNCP_CONTRACTS } = window.DATA;
  const pipelineTotal = DEALS.filter(d=>d.stage!=='ganho').reduce((s,d)=>s+d.value,0);
  const weekly = [
    {l:'Sem 1', v: 3.2},{l:'Sem 2', v: 4.1},{l:'Sem 3', v: 5.6},{l:'Sem 4', v: 4.8},
    {l:'Sem 5', v: 6.2},{l:'Sem 6', v: 7.4},{l:'Sem 7', v: 8.1},{l:'Sem 8', v: 9.2},
  ];
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Visão Operador</h1>
          <div className="page-sub">Densidade máxima — KPIs, tendências, drill-down imediato</div>
        </div>
      </div>
      <div className="grid-4" style={{marginBottom:'var(--gap)'}}>
        {[
          { l:'Pipeline', v: fmt.brlK(pipelineTotal), d:'+18%', dir:'up' },
          { l:'Win rate', v:'34%', d:'-2pp', dir:'down' },
          { l:'Ciclo médio', v:'47 dias', d:'-5d', dir:'up' },
          { l:'Ticket médio', v: fmt.brlK(1_750_000), d:'+12%', dir:'up' },
          { l:'Cobertura (pipe/meta)', v:'3.2x', d:'+.4x', dir:'up' },
          { l:'Velocity', v: fmt.brlK(540_000) + '/sem', d:'+R$ 80k', dir:'up' },
          { l:'PNCP matches', v:'47', d:'+12', dir:'up' },
          { l:'NPS clientes', v:'72', d:'+4', dir:'up' },
        ].map((k,i) => (
          <div key={i} className="kpi" style={{padding:'12px 14px'}}>
            <div className="label" style={{fontSize:11}}>{k.l}</div>
            <div className="value" style={{fontSize:22, marginTop:2}}>{k.v}</div>
            <div className={`delta ${k.dir}`} style={{fontSize:11, marginTop:4}}>
              {k.dir==='up'?<I.arrowUp/>:<I.arrowDown/>}{k.d}
            </div>
          </div>
        ))}
      </div>
      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <div className="card-title">Receita projetada por semana</div>
            <span className="chip">8 semanas</span>
          </div>
          <div className="card-p">
            <UI.Bars data={weekly} height={160}/>
            <div style={{display:'flex', justifyContent:'space-between', marginTop:12, fontSize:12}}>
              <span className="muted">Média: R$ 6,1M/sem</span>
              <span style={{color:'hsl(var(--success))', fontWeight:600}}>↑ Tendência positiva</span>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-head"><div className="card-title">Distribuição geográfica</div></div>
          <div className="card-p">
            {['SP','DF','RJ','MG','RS','PR'].map(uf => {
              const count = COMPANY_LIST.filter(c=>c.uf===uf).length;
              return (
                <div key={uf} style={{display:'flex', alignItems:'center', gap:12, marginBottom:10}}>
                  <strong style={{width:40}}>{uf}</strong>
                  <div style={{flex:1}}><div className="progress"><span style={{width: `${(count/COMPANY_LIST.length)*100}%`}}/></div></div>
                  <span className="mono muted" style={{fontSize:12, width:40, textAlign:'right'}}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

window.Dashboard = Dashboard;
