// Pipeline (Kanban): drag-drop entre estágios PERSISTE no backend via PATCH
function Pipeline() {
  const { fmt, COMPANIES, STAGES } = window.DATA;
  const [deals, setDeals] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [dragId, setDragId] = React.useState(null);
  const [dragOver, setDragOver] = React.useState(null);
  const [editing, setEditing] = React.useState(null);
  const [closing, setClosing] = React.useState(null);
  const [filterOwner, setFilterOwner] = React.useState('all');
  const [team, setTeam] = React.useState([]);

  const load = React.useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams({ status: 'aberta', size: 200 });
    if (filterOwner !== 'all') qs.set('owner_id', filterOwner);
    window.API.api(`/oportunidades?${qs}`)
      .then(p => setDeals(p.items || []))
      .finally(() => setLoading(false));
  }, [filterOwner]);

  React.useEffect(load, [load]);
  React.useEffect(() => {
    window.API.api('/users/team').then(setTeam).catch(()=>{});
  }, []);

  const stageGanho = STAGES.find(s => s.is_ganho);
  const stagePerda = STAGES.find(s => s.is_perda);
  const totalAberto = deals
    .filter(d => String(d.estagio_id) !== String(stageGanho?.id))
    .reduce((s, d) => s + (d.valor_estimado || 0), 0);

  const onDrop = async (estagioIdNum) => {
    if (!dragId) return;
    const estagioId = Number(estagioIdNum);
    const deal = deals.find(d => d.id === dragId);
    setDragId(null); setDragOver(null);
    if (!deal || deal.estagio_id === estagioId) return;

    // Optimistic update
    setDeals(prev => prev.map(d => d.id === dragId ? {...d, estagio_id: estagioId} : d));

    // Se moveu pra estágio terminal, abre modal de fechamento (não persiste estágio direto)
    if (stageGanho && estagioId === stageGanho.id) {
      setClosing(deal);
      // Reverte visual até o user confirmar
      setDeals(prev => prev.map(d => d.id === dragId ? {...d, estagio_id: deal.estagio_id} : d));
      return;
    }
    if (stagePerda && estagioId === stagePerda.id) {
      setClosing(deal);
      setDeals(prev => prev.map(d => d.id === dragId ? {...d, estagio_id: deal.estagio_id} : d));
      return;
    }

    // PATCH normal
    try {
      const upd = await window.API.api(`/oportunidades/${dragId}`, {
        method: 'PATCH',
        body: JSON.stringify({ estagio_id: estagioId }),
      });
      // Sincroniza qualquer update do server (probabilidade auto, etc)
      setDeals(prev => prev.map(d => d.id === dragId ? upd : d));
    } catch (e) {
      // Reverte se falhou
      setDeals(prev => prev.map(d => d.id === dragId ? deal : d));
      alert(`Falha ao mover: ${e.message}`);
    }
  };

  const onSaved = () => { setEditing(null); setClosing(null); load(); };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Pipeline de vendas</h1>
          <div className="page-sub">
            {deals.length} oportunidades · <strong style={{color:'hsl(var(--b-accent))'}}>{fmt.brlK(totalAberto)}</strong> em aberto
          </div>
        </div>
        <div className="actions">
          <select className="input" style={{width:200, height:32, fontSize:12.5}} value={filterOwner} onChange={e=>setFilterOwner(e.target.value)}>
            <option value="all">Todos responsáveis</option>
            {team.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={()=>window.__nav('deals')}><I.kanban size={12}/>Tabela</button>
          <button className="btn btn-accent btn-sm" onClick={()=>setEditing({})}>
            <I.plus size={12}/>Nova oportunidade
          </button>
        </div>
      </div>

      {loading && deals.length === 0 && (
        <div className="muted" style={{textAlign:'center', padding:32}}>Carregando…</div>
      )}

      <div className="kanban">
        {STAGES.map(stage => {
          const stageDeals = deals.filter(d => String(d.estagio_id) === String(stage.id));
          const sum = stageDeals.reduce((s,d) => s + (d.valor_estimado || 0), 0);
          return (
            <div key={stage.id} className="kanban-col">
              <div className="kanban-col-head">
                <div>
                  <div className="col-title"><span className="dot" style={{background: stage.color}}/>{stage.label}</div>
                  <div className="col-sum">{fmt.brlK(sum)}</div>
                </div>
                <div className="col-count">{stageDeals.length}</div>
              </div>
              <div className={`kanban-body ${dragOver === stage.id ? 'drop' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragOver(stage.id); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={() => onDrop(stage.id)}>

                {stageDeals.map(d => {
                  const company = COMPANIES[String(d.empresa_id)];
                  return (
                    <div key={d.id}
                      className={`deal-card ${dragId === d.id ? 'dragging' : ''}`}
                      draggable
                      onDragStart={() => setDragId(d.id)}
                      onDragEnd={() => setDragId(null)}
                      onClick={() => setEditing(d)}
                      style={{cursor:'pointer'}}>
                      <div className="deal-title">{d.titulo}</div>
                      {(d.tags || []).length > 0 && (
                        <div className="row" style={{gap:6, marginBottom:8, flexWrap:'wrap'}}>
                          {(d.tags || []).map(t => <span key={t} className="chip" style={{fontSize:10, padding:'1px 6px'}}>{t}</span>)}
                        </div>
                      )}
                      <div className="deal-row">
                        <UI.Avatar name={company?.name || '?'} size={22}/>
                        <span className="deal-value">{fmt.brlK(d.valor_estimado || 0)}</span>
                      </div>
                      <div className="progress" style={{marginTop:10, height:4}}>
                        <span style={{width:`${d.probabilidade || 0}%`}}/>
                      </div>
                      <div className="deal-meta">
                        <I.clock size={10}/><span>{d.data_fechamento_prevista || 'sem data'}</span>
                        <span style={{marginLeft:'auto', fontWeight:600, color:(d.probabilidade||0)>=60?'hsl(var(--success))':'hsl(var(--warning))'}}>
                          {d.probabilidade || 0}%
                        </span>
                      </div>
                    </div>
                  );
                })}
                {stageDeals.length === 0 && (
                  <div style={{padding:16, textAlign:'center', color:'hsl(var(--fg-faint))', fontSize:12}}>
                    Solte aqui
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {editing && <DealModal deal={editing.id ? editing : null} onClose={()=>setEditing(null)} onSaved={onSaved}/>}
      {closing && <CloseDealModal deal={closing} onClose={()=>setClosing(null)} onSaved={onSaved}/>}
    </>
  );
}
window.Pipeline = Pipeline;
