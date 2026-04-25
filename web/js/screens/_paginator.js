// Componente reusável de paginação. Use em toda tela com lista grande.
function Paginator({ page, total, size, onPage }) {
  if (total <= size) return null;
  const totalPages = Math.ceil(total / size);
  const from = (page - 1) * size + 1;
  const to = Math.min(page * size, total);

  // janela de páginas mostradas (max 5 + edges)
  const pages = [];
  const window_size = 2;
  for (let p = Math.max(1, page - window_size); p <= Math.min(totalPages, page + window_size); p++) {
    pages.push(p);
  }
  const showFirst = pages[0] > 1;
  const showLast = pages[pages.length - 1] < totalPages;

  return (
    <div className="row-between" style={{marginTop:14, padding:'0 6px', flexWrap:'wrap', gap:10}}>
      <span className="muted" style={{fontSize:12}}>
        {from.toLocaleString('pt-BR')}–{to.toLocaleString('pt-BR')} de {total.toLocaleString('pt-BR')}
      </span>
      <div className="row" style={{gap:4, flexWrap:'wrap'}}>
        <button className="btn btn-xs btn-ghost" disabled={page<=1} onClick={()=>onPage(1)} title="Primeira">«</button>
        <button className="btn btn-xs btn-ghost" disabled={page<=1} onClick={()=>onPage(page-1)}>‹ Ant</button>
        {showFirst && <>
          <button className="btn btn-xs btn-ghost" onClick={()=>onPage(1)}>1</button>
          {pages[0] > 2 && <span className="muted" style={{padding:'0 4px'}}>…</span>}
        </>}
        {pages.map(p => (
          <button key={p} className={`btn btn-xs ${p===page?'btn-accent':'btn-ghost'}`} onClick={()=>onPage(p)}>
            {p}
          </button>
        ))}
        {showLast && <>
          {pages[pages.length-1] < totalPages-1 && <span className="muted" style={{padding:'0 4px'}}>…</span>}
          <button className="btn btn-xs btn-ghost" onClick={()=>onPage(totalPages)}>{totalPages}</button>
        </>}
        <button className="btn btn-xs btn-ghost" disabled={page*size>=total} onClick={()=>onPage(page+1)}>Prox ›</button>
        <button className="btn btn-xs btn-ghost" disabled={page>=totalPages} onClick={()=>onPage(totalPages)} title="Última">»</button>
      </div>
    </div>
  );
}

window.Paginator = Paginator;
