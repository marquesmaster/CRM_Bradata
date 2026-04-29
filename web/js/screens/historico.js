// /historico/:cnpj — timeline 360° por fornecedor
function Historico({ cnpjOrId, onBack }) {
  const { fmt, COMPANIES } = window.DATA;
  const [empresa, setEmpresa] = React.useState(null);
  const [timeline, setTimeline] = React.useState([]);
  const [pncp, setPncp] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    // Aceita tanto ID da empresa quanto CNPJ
    const local = COMPANIES[cnpjOrId] || Object.values(COMPANIES).find(c => c.cnpj === cnpjOrId);
    if (local) {
      setEmpresa(local);
      Promise.all([
        window.API.api(`/empresas/${local.id}/timeline?limit=100`).catch(() => []),
        window.API.api(`/empresas/${local.id}/pncp`).catch(() => []),
      ]).then(([tl, p]) => {
        setTimeline(tl || []);
        setPncp(p || []);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [cnpjOrId]);

  if (loading) return (
    <div className="card" style={{padding:24, display:'flex', flexDirection:'column', gap:10}}>
      {Array.from({length:8}).map((_,i) => <Skeleton key={i} height={36}/>)}
    </div>
  );
  if (!empresa) return <div className="card" style={{padding:20}}>Empresa não encontrada. <button className="btn btn-xs btn-ghost" onClick={onBack}>Voltar</button></div>;

  const eventos = [
    ...timeline.map(e => ({ kind: e.kind, ts: e.ts, data: e.data })),
    ...pncp.map(p => ({
      kind: 'pncp',
      ts: p.data_resultado,
      data: { descricao: `Contrato PNCP · ${fmt.brlK(p.valor_total_homologado)}`, situacao: p.situacao, orgao: p.fornecedor },
    })),
  ].sort((a,b) => new Date(b.ts||0) - new Date(a.ts||0));

  const iconOf = {
    atividade: I.check,
    nota: I.doc,
    pncp: I.gov,
  };

  return (
    <>
      <div className="page-head">
        <div>
          <button className="btn btn-xs btn-ghost" onClick={onBack} style={{marginBottom:8}}>← Voltar</button>
          <div className="row" style={{gap:14}}>
            <UI.Avatar name={empresa.name} size={48}/>
            <div>
              <h1 className="page-title" style={{margin:0}}>{empresa.name}</h1>
              <div className="page-sub mono">{fmt.cnpj(empresa.cnpj)}</div>
            </div>
          </div>
        </div>
        <div className="actions">
          <button className="btn btn-ghost btn-sm" onClick={()=>window.__nav('lead', empresa.id)}>Perfil completo</button>
        </div>
      </div>

      <div className="grid-dash">
        <div className="card">
          <div className="card-head">
            <div className="card-title">Linha do tempo 360°</div>
            <span className="chip">{eventos.length} eventos</span>
          </div>
          <div className="card-p">
            {eventos.length === 0 && <div style={{padding:20, textAlign:'center', color:'hsl(var(--fg-muted))'}}>Nenhum evento ainda.</div>}
            {eventos.map((ev, i) => {
              const Ico = iconOf[ev.kind] || I.sparkle;
              return (
                <div key={i} className="timeline-event">
                  <div className="te-ico"><Ico size={14}/></div>
                  <div className="te-body">
                    <strong>{ev.kind === 'atividade' ? (ev.data?.titulo || 'Atividade') : ev.kind === 'nota' ? 'Anotação' : ev.kind === 'pncp' ? (ev.data?.descricao || 'Contrato PNCP') : ev.kind}</strong>
                    {ev.data?.descricao && ev.kind !== 'pncp' && <div className="muted" style={{fontSize:12}}>{ev.data.descricao}</div>}
                    {ev.kind === 'nota' && <div className="muted" style={{fontSize:12}}>{ev.data?.conteudo}</div>}
                  </div>
                  <div className="te-time">{fmt.relative(ev.ts)}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div className="card-head"><div className="card-title">Resumo do fornecedor</div></div>
          <div className="card-p" style={{display:'flex', flexDirection:'column', gap:14}}>
            <div><div className="faint" style={{fontSize:10, textTransform:'uppercase'}}>Faturamento</div><div style={{fontWeight:700, fontSize:18}}>{fmt.brlK(empresa.revenue)}</div></div>
            <div><div className="faint" style={{fontSize:10, textTransform:'uppercase'}}>Funcionários</div><div style={{fontWeight:700}}>{fmt.num(empresa.employees)}</div></div>
            <div><div className="faint" style={{fontSize:10, textTransform:'uppercase'}}>Contratos PNCP</div><div style={{fontWeight:700}}>{pncp.length}</div></div>
            <div><div className="faint" style={{fontSize:10, textTransform:'uppercase'}}>Score ICP</div>{empresa.score > 0 ? <UI.ScoreRing value={empresa.score} size={60} stroke={6}/> : <div className="muted">não classificada</div>}</div>
          </div>
        </div>
      </div>
    </>
  );
}

window.Historico = Historico;
