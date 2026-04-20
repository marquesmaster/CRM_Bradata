// AI Chat — stub. Conecta-se ao backend via POST /api/v1/ai/chat (a ser implementado).
function AIChat({ externalOpen, onClose }) {
  if (!externalOpen) return null;
  return (
    <div className="ai-panel" style={{
      position:'fixed', right:24, bottom:24, width:380, maxWidth:'calc(100vw - 48px)',
      height:520, background:'hsl(var(--surface))', border:'1px solid hsl(var(--border))',
      borderRadius:16, boxShadow:'var(--shadow-lg)', display:'flex', flexDirection:'column', zIndex:100
    }}>
      <div style={{padding:14, background:'linear-gradient(135deg, hsl(var(--b-primary)), hsl(var(--b-primary-600)))', color:'white', display:'flex', justifyContent:'space-between', alignItems:'center', borderRadius:'16px 16px 0 0'}}>
        <div className="row" style={{gap:10}}>
          <div style={{width:32, height:32, borderRadius:10, background:'linear-gradient(135deg, hsl(var(--b-accent)), hsl(var(--b-accent-light)))', display:'grid', placeItems:'center'}}><I.sparkle size={14}/></div>
          <div>
            <strong style={{fontSize:14}}>Bradata AI</strong>
            <div style={{fontSize:11, opacity:.75}}>Em breve · Claude Haiku 4.5</div>
          </div>
        </div>
        <button className="icon-btn" onClick={onClose} style={{color:'white'}}><I.close size={16}/></button>
      </div>
      <div style={{flex:1, overflowY:'auto', padding:16}}>
        <div style={{padding:10, background:'hsl(var(--surface-2))', borderRadius:12, fontSize:13, lineHeight:1.5}}>
          Olá! Eu sou o Bradata AI. Em breve vou ajudar a:
          <ul style={{margin:'8px 0 0 16px', padding:0}}>
            <li>Resumir leads e contratos</li>
            <li>Sugerir próximos passos por deal</li>
            <li>Gerar pitch de cadência</li>
            <li>Detectar SLA em risco</li>
          </ul>
        </div>
      </div>
      <div style={{padding:12, borderTop:'1px solid hsl(var(--border))', display:'flex', gap:8}}>
        <input className="filter-input" placeholder="Pergunte algo…" style={{flex:1}} disabled/>
        <button className="btn btn-accent btn-sm" disabled><I.send size={12}/></button>
      </div>
    </div>
  );
}
window.AIChat = AIChat;
