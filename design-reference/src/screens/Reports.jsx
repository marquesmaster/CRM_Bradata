// Reports — relatórios e KPIs do funil
// Bradata CRM — screen module
// Globals expected: React, window.DATA, window.I (icons), window.UI (primitives)

function Reports() {
  const { fmt, DEALS, COMPANY_LIST } = window.DATA;
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Relatórios & Analytics</h1>
          <div className="page-sub">Visão executiva · abril 2026</div>
        </div>
        <div className="actions">
          <button className="btn btn-ghost btn-sm"><I.download size={12}/>Exportar PDF</button>
        </div>
      </div>
      <div className="grid-2">
        <div className="card">
          <div className="card-head"><div className="card-title">Funil de conversão</div></div>
          <div className="card-p">
            {[
              { l:'Prospecção', v:127, c:'hsl(var(--info))' },
              { l:'Qualificação', v:62, c:'hsl(var(--b-accent))' },
              { l:'Proposta', v:28, c:'hsl(var(--warning))' },
              { l:'Negociação', v:14, c:'hsl(var(--b-accent-light))' },
              { l:'Ganho', v:8, c:'hsl(var(--success))' },
            ].map((s,i,arr) => {
              const pct = (s.v / arr[0].v) * 100;
              return (
                <div key={s.l} style={{marginBottom:14}}>
                  <div className="row-between" style={{fontSize:12.5, marginBottom:6}}>
                    <strong>{s.l}</strong>
                    <span className="mono">{s.v} · {Math.round(pct)}%</span>
                  </div>
                  <div className="progress" style={{height:14}}><span style={{width:`${pct}%`, background:s.c}}/></div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="card">
          <div className="card-head"><div className="card-title">Receita por trimestre</div></div>
          <div className="card-p">
            <UI.Bars height={200} data={[
              {l:'Q1/25', v:4.2},{l:'Q2/25', v:5.8},{l:'Q3/25', v:7.1},{l:'Q4/25', v:8.9},{l:'Q1/26', v:12.4},
            ]}/>
          </div>
        </div>
        <div className="card">
          <div className="card-head"><div className="card-title">Performance por vendedor</div></div>
          <div className="card-p">
            {[
              {n:'Amanda Costa', deals:8, won:5, r:9_200_000},
              {n:'Rafael Marques', deals:6, won:3, r:6_100_000},
              {n:'Tiago Alencar', deals:4, won:2, r:3_400_000},
              {n:'Bianca Lima', deals:5, won:2, r:2_900_000},
            ].map(p => (
              <div key={p.n} style={{display:'grid', gridTemplateColumns:'auto 1fr auto auto', gap:12, padding:'10px 0', borderBottom:'1px dashed hsl(var(--border))', alignItems:'center'}}>
                <UI.Avatar name={p.n} size={32}/>
                <div>
                  <strong style={{fontSize:13}}>{p.n}</strong>
                  <div className="muted" style={{fontSize:11}}>{p.deals} deals · {p.won} ganhos</div>
                </div>
                <div style={{width:80}}><div className="progress" style={{height:5}}><span style={{width:`${(p.won/p.deals)*100}%`, background:'hsl(var(--success))'}}/></div></div>
                <strong className="mono" style={{color:'hsl(var(--b-accent))'}}>{fmt.brlK(p.r)}</strong>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-head"><div className="card-title">Empresas por faturamento</div></div>
          <div className="card-p">
            {[
              {l:'1Bi+', v: COMPANY_LIST.filter(c=>c.revenue>=1_000_000_000).length, c:'hsl(var(--b-accent))'},
              {l:'500MM-1Bi', v: COMPANY_LIST.filter(c=>c.revenue>=500_000_000&&c.revenue<1_000_000_000).length, c:'hsl(var(--b-accent-light))'},
              {l:'100MM-500MM', v: COMPANY_LIST.filter(c=>c.revenue>=100_000_000&&c.revenue<500_000_000).length, c:'hsl(var(--info))'},
              {l:'<100MM', v: COMPANY_LIST.filter(c=>c.revenue<100_000_000).length, c:'hsl(var(--fg-muted))'},
            ].map(r => {
              const pct = (r.v / COMPANY_LIST.length)*100;
              return (
                <div key={r.l} style={{display:'grid', gridTemplateColumns:'120px 1fr 60px', gap:12, alignItems:'center', marginBottom:10}}>
                  <strong style={{fontSize:13}}>{r.l}</strong>
                  <div className="progress" style={{height:10}}><span style={{width:`${pct}%`, background:r.c}}/></div>
                  <span className="mono faint" style={{fontSize:12, textAlign:'right'}}>{r.v} ({Math.round(pct)}%)</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

window.Reports = Reports;
