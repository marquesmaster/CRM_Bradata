// Chat interno estilo WhatsApp: lista à esquerda com search, mensagens à direita
function Chat() {
  const [channels, setChannels] = React.useState([]);
  const [activeId, setActiveId] = React.useState(null);
  const [messages, setMessages] = React.useState([]);
  const [users, setUsers] = React.useState([]);
  const [draft, setDraft] = React.useState('');
  const [typingUsers, setTypingUsers] = React.useState({});
  const [search, setSearch] = React.useState('');
  const [searchMode, setSearchMode] = React.useState(false);  // true = mostra users pra criar DM
  const wsRef = React.useRef(null);
  const messagesEndRef = React.useRef(null);
  const inputRef = React.useRef(null);

  const me = window.DATA.CURRENT_USER;
  const meId = Number(me.id);

  const refreshChannels = React.useCallback(() => {
    window.API.api('/chat/channels').then(setChannels).catch(()=>{});
  }, []);

  React.useEffect(() => {
    refreshChannels();
    window.API.api('/users/team').then(setUsers).catch(()=>{});
  }, [refreshChannels]);

  // WebSocket
  React.useEffect(() => {
    const token = window.API.auth.token();
    if (!token) return;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${proto}://${location.host}/api/v1/chat/ws?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      try {
        const evt = JSON.parse(e.data);
        if (evt.type === 'message') {
          if (activeId === evt.channel_id) {
            setMessages(prev => [...prev, evt.message]);
            window.API.api(`/chat/channels/${evt.channel_id}/read`, { method:'POST' }).catch(()=>{});
          }
          refreshChannels();
        } else if (evt.type === 'delete') {
          if (activeId === evt.channel_id) {
            setMessages(prev => prev.map(m => m.id === evt.message_id ? {...m, conteudo:'(mensagem removida)', deleted_at: new Date().toISOString()} : m));
          }
        } else if (evt.type === 'typing') {
          setTypingUsers(prev => ({
            ...prev,
            [evt.channel_id]: { ...(prev[evt.channel_id]||{}), [evt.user_id]: Date.now() },
          }));
        }
      } catch {}
    };
    const ping = setInterval(() => { if (ws.readyState === 1) ws.send('ping'); }, 25000);
    return () => { clearInterval(ping); ws.close(); };
  }, [activeId, refreshChannels]);

  // Cleanup typing
  React.useEffect(() => {
    const t = setInterval(() => {
      const cutoff = Date.now() - 4000;
      setTypingUsers(prev => {
        const next = {};
        for (const [ch, mp] of Object.entries(prev)) {
          const filt = Object.fromEntries(Object.entries(mp).filter(([_, ts]) => ts > cutoff));
          if (Object.keys(filt).length) next[ch] = filt;
        }
        return next;
      });
    }, 1500);
    return () => clearInterval(t);
  }, []);

  const openChannel = async (id) => {
    setActiveId(id);
    setMessages([]);
    setSearchMode(false);
    setSearch('');
    const msgs = await window.API.api(`/chat/channels/${id}/messages?limit=100`);
    setMessages(msgs);
    await window.API.api(`/chat/channels/${id}/read`, { method:'POST' });
    refreshChannels();
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior:'smooth' });
      inputRef.current?.focus();
    }, 50);
  };

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior:'smooth' });
  }, [messages]);

  const send = async () => {
    if (!draft.trim() || !activeId) return;
    const text = draft;
    setDraft('');
    try {
      await window.API.api(`/chat/channels/${activeId}/messages`, {
        method:'POST',
        body: { conteudo: text },
      });
    } catch (e) { setDraft(text); alert(e.message); }
  };

  const sendTyping = () => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== 1 || !activeId) return;
    ws.send(JSON.stringify({ type:'typing', channel_id: activeId }));
  };

  const deleteMsg = async (id) => {
    if (!confirm('Remover esta mensagem?')) return;
    await window.API.api(`/chat/messages/${id}`, { method:'DELETE' });
    setMessages(prev => prev.map(m => m.id === id ? {...m, conteudo:'(mensagem removida)', deleted_at: new Date().toISOString()} : m));
  };

  const startDM = async (userId) => {
    try {
      const ch = await window.API.api('/chat/channels', {
        method:'POST',
        body: { kind: 'dm', nome: null, member_ids: [userId] },
      });
      refreshChannels();
      openChannel(ch.id);
    } catch (e) { alert(e.message); }
  };

  const startGroup = () => {
    const nome = prompt('Nome do grupo:');
    if (!nome) return;
    const ids = users.filter(u => u.id !== meId).map(u => `${u.id} - ${u.nome}`).join('\n');
    const sel = prompt(`IDs dos membros (separados por vírgula):\n\n${ids}`);
    if (!sel) return;
    const member_ids = sel.split(',').map(s => parseInt(s.trim())).filter(Boolean);
    if (member_ids.length === 0) return;
    window.API.api('/chat/channels', {
      method:'POST',
      body: { kind: 'group', nome, member_ids },
    }).then(ch => { refreshChannels(); openChannel(ch.id); }).catch(e => alert(e.message));
  };

  const active = channels.find(c => c.id === activeId);
  const userById = (uid) => users.find(u => u.id === uid);
  const typing = typingUsers[activeId] || {};
  const typingNames = Object.keys(typing)
    .filter(uid => Number(uid) !== meId)
    .map(uid => userById(Number(uid))?.nome?.split(' ')[0])
    .filter(Boolean);

  // Filtro de busca: busca em conversas existentes E em users (pra criar DM nova)
  const q = search.trim().toLowerCase();
  const filteredChannels = !q ? channels : channels.filter(c =>
    (c.nome || '').toLowerCase().includes(q) ||
    (c.last_message_preview || '').toLowerCase().includes(q));
  const matchedUsers = !q ? [] : users
    .filter(u => u.id !== meId)
    .filter(u => (u.nome || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q))
    // Esconde users que já têm DM (vai aparecer no channel)
    .filter(u => !channels.some(c => c.kind === 'dm' && c.members?.some(m => m.user_id === u.id)));

  return (
    <div className="wa-shell">
      {/* Coluna esquerda: lista */}
      <aside className="wa-sidebar">
        <div className="wa-sidebar-head">
          <div className="row" style={{gap:10, alignItems:'center'}}>
            <UI.Avatar name={me.name || me.email} size={36}/>
            <div style={{flex:1, minWidth:0}}>
              <strong style={{fontSize:14}}>Conversas</strong>
              <div className="muted" style={{fontSize:11.5}}>{channels.length} {channels.length===1?'conversa':'conversas'}</div>
            </div>
            <button className="icon-btn" title="Novo grupo" onClick={startGroup}>
              <I.users size={15}/>
            </button>
          </div>
        </div>

        <div className="wa-search-wrap">
          <I.search size={13} className="wa-search-icon"/>
          <input
            type="search"
            placeholder="Buscar ou começar uma nova conversa"
            value={search}
            onChange={e=>setSearch(e.target.value)}
            className="wa-search"
          />
        </div>

        <div className="wa-list">
          {filteredChannels.length === 0 && matchedUsers.length === 0 && (
            <div style={{padding:24, textAlign:'center'}}>
              {q
                ? <div className="muted" style={{fontSize:13}}>Nenhum resultado pra "{search}".</div>
                : <>
                    <I.chat size={36} style={{opacity:.3, marginBottom:10}}/>
                    <div className="muted" style={{fontSize:13, marginBottom:4}}>Nenhuma conversa.</div>
                    <div className="muted" style={{fontSize:11.5}}>Use a busca acima pra encontrar um colega.</div>
                  </>}
            </div>
          )}

          {filteredChannels.map(ch => (
            <ChannelRow key={ch.id} channel={ch} active={ch.id === activeId} onClick={()=>openChannel(ch.id)}/>
          ))}

          {q && matchedUsers.length > 0 && (
            <>
              <div className="wa-section-title">Iniciar nova conversa</div>
              {matchedUsers.map(u => (
                <button key={u.id} onClick={()=>startDM(u.id)} className="wa-user-row">
                  <UI.Avatar name={u.nome} size={42}/>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize:14, fontWeight:600}}>{u.nome}</div>
                    <div className="muted" style={{fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                      {u.email}
                    </div>
                  </div>
                  <I.send size={14} style={{color:'hsl(var(--b-accent))'}}/>
                </button>
              ))}
            </>
          )}
        </div>
      </aside>

      {/* Coluna direita: conversa ativa */}
      <section className="wa-conv">
        {!active && (
          <div className="wa-empty">
            <I.chat size={64} style={{opacity:.2}}/>
            <h2 style={{margin:'18px 0 6px', fontSize:18}}>Bradata Chat</h2>
            <p className="muted" style={{fontSize:13.5, maxWidth:380, textAlign:'center'}}>
              Selecione uma conversa à esquerda ou use a busca para começar uma nova com qualquer membro do time.
            </p>
          </div>
        )}

        {active && <>
          <header className="wa-conv-head">
            {active.kind === 'group'
              ? <span className="wa-group-mark"><I.hash size={16}/></span>
              : <UI.Avatar name={active.nome} size={42}/>}
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:15, fontWeight:600}}>{active.nome}</div>
              <div className="muted" style={{fontSize:11.5}}>
                {active.kind === 'dm'
                  ? (typingNames.length > 0 ? `digitando…` : 'Mensagem direta')
                  : `${active.members.length} membros${typingNames.length > 0 ? ` · ${typingNames.join(', ')} digitando…` : ''}`}
              </div>
            </div>
          </header>

          <div className="wa-messages">
            {messages.length === 0 && (
              <div className="muted" style={{textAlign:'center', padding:'40px 24px', fontSize:13}}>
                Nenhuma mensagem ainda. Diga oi 👋
              </div>
            )}
            {messages.map((m, i) => {
              const prev = messages[i-1];
              const sameAuthor = prev && prev.user_id === m.user_id && (new Date(m.created_at) - new Date(prev.created_at) < 5*60*1000);
              const mine = m.user_id === meId;
              const author = userById(m.user_id);
              return (
                <div key={m.id} className={`wa-msg-row ${mine?'mine':''} ${sameAuthor?'same':''}`}>
                  {!mine && !sameAuthor && <UI.Avatar name={author?.nome || '?'} size={28}/>}
                  {!mine && sameAuthor && <div style={{width:28}}/>}
                  <div className={`wa-bubble ${mine?'mine':''} ${m.deleted_at?'deleted':''}`}>
                    {!sameAuthor && active?.kind === 'group' && !mine && (
                      <div className="wa-author">{author?.nome || '?'}</div>
                    )}
                    <div className="wa-conteudo">{m.conteudo}</div>
                    <div className="wa-time">
                      {new Date(m.created_at).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}
                    </div>
                    {mine && !m.deleted_at && (
                      <button onClick={()=>deleteMsg(m.id)} className="wa-del">×</button>
                    )}
                  </div>
                </div>
              );
            })}
            {typingNames.length > 0 && (
              <div className="muted" style={{fontSize:11.5, padding:'4px 12px', fontStyle:'italic'}}>
                {typingNames.join(', ')} digitando…
              </div>
            )}
            <div ref={messagesEndRef}/>
          </div>

          <div className="wa-input-bar">
            <textarea
              ref={inputRef}
              rows={1}
              value={draft}
              placeholder="Digite uma mensagem"
              onChange={e=>{ setDraft(e.target.value); sendTyping(); autoResize(e.target); }}
              onKeyDown={e=>{
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
              }}
              className="wa-input"
            />
            <button className="wa-send-btn" onClick={send} disabled={!draft.trim()} title="Enviar">
              <I.send size={16}/>
            </button>
          </div>
        </>}
      </section>
    </div>
  );
}

function ChannelRow({ channel, active, onClick }) {
  const last = channel.last_message_at ? new Date(channel.last_message_at) : null;
  return (
    <button onClick={onClick} className={`wa-row ${active?'active':''}`}>
      {channel.kind === 'group'
        ? <span className="wa-group-mark"><I.hash size={16}/></span>
        : <UI.Avatar name={channel.nome} size={42}/>}
      <div style={{flex:1, minWidth:0}}>
        <div className="wa-row-top">
          <span className="wa-row-name">{channel.nome}</span>
          {last && <span className="wa-row-time">{relTime(last)}</span>}
        </div>
        <div className="wa-row-bottom">
          <span className="wa-row-preview">{channel.last_message_preview || 'Sem mensagens'}</span>
          {channel.unread > 0 && <span className="wa-unread">{channel.unread}</span>}
        </div>
      </div>
    </button>
  );
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

function relTime(d) {
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff/60)}m`;
  if (diff < 86400) {
    return d.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
  }
  if (diff < 604800) return d.toLocaleDateString('pt-BR', {weekday:'short'});
  return d.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'});
}

window.Chat = Chat;
