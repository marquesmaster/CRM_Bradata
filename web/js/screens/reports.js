// Relatórios: dados reais de /relatorios/{funil,bdr,icp,pncp/top-fornecedores}
function Reports() {
  const { fmt } = window.DATA;
  const [funis, setFunis] = React.useState([]);
  const [bdrs, setBdrs] = React.useState([]);
  const [icpEmpresas, setIcpEmpresas] = React.useState([]);
  const [topFornecedores, setTopFornecedores] = React.useState([]);
  const [analytics, setAnalytics] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    Promise.all([
      window.API.api('/relatorios/funil').catch(()=>[]),
      window.API.api('/relatorios/bdr').catch(()=>[]),
      window.API.api('/relatorios/icp?min_score=40&limit=50').catch(()=>[]),
      window.API.api('/relatorios/pncp/top-fornecedores?limit=20').catch(()=>[]),
      window.API.api('/relatorios/analytics').catch(()=>null),
    ]).then(([f,b,i,t,a]) => {
      setFunis(f); setBdrs(b); setIcpEmpresas(i); setTopFornecedores(t); setAnalytics(a);
      setLoading(false);
    });
  }, []);

  const exportCsv = (rows, filename) => {
    if (!rows.length) return;
    const header = Object.keys(rows[0]);
    const csv = [header, ...rows.map(r => header.map(k => r[k]))]
      .map(r => r.map(v => `"${String(v ?? '').replace(/"/g,'""')}"`).join(';')).join('\n');
    const blob = new Blob(['﻿' + csv], {type:'text/csv;charset=utf-8'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${filename}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  if (loading) return (
    <>
      <div className="page-head"><h1 className="page-title">Relatórios & Analytics</h1></div>
      <div className="grid-3" style={{gap:'var(--gap)'}}>
        {Array.from({length:6}).map((_,i) => (
          <div key={i} className="card" style={{padding:18, display:'flex', flexDirection:'column', gap:10}}>
            <Skeleton height={14} width="40%"/>
            <Skeleton height={32} width="60%"/>
            <Skeleton height={80}/>
          </div>
        ))}
      </div>
    </>
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Relatórios & Analytics</h1>
          <div className="page-sub">Visão executiva ao vivo do banco</div>
        </div>
      </div>

      {/* KPIs do analytics */}
      {analytics && (
        <div className="grid-4" style={{marginBottom:'var(--gap)'}}>
          <Kpi label="Receita ganha (R$)" value={fmt.brlK(analytics.deals?.valor_ganho_total || 0)} icon="money"/>
          <Kpi label="ROI" value={`${(analytics.roi_percent || 0).toFixed(0)}%`} icon="chart"/>
          <Kpi label="Comissão estimada" value={fmt.brlK(analytics.comissao_total || 0)} icon="dollar"/>
          <Kpi label="Win rate" value={`${(analytics.deals?.win_rate || 0).toFixed(0)}%`} icon="check"/>
        </div>
      )}

      <div className="grid-2">
        {/* Funis por pipeline */}
        {funis.map(p => (
          <div key={p.id} className="card">
            <div className="card-head">
              <div className="card-title">Funil — {p.nome}</div>
            </div>
            <div className="card-p">
              {p.estagios.length === 0 && <div className="muted">Sem estágios configurados.</div>}
              {p.estagios.map((s, i) => {
                const max = Math.max(...p.estagios.map(x => x.qtd), 1);
                const pct = (s.qtd / max) * 100;
                return (
                  <div key={s.id} style={{marginBottom:14}}>
                    <div className="row-between" style={{fontSize:12.5, marginBottom:6}}>
                      <strong>{s.nome}</strong>
                      <span className="mono">{s.qtd} · {fmt.brlK(s.valor)}</span>
                    </div>
                    <div className="progress" style={{height:14}}>
                      <span style={{width:`${pct}%`, background: `hsl(${200 + i*30} 80% 55%)`}}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Performance por user */}
        <div className="card">
          <div className="card-head">
            <div className="card-title">Performance por user</div>
            <button className="btn btn-xs btn-ghost" onClick={()=>exportCsv(bdrs, 'performance_users')}><I.download size={10}/>CSV</button>
          </div>
          <div className="card-p">
            {bdrs.length === 0 && <div className="muted">Nenhum user ativo.</div>}
            {bdrs
              .slice()
              .sort((a,b) => (b.valor_ganho || 0) - (a.valor_ganho || 0))
              .map(u => {
                const pct = u.oportunidades_abertas + u.oportunidades_ganhas > 0
                  ? (u.oportunidades_ganhas / (u.oportunidades_abertas + u.oportunidades_ganhas)) * 100
                  : 0;
                return (
                  <div key={u.user_id} style={{display:'grid', gridTemplateColumns:'auto 1fr auto auto', gap:12, padding:'10px 0', borderBottom:'1px dashed hsl(var(--border))', alignItems:'center'}}>
                    <UI.Avatar name={u.nome} size={32}/>
                    <div style={{minWidth:0}}>
                      <strong style={{fontSize:13}}>{u.nome}</strong>
                      <div className="muted" style={{fontSize:11}}>
                        {u.role} · {u.oportunidades_abertas} abertas · {u.oportunidades_ganhas} ganhos · {u.atividades} atividades
                      </div>
                    </div>
                    <div style={{width:80}}>
                      <div className="progress" style={{height:5}}>
                        <span style={{width:`${pct}%`, background:'hsl(var(--success))'}}/>
                      </div>
                    </div>
                    <strong className="mono" style={{color:'hsl(var(--b-accent))', fontSize:13}}>
                      {fmt.brlK(u.valor_ganho || 0)}
                    </strong>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Empresas ICP top scores */}
        <div className="card" style={{gridColumn:'1/-1'}}>
          <div className="card-head">
            <div className="card-title">Top empresas no ICP (score ≥ 40)</div>
            <div className="row" style={{gap:8}}>
              <span className="chip">{icpEmpresas.length}</span>
              <button className="btn btn-xs btn-ghost" onClick={()=>exportCsv(icpEmpresas, 'icp_top')}><I.download size={10}/>CSV</button>
            </div>
          </div>
          <div className="card-p" style={{padding:0}}>
            <table className="table">
              <thead><tr>
                <th>Empresa</th><th>Score</th><th>CNAE</th><th>Faturamento</th><th>Porte</th><th>UF</th><th>Motivo</th>
              </tr></thead>
              <tbody>
                {icpEmpresas.length === 0 && <tr><td colSpan={7} style={{textAlign:'center', padding:24}} className="muted">Sem empresas no ICP ainda.</td></tr>}
                {icpEmpresas.slice(0, 30).map(e => (
                  <tr key={e.id}>
                    <td>
                      <button className="link" style={{background:'none', border:0, padding:0, cursor:'pointer', fontSize:12.5, fontWeight:600, textAlign:'left'}}
                        onClick={()=>window.__nav('lead', String(e.id))}>{e.razao_social}</button>
                      <div className="muted mono" style={{fontSize:10}}>{e.cnpj}</div>
                    </td>
                    <td>
                      <strong style={{color: e.icp_score>=80?'hsl(var(--success))':e.icp_score>=60?'hsl(var(--warning))':'hsl(var(--fg-muted))', fontSize:14}}>
                        {e.icp_score}
                      </strong>
                    </td>
                    <td className="mono" style={{fontSize:11.5}}>{e.cnae_principal || '—'}</td>
                    <td className="mono">{e.faturamento_estimado ? fmt.brlK(e.faturamento_estimado) : '—'}</td>
                    <td><span className="chip" style={{fontSize:10}}>{e.porte || '—'}</span></td>
                    <td><span className="chip" style={{fontSize:10}}>{e.uf || '—'}</span></td>
                    <td className="muted" style={{fontSize:11.5, maxWidth:240, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{e.icp_motivo || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top fornecedores PNCP */}
        <div className="card" style={{gridColumn:'1/-1'}}>
          <div className="card-head">
            <div className="card-title">Top fornecedores PNCP (por valor homologado)</div>
            <div className="row" style={{gap:8}}>
              <span className="chip">{topFornecedores.length}</span>
              <button className="btn btn-xs btn-ghost" onClick={()=>exportCsv(topFornecedores, 'top_fornecedores_pncp')}><I.download size={10}/>CSV</button>
            </div>
          </div>
          <div className="card-p" style={{padding:0}}>
            <table className="table">
              <thead><tr><th>#</th><th>Fornecedor</th><th>CNPJ</th><th>Contratos</th><th>Valor total</th></tr></thead>
              <tbody>
                {topFornecedores.length === 0 && <tr><td colSpan={5} style={{textAlign:'center', padding:24}} className="muted">Sem dados PNCP.</td></tr>}
                {topFornecedores.map((f, i) => (
                  <tr key={f.cnpj}>
                    <td><strong style={{color: i < 3 ? 'hsl(var(--b-accent))' : 'hsl(var(--fg))'}}>{i+1}</strong></td>
                    <td><strong style={{fontSize:12.5}}>{f.razao_social}</strong></td>
                    <td className="mono" style={{fontSize:11}}>{f.cnpj}</td>
                    <td><span className="chip" style={{fontSize:11}}>{f.qtd_contratos}</span></td>
                    <td><strong className="mono" style={{color:'hsl(var(--b-accent))'}}>{fmt.brlK(f.valor_total_homologado)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

function Kpi({ label, value, icon }) {
  return (
    <div className="card">
      <div className="card-p">
        <div className="card-section-title">{label}</div>
        <div style={{fontSize:22, fontWeight:800, marginTop:4}}>{value}</div>
      </div>
    </div>
  );
}

window.Reports = Reports;
