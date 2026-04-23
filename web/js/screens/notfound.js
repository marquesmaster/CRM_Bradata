// 404 NotFound
function NotFound({ onHome }) {
  return (
    <div style={{
      minHeight:'60vh',
      display:'grid',
      placeItems:'center',
      textAlign:'center',
    }}>
      <div>
        <div style={{fontSize:80, fontWeight:800, letterSpacing:'-.03em', color:'hsl(var(--b-accent))', lineHeight:1}}>404</div>
        <h2 style={{margin:'12px 0 8px'}}>Página não encontrada</h2>
        <p className="muted" style={{maxWidth:360, margin:'0 auto 20px'}}>A rota que você tentou acessar não existe no Bradata CRM.</p>
        <button className="btn btn-accent" onClick={onHome}>Voltar ao dashboard</button>
      </div>
    </div>
  );
}

window.NotFound = NotFound;
