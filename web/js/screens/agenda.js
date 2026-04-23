// /agenda — calendário mensal de atividades com due_date
function Agenda() {
  const { fmt, ACTIVITIES } = window.DATA;
  const [cursor, setCursor] = React.useState(new Date());
  const [items, setItems] = React.useState(ACTIVITIES || []);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    window.API.api('/atividades?size=500')
      .then(r => setItems((r.items||[]).filter(a => a.due_date || a.data_atividade)))
      .catch(() => setItems(ACTIVITIES || []))
      .finally(() => setLoading(false));
  }, []);

  // calcula grade do mês
  const y = cursor.getFullYear();
  const m = cursor.getMonth();
  const primeiro = new Date(y, m, 1);
  const ultimo = new Date(y, m + 1, 0);
  const diaSemanaInicio = primeiro.getDay(); // 0=dom
  const diasNoMes = ultimo.getDate();
  const grid = [];
  for (let i = 0; i < diaSemanaInicio; i++) grid.push(null);
  for (let d = 1; d <= diasNoMes; d++) grid.push(new Date(y, m, d));
  while (grid.length % 7 !== 0) grid.push(null);

  const porDia = {};
  items.forEach(a => {
    const when = a.due_date || a.data_atividade;
    if (!when) return;
    const k = new Date(when).toISOString().slice(0,10);
    (porDia[k] ||= []).push(a);
  });

  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Agenda</h1>
          <div className="page-sub">{items.length} atividades agendadas</div>
        </div>
        <div className="actions">
          <button className="btn btn-ghost btn-sm" onClick={()=>setCursor(new Date(y, m-1, 1))}>← Mês anterior</button>
          <button className="btn btn-ghost btn-sm" onClick={()=>setCursor(new Date())}>Hoje</button>
          <button className="btn btn-ghost btn-sm" onClick={()=>setCursor(new Date(y, m+1, 1))}>Próximo mês →</button>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div className="card-title" style={{textTransform:'capitalize'}}>{meses[m]} {y}</div>
          <span className="chip">{items.filter(a=>{const w=a.due_date||a.data_atividade;if(!w)return false;const d=new Date(w);return d.getMonth()===m&&d.getFullYear()===y;}).length} neste mês</span>
        </div>
        <div className="card-p">
          <div style={{display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:6, fontSize:10, textTransform:'uppercase', color:'hsl(var(--fg-muted))', marginBottom:8, fontWeight:600}}>
            {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d => <div key={d} style={{padding:'4px 6px'}}>{d}</div>)}
          </div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:6}}>
            {grid.map((d, i) => {
              if (!d) return <div key={i}/>;
              const k = d.toISOString().slice(0,10);
              const evs = porDia[k] || [];
              const isHoje = new Date().toISOString().slice(0,10) === k;
              return (
                <div key={i} style={{minHeight:90, padding:8, borderRadius:8, border:'1px solid hsl(var(--border))', background:isHoje?'hsl(var(--b-accent-soft))':'hsl(var(--surface-2))'}}>
                  <div style={{fontSize:11, fontWeight:700, color:isHoje?'hsl(var(--b-accent))':'hsl(var(--fg))', marginBottom:4}}>{d.getDate()}</div>
                  {evs.slice(0,3).map(a => (
                    <div key={a.id} style={{fontSize:10.5, padding:'2px 6px', borderRadius:4, background:'hsl(var(--surface))', marginBottom:2, borderLeft:`3px solid ${a.priority==='alta'?'hsl(var(--danger))':a.priority==='media'?'hsl(var(--warning))':'hsl(var(--info))'}`, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                      {a.title || a.titulo}
                    </div>
                  ))}
                  {evs.length > 3 && <div style={{fontSize:10, color:'hsl(var(--fg-faint))'}}>+{evs.length-3} mais</div>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

window.Agenda = Agenda;
