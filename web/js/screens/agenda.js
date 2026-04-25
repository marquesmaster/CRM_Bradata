// Agenda: calendário mensal com criação inline + clique pra detalhe + click em dia cria nova
function Agenda() {
  const me = window.DATA.CURRENT_USER;
  const [cursor, setCursor] = React.useState(new Date());
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [view, setView] = React.useState('mes');  // 'mes' | 'semana'
  const [filter, setFilter] = React.useState('all');  // all | mine | overdue
  const [team, setTeam] = React.useState([]);
  const [editing, setEditing] = React.useState(null);
  const [dayDetail, setDayDetail] = React.useState(null);   // { date, items[] }

  const y = cursor.getFullYear();
  const m = cursor.getMonth();

  const load = React.useCallback(() => {
    setLoading(true);
    // Busca atividades do mês corrente +- 1 mês pra cobrir bordas
    window.API.api(`/atividades?size=500`)
      .then(r => setItems((r.items || []).filter(a => a.due_date || a.data_atividade)))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(load, [load, cursor]);
  React.useEffect(() => {
    window.API.api('/users/team').then(setTeam).catch(()=>{});
  }, []);

  // Filtros aplicados em RAM
  const filteredItems = items.filter(a => {
    if (filter === 'mine') return a.user_id === Number(me.id) || a.assignee_id === Number(me.id);
    if (filter === 'overdue') return a.due_date && new Date(a.due_date) < new Date() && a.status !== 'concluida';
    return true;
  });

  // calcula grade
  let grid = [];
  let viewLabel = '';
  if (view === 'mes') {
    const primeiro = new Date(y, m, 1);
    const ultimo = new Date(y, m + 1, 0);
    const diaSemanaInicio = primeiro.getDay();
    const diasNoMes = ultimo.getDate();
    for (let i = 0; i < diaSemanaInicio; i++) grid.push(null);
    for (let d = 1; d <= diasNoMes; d++) grid.push(new Date(y, m, d));
    while (grid.length % 7 !== 0) grid.push(null);
    const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    viewLabel = `${meses[m]} ${y}`;
  } else {
    // semana: 7 dias começando no domingo da semana do cursor
    const start = new Date(cursor);
    start.setDate(start.getDate() - start.getDay());
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      grid.push(d);
    }
    viewLabel = `Semana de ${grid[0].toLocaleDateString('pt-BR', {day:'2-digit', month:'short'})} a ${grid[6].toLocaleDateString('pt-BR', {day:'2-digit', month:'short'})}`;
  }

  const porDia = {};
  filteredItems.forEach(a => {
    const when = a.due_date || a.data_atividade;
    if (!when) return;
    const d = new Date(when);
    const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    (porDia[k] ||= []).push(a);
  });

  const newOnDay = (date) => {
    const local = new Date(date);
    local.setHours(9, 0, 0, 0);  // 9h por padrão
    setEditing({ due_date: local.toISOString() });
  };

  const navMonth = (delta) => setCursor(new Date(y, m + delta, 1));
  const navWeek = (delta) => {
    const d = new Date(cursor);
    d.setDate(d.getDate() + delta * 7);
    setCursor(d);
  };

  const stats = {
    total: filteredItems.length,
    pendentes: filteredItems.filter(a => a.status === 'pendente').length,
    concluidas: filteredItems.filter(a => a.status === 'concluida').length,
    atrasadas: filteredItems.filter(a => a.due_date && new Date(a.due_date) < new Date() && a.status !== 'concluida').length,
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Agenda</h1>
          <div className="page-sub">
            {stats.total} agendadas · {stats.pendentes} pendentes · {stats.concluidas} concluídas
            {stats.atrasadas > 0 && <> · <strong style={{color:'hsl(var(--danger))'}}>{stats.atrasadas} atrasadas</strong></>}
          </div>
        </div>
        <div className="actions">
          <div className="segment-ctrl">
            <button className={view==='mes'?'active':''} onClick={()=>setView('mes')}>Mês</button>
            <button className={view==='semana'?'active':''} onClick={()=>setView('semana')}>Semana</button>
          </div>
          <button className="btn btn-accent btn-sm" onClick={()=>setEditing({})}><I.plus size={12}/>Nova atividade</button>
        </div>
      </div>

      <div className="filters-bar" style={{display:'flex', gap:12, alignItems:'center', marginBottom:14}}>
        <button className="btn btn-ghost btn-sm" onClick={()=>view==='mes' ? navMonth(-1) : navWeek(-1)}>← Anterior</button>
        <button className="btn btn-ghost btn-sm" onClick={()=>setCursor(new Date())}>Hoje</button>
        <button className="btn btn-ghost btn-sm" onClick={()=>view==='mes' ? navMonth(1) : navWeek(1)}>Próximo →</button>
        <div style={{flex:1}}/>
        <div className="segment-ctrl">
          {[['all','Todos'],['mine','Meus'],['overdue','Atrasados']].map(([k,l]) => (
            <button key={k} className={filter===k?'active':''} onClick={()=>setFilter(k)}>{l}</button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div className="card-title" style={{textTransform:'capitalize'}}>{viewLabel}</div>
          {loading && <span className="muted" style={{fontSize:11}}>Carregando…</span>}
        </div>
        <div className="card-p">
          <div style={{display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:6, fontSize:10, textTransform:'uppercase', color:'hsl(var(--fg-muted))', marginBottom:8, fontWeight:600}}>
            {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d => <div key={d} style={{padding:'4px 6px'}}>{d}</div>)}
          </div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:6}}>
            {grid.map((d, i) => {
              if (!d) return <div key={i}/>;
              const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
              const evs = porDia[k] || [];
              const isHoje = new Date().toDateString() === d.toDateString();
              return (
                <div key={i}
                  onDoubleClick={()=>newOnDay(d)}
                  style={{
                    minHeight: view==='mes' ? 100 : 220, padding:8, borderRadius:8,
                    border: '1px solid hsl(var(--border))',
                    background: isHoje ? 'hsl(var(--b-accent) / .08)' : 'hsl(var(--surface-2, var(--surface)))',
                    cursor: 'pointer',
                    transition: '.1s',
                    position: 'relative',
                  }}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6}}>
                    <div style={{fontSize:11, fontWeight:700, color: isHoje ? 'hsl(var(--b-accent))' : 'hsl(var(--fg))'}}>
                      {d.getDate()}
                    </div>
                    <button className="icon-btn" style={{width:18, height:18, opacity:.5}} onClick={e=>{e.stopPropagation(); newOnDay(d);}}>
                      <I.plus size={10}/>
                    </button>
                  </div>
                  {evs.slice(0, view==='mes' ? 3 : 8).map(a => {
                    const isOverdue = a.due_date && new Date(a.due_date) < new Date() && a.status !== 'concluida';
                    return (
                      <div key={a.id} onClick={e=>{e.stopPropagation(); setEditing(a);}}
                        style={{
                          fontSize: 10.5, padding: '3px 6px', borderRadius: 4,
                          background: a.status==='concluida' ? 'hsl(var(--success) / .15)' : 'hsl(var(--surface))',
                          marginBottom: 2,
                          borderLeft: `3px solid ${
                            a.prioridade==='urgente' ? 'hsl(var(--danger))' :
                            a.prioridade==='alta' ? 'hsl(var(--danger))' :
                            a.prioridade==='media' ? 'hsl(var(--warning))' :
                            'hsl(var(--info))'
                          }`,
                          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                          textDecoration: a.status==='concluida' ? 'line-through' : 'none',
                          opacity: a.status==='concluida' ? .6 : 1,
                          color: isOverdue ? 'hsl(var(--danger))' : 'inherit',
                          cursor:'pointer',
                        }} title={a.titulo}>
                        {a.due_date && <span className="mono" style={{fontSize:9.5, opacity:.65, marginRight:4}}>
                          {new Date(a.due_date).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}
                        </span>}
                        {a.titulo}
                      </div>
                    );
                  })}
                  {evs.length > (view==='mes' ? 3 : 8) && (
                    <button onClick={e=>{e.stopPropagation(); setDayDetail({date:d, items:evs});}}
                      style={{background:'none', border:0, padding:0, cursor:'pointer', fontSize:10, color:'hsl(var(--b-accent))', fontWeight:600}}>
                      +{evs.length - (view==='mes' ? 3 : 8)} mais
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <div className="muted" style={{fontSize:11.5, marginTop:12, textAlign:'center'}}>
            💡 Duplo-clique em um dia pra criar atividade. Click numa atividade pra editar.
          </div>
        </div>
      </div>

      {editing && <ActivityModal atividade={editing.id ? editing : null}
        team={team} onClose={()=>setEditing(null)}
        onSaved={()=>{setEditing(null); load();}}/>}

      {dayDetail && <DayDetailModal day={dayDetail} onClose={()=>setDayDetail(null)}
        onEdit={(a)=>{setDayDetail(null); setEditing(a);}}/>}
    </>
  );
}

function DayDetailModal({ day, onClose, onEdit }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:520}}>
        <div className="modal-head">
          <div>
            <div className="card-title">{day.date.toLocaleDateString('pt-BR', {weekday:'long', day:'2-digit', month:'long'})}</div>
            <div className="muted" style={{fontSize:12}}>{day.items.length} atividades</div>
          </div>
          <button className="icon-btn" onClick={onClose}><I.x size={16}/></button>
        </div>
        <div className="modal-body" style={{padding:0, maxHeight:480, overflowY:'auto'}}>
          {day.items.map(a => (
            <button key={a.id} onClick={()=>onEdit(a)}
              style={{width:'100%', padding:'12px 20px', textAlign:'left', background:'none', border:0, borderBottom:'1px solid hsl(var(--border))', cursor:'pointer'}}>
              <div className="row" style={{gap:8, alignItems:'center'}}>
                {a.due_date && <span className="mono muted" style={{fontSize:11}}>{new Date(a.due_date).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</span>}
                <strong style={{fontSize:13, flex:1}}>{a.titulo}</strong>
                <span className="chip" style={{fontSize:10}}>{a.tipo}</span>
                {a.prioridade === 'alta' && <span className="chip danger" style={{fontSize:10}}>Alta</span>}
              </div>
              {a.descricao && <div className="muted" style={{fontSize:11.5, marginTop:4}}>{a.descricao.slice(0,160)}</div>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

window.Agenda = Agenda;
