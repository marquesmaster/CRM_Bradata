// Componente reutilizável: lista de eventos de Historico para uma entidade
function EntityHistoryPanel({ entityType, entityId, title }) {
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!entityType || !entityId) return;
    setLoading(true);
    const qs = new URLSearchParams({ entity_type: entityType, entity_id: entityId, limit: 50 });
    window.API.api(`/historico?${qs}`)
      .then(setItems)
      .finally(()=>setLoading(false));
  }, [entityType, entityId]);

  if (loading) return (
    <div style={{padding:'10px 14px', display:'flex', flexDirection:'column', gap:8}}>
      {Array.from({length:4}).map((_,i) => <Skeleton key={i} height={28}/>)}
    </div>
  );
  if (items.length === 0) return <div className="muted" style={{padding:14, fontSize:12, textAlign:'center'}}>Sem eventos no histórico.</div>;

  return (
    <div style={{borderTop:'1px solid hsl(var(--border))', paddingTop:12, marginTop:6}}>
      {title && <strong style={{fontSize:13, marginBottom:8, display:'block'}}>{title}</strong>}
      <div style={{display:'flex', flexDirection:'column', gap:6, maxHeight:240, overflowY:'auto'}}>
        {items.map(h => (
          <div key={h.id} style={{display:'grid', gridTemplateColumns:'auto 1fr auto', gap:8, padding:'6px 0', borderBottom:'1px dashed hsl(var(--border))', fontSize:12}}>
            <span className="chip" style={{fontSize:10, padding:'1px 6px', alignSelf:'flex-start'}}>{h.acao}</span>
            <div>
              <div style={{fontSize:12.5}}>
                <strong>{h.user_nome || '—'}</strong>
                {h.changes && (
                  <span className="muted mono" style={{marginLeft:8, fontSize:11}}>
                    {formatChanges(h.changes)}
                  </span>
                )}
              </div>
            </div>
            <span className="muted" style={{fontSize:11, whiteSpace:'nowrap', alignSelf:'flex-start'}}>
              {new Date(h.created_at).toLocaleString('pt-BR', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'})}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatChanges(changes) {
  if (!changes || typeof changes !== 'object') return '';
  const parts = [];
  if (changes.de_estagio_id != null && changes.para_estagio_id != null) {
    const stages = window.DATA?.STAGES || [];
    const de = stages.find(s => String(s.id) === String(changes.de_estagio_id))?.label || changes.de_estagio_id;
    const para = stages.find(s => String(s.id) === String(changes.para_estagio_id))?.label || changes.para_estagio_id;
    parts.push(`${de} → ${para}`);
  }
  if (changes.de && changes.para && !changes.de_estagio_id) parts.push(`${changes.de} → ${changes.para}`);
  if (changes.titulo) parts.push(`"${changes.titulo}"`);
  if (changes.motivo) parts.push(`motivo: ${changes.motivo}`);
  if (changes.campos) parts.push(`campos: ${changes.campos.join(', ')}`);
  if (changes.email) parts.push(changes.email);
  return parts.join(' · ');
}

window.EntityHistoryPanel = EntityHistoryPanel;
