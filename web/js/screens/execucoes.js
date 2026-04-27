// /execucoes — histórico de ETL runs + progresso em tempo real (polling 3s)
function Execucoes() {
  const { fmt } = window.DATA;
  const [runs, setRuns] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [showModal, setShowModal] = React.useState(false);
  const [err, setErr] = React.useState(null);

  const load = React.useCallback(() => {
    window.API.api('/etl/runs?limit=50')
      .then(r => { setRuns(r || []); setLoading(false); setErr(null); })
      .catch(e => { setErr(e.message); setLoading(false); });
  }, []);

  React.useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [load]);

  const ativos = runs.filter(r => r.status === 'running');

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Execuções</h1>
          <div className="page-sub">
            {ativos.length > 0
              ? <><strong style={{color:'hsl(var(--b-accent))'}}>{ativos.length} em andamento</strong> · {runs.length} no histórico</>
              : <>{runs.length} execuções no histórico</>
            }
          </div>
        </div>
        <div className="actions">
          <button className="btn btn-ghost btn-sm" onClick={load}><I.refresh size={12}/>Atualizar</button>
          <button className="btn btn-ghost btn-sm" onClick={async () => {
            if (!confirm('Classificar com IA todos os contratos ainda não classificados? (lotes de 30)')) return;
            try {
              const r = await window.API.api('/pncp/classificar-batch?batch_size=30', { method: 'POST' });
              window.toast.success(r.message || 'Classificação em batch agendada');
              load();
            } catch (e) { window.toast.error(e.message); }
          }}><I.sparkle size={12}/>Classificar IA em batch</button>
          <button className="btn btn-accent btn-sm" onClick={()=>setShowModal(true)}><I.plus size={12}/>Nova execução</button>
        </div>
      </div>

      {err && <div className="card" style={{padding:16, marginBottom:16, color:'hsl(var(--danger))', background:'hsl(var(--danger-soft))'}}>{err}</div>}

      {ativos.length > 0 && (
        <div className="card" style={{marginBottom:'var(--gap)'}}>
          <div className="card-head"><div className="card-title">Em andamento</div></div>
          <div className="card-p" style={{display:'flex', flexDirection:'column', gap:14}}>
            {ativos.map(r => <RunProgress key={r.id} run={r}/>)}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-head"><div className="card-title">Histórico</div><span className="chip">{runs.length}</span></div>
        <table className="table">
          <thead><tr>
            <th>#</th><th>Tipo</th><th>Status</th><th>Início</th><th>Duração</th><th>Contratos</th><th>Empresas</th><th>IA</th><th></th>
          </tr></thead>
          <tbody>
            {runs.length === 0 && !loading && (
              <tr><td colSpan="9" style={{textAlign:'center', padding:32, color:'hsl(var(--fg-muted))'}}>
                Nenhuma execução ainda. Dispare a primeira em "Nova execução".
              </td></tr>
            )}
            {runs.map(r => (
              <tr key={r.id}>
                <td className="mono faint">#{r.id}</td>
                <td style={{fontSize:12.5}}>{r.tipo}</td>
                <td><StatusChip status={r.status}/></td>
                <td className="muted" style={{fontSize:12}}>{fmt.relative(r.iniciado_em)}</td>
                <td className="mono" style={{fontSize:12}}>{r.duracao_seg != null ? (r.duracao_seg < 60 ? r.duracao_seg.toFixed(1) + 's' : (r.duracao_seg/60).toFixed(1) + ' min') : '—'}</td>
                <td className="mono">{r.contratos_ok}/{r.contratos_a_processar} {r.contratos_com_erro > 0 && <span style={{color:'hsl(var(--danger))'}}>· {r.contratos_com_erro} erros</span>}</td>
                <td className="mono">{r.empresas_sincronizadas}</td>
                <td className="mono">{r.ai_processados}</td>
                <td><button className="btn btn-xs btn-ghost" onClick={()=>alert(JSON.stringify(r.resumo || r, null, 2))}>Ver</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && <NewEtlModal onClose={()=>setShowModal(false)} onCreated={() => { setShowModal(false); load(); }}/>}
    </>
  );
}

function RunProgress({ run }) {
  const pct = run.contratos_a_processar > 0
    ? Math.round((run.contratos_ok / run.contratos_a_processar) * 100)
    : 0;
  return (
    <div>
      <div className="row-between" style={{marginBottom:6}}>
        <div className="row" style={{gap:8}}>
          <span className="chip" style={{background:'hsl(var(--b-accent-soft))', color:'hsl(var(--b-accent))', borderColor:'hsl(var(--b-accent) / .3)'}}>#{run.id} · {run.tipo}</span>
          <span className="muted" style={{fontSize:12}}>{window.DATA.fmt.relative(run.iniciado_em)}</span>
        </div>
        <strong className="mono">{run.contratos_ok} / {run.contratos_a_processar} ({pct}%)</strong>
      </div>
      <div className="progress" style={{height:8}}><span style={{width: `${pct}%`, background:'hsl(var(--b-accent))'}}/></div>
      <div className="row" style={{gap:14, fontSize:11.5, marginTop:6, color:'hsl(var(--fg-muted))'}}>
        <span>{run.itens_novos} novos</span>
        <span>·</span>
        <span>{run.empresas_sincronizadas} empresas</span>
        <span>·</span>
        <span>{run.ai_processados} IA</span>
        {run.contratos_com_erro > 0 && <><span>·</span><span style={{color:'hsl(var(--danger))'}}>{run.contratos_com_erro} erros</span></>}
      </div>
    </div>
  );
}

function StatusChip({ status }) {
  const map = {
    running: { c: 'info',    l: 'Em execução' },
    done:    { c: 'success', l: 'Concluído' },
    error:   { c: 'danger',  l: 'Erro' },
    canceled:{ c: 'warn',    l: 'Cancelado' },
  };
  const m = map[status] || { c: '', l: status };
  return <span className={`chip ${m.c}`}>{status === 'running' && <span className="dot" style={{animation:'liveP 1.5s infinite'}}/>}{m.l}</span>;
}

function NewEtlModal({ onClose, onCreated }) {
  const [ufs, setUfs] = React.useState('DF,SP');
  const [maxPaginas, setMaxPaginas] = React.useState(100);
  const [maxWorkers, setMaxWorkers] = React.useState(10);
  const [classifyAi, setClassifyAi] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      await window.API.api('/pncp/etl/run', {
        method: 'POST',
        body: {
          ufs: ufs.split(',').map(s=>s.trim()).filter(Boolean),
          max_paginas: Number(maxPaginas) || 100,
          max_workers: Number(maxWorkers) || 10,
          classify_with_ai: classifyAi,
        },
      });
      window.toast.success('ETL PNCP agendado em background');
      onCreated();
    } catch (e) {
      window.toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-head">
          <div style={{fontSize:16, fontWeight:700}}>Nova execução ETL PNCP</div>
          <button className="icon-btn" onClick={onClose}><I.close size={16}/></button>
        </div>
        <div className="modal-body" style={{display:'flex', flexDirection:'column', gap:14}}>
          <FormField label="UFs (separadas por vírgula)">
            <input className="input" value={ufs} onChange={e=>setUfs(e.target.value)} placeholder="DF,SP,RJ"/>
          </FormField>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
            <FormField label="Max páginas por keyword/UF">
              <input className="input" type="number" min="1" max="1000" value={maxPaginas} onChange={e=>setMaxPaginas(e.target.value)}/>
            </FormField>
            <FormField label="Workers paralelos">
              <input className="input" type="number" min="1" max="50" value={maxWorkers} onChange={e=>setMaxWorkers(e.target.value)}/>
            </FormField>
          </div>
          <label style={{display:'flex', alignItems:'center', gap:8, fontSize:13}}>
            <input type="checkbox" checked={classifyAi} onChange={e=>setClassifyAi(e.target.checked)}/>
            Classificar com IA (bodyshop / staff augmentation)
          </label>
          <div style={{padding:10, background:'hsl(var(--info-soft))', borderRadius:8, fontSize:12, color:'hsl(var(--info))'}}>
            Sem keywords, usa a lista curada do config_prospect (bodyshop, fábrica de software, alocação, etc.).
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={submitting}>Cancelar</button>
          <button className="btn btn-accent btn-sm" onClick={submit} disabled={submitting}>
            {submitting ? 'Disparando…' : 'Disparar'}
          </button>
        </div>
      </div>
    </div>
  );
}

window.Execucoes = Execucoes;
