// Bradata AI — floating chat assistant
function AIChat({ externalOpen, onClose, hideFab }) {
  const [openState, setOpenState] = React.useState(false);
  const open = externalOpen != null ? externalOpen : openState;
  const setOpen = (v) => {
    if (externalOpen != null) { if (!v && onClose) onClose(); }
    else setOpenState(v);
  };
  const [thinking, setThinking] = React.useState(false);
  const [msgs, setMsgs] = React.useState([
    { r:'ai', t:'Olá Rafael 👋 Sou a **Bradata AI**. Posso analisar leads do PNCP, resumir contas e sugerir próximos passos. O que você quer ver hoje?' }
  ]);
  const [input, setInput] = React.useState('');
  const scrollRef = React.useRef(null);

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, thinking]);

  const suggestions = [
    'Top 5 leads 100MM+ para abordar essa semana',
    'Resuma o deal SERPRO',
    'Quais contratos PNCP casam com Java + Cloud?',
  ];

  async function send(text) {
    const q = text || input;
    if (!q.trim()) return;
    setMsgs(m => [...m, { r:'user', t: q }]);
    setInput('');
    setThinking(true);

    try {
      const context = `Você é a Bradata AI, assistente do CRM da Bradata (empresa de TI focada em Bodyshop para empresas 100MM+ que encontramos via PNCP). Responda em português brasileiro, de forma direta, executiva, com bullets quando útil. Seja bem breve (max 4-5 linhas). Use **negrito** para destaques.`;
      const response = await window.claude.complete({
        messages: [
          { role:'user', content: `${context}\n\nPergunta do usuário: ${q}` }
        ]
      });
      setMsgs(m => [...m, { r:'ai', t: response }]);
    } catch (e) {
      setMsgs(m => [...m, { r:'ai', t: 'Desculpe, tive um problema para responder. Tenta de novo?' }]);
    }
    setThinking(false);
  }

  const renderText = (t) => t.split('\n').map((line,i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return <div key={i} style={{minHeight: line ? 'auto' : 8}}>{parts.map((p,j) => p.startsWith('**') ? <strong key={j}>{p.slice(2,-2)}</strong> : p)}</div>;
  });

  return (
    <>
      {!open && !hideFab && (
        <button className="ai-fab" onClick={()=>setOpen(true)} title="Bradata AI">
          <div className="ai-fab-inner">
            <I.sparkle size={18}/>
          </div>
          <span className="ai-fab-label">Bradata AI</span>
        </button>
      )}
      {open && (
        <div className="ai-panel">
          <div className="ai-panel-head">
            <div className="row" style={{gap:10}}>
              <div className="ai-panel-ico"><I.sparkle size={14}/></div>
              <div>
                <strong style={{fontSize:14}}>Bradata AI</strong>
                <div className="muted" style={{fontSize:11}}>Claude Haiku · pronta pra ajudar</div>
              </div>
            </div>
            <button className="icon-btn" onClick={()=>setOpen(false)}><I.x size={16}/></button>
          </div>
          <div className="ai-panel-body" ref={scrollRef}>
            {msgs.map((m,i) => (
              <div key={i} className={`ai-msg ${m.r}`}>
                {m.r==='ai' && <div className="ai-msg-avatar"><I.sparkle size={10}/></div>}
                <div className="ai-msg-bubble">{renderText(m.t)}</div>
              </div>
            ))}
            {thinking && (
              <div className="ai-msg ai">
                <div className="ai-msg-avatar"><I.sparkle size={10}/></div>
                <div className="ai-msg-bubble"><div className="typing"><span/><span/><span/></div></div>
              </div>
            )}
            {msgs.length === 1 && !thinking && (
              <div style={{marginTop:16, display:'flex', flexDirection:'column', gap:6}}>
                <div className="faint" style={{fontSize:10, textTransform:'uppercase', letterSpacing:'.06em', padding:'0 4px'}}>Sugestões</div>
                {suggestions.map(s => (
                  <button key={s} className="ai-suggestion" onClick={()=>send(s)}>{s} <I.chevron size={10}/></button>
                ))}
              </div>
            )}
          </div>
          <div className="ai-panel-foot">
            <input
              className="ai-input"
              placeholder="Pergunte qualquer coisa…"
              value={input}
              onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>e.key==='Enter' && send()}
              disabled={thinking}
            />
            <button className="btn btn-accent btn-sm" onClick={()=>send()} disabled={thinking || !input.trim()}>
              <I.send size={12}/>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

window.AIChat = AIChat;
