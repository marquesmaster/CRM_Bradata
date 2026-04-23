function Chat() {
  const [channels, setChannels] = React.useState([]);
  const [activeId, setActiveId] = React.useState(null);
  const [messages, setMessages] = React.useState([]);
  const [users, setUsers] = React.useState([]);
  const [showNew, setShowNew] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const [typingUsers, setTypingUsers] = React.useState({});  // {channel_id: {user_id: timestamp}}
  const wsRef = React.useRef(null);
  const messagesEndRef = React.useRef(null);

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
            // marca lida automaticamente
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

  // Limpeza de typing após 4s
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
    const msgs = await window.API.api(`/chat/channels/${id}/messages?limit=100`);
    setMessages(msgs);
    await window.API.api(`/chat/channels/${id}/read`, { method:'POST' });
    refreshChannels();
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior:'smooth' }), 50);
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
        body: JSON.stringify({ conteudo: text }),
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

  const active = channels.find(c => c.id === activeId);
  const userById = (uid) => users.find(u => u.id === uid);
  const typing = typingUsers[activeId] || {};
  const typingNames = Object.keys(typing)
    .filter(uid => Number(uid) !== meId)
    .map(uid => userById(Number(uid))?.nome?.split(' ')[0])
    .filter(Boolean);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Chat interno</h1>
          <div className="page-sub">Converse com seu time em tempo real · {channels.length} {channels.length===1?'conversa':'conversas'}</div>
        </div>
        <div className="actions">
          <button className="btn btn-accent btn-sm" onClick={()=>setShowNew(true)}>
            <I.plus size={12}/>Nova conversa
          </button>
        </div>
      </div>

      <div className="card" style={{padding:0, height:'calc(100vh - 180px)', minHeight:520, display:'grid', gridTemplateColumns:'280px 1fr'}}>
        <aside style={{borderRight:'1px solid hsl(var(--border))', overflowY:'auto'}}>
          {channels.length === 0 && (
            <div style={{padding:24, textAlign:'center'}}>
              <div className="muted" style={{fontSize:13, marginBottom:10}}>Nenhuma conversa ainda.</div>
              <button className="btn btn-sm btn-accent" onClick={()=>setShowNew(true)}>
                <I.plus size={12}/>Iniciar conversa
              </button>
            </div>
          )}
          {channels.map(ch => (
            <ChannelRow key={ch.id} channel={ch} active={ch.id===activeId} onClick={()=>openChannel(ch.id)}/>
          ))}
        </aside>

        <section style={{display:'flex', flexDirection:'column', minWidth:0}}>
          {!active && (
            <div style={{flex:1, display:'grid', placeItems:'center', color:'hsl(var(--fg-muted))'}}>
              <div style={{textAlign:'center'}}>
                <I.chat size={42}/>
                <div style={{marginTop:10, fontSize:14}}>Selecione uma conversa ou inicie uma nova</div>
              </div>
            </div>
          )}

          {active && <>
            <div style={{padding:'14px 20px', borderBottom:'1px solid hsl(var(--border))', display:'flex', alignItems:'center', gap:12}}>
              {active.kind === 'group'
                ? <span className="icon-btn" style={{background:'hsl(var(--b-accent) / .12)', color:'hsl(var(--b-accent))'}}><I.hash size={14}/></span>
                : <UI.Avatar name={active.nome} size={34}/>}
              <div style={{flex:1, minWidth:0}}>
                <div style={{fontSize:14, fontWeight:700}}>{active.nome}</div>
                <div className="muted" style={{fontSize:11.5}}>
                  {active.members.length} membros · {active.kind === 'dm' ? 'Mensagem direta' : 'Grupo'}
                </div>
              </div>
            </div>

            <div style={{flex:1, overflowY:'auto', padding:'16px 20px', display:'flex', flexDirection:'column', gap:6}}>
              {messages.length === 0 && (
                <div className="muted" style={{textAlign:'center', padding:24, fontSize:13}}>Nenhuma mensagem ainda. Diga oi 👋</div>
              )}
              {messages.map((m, i) => {
                const prev = messages[i-1];
                const sameAuthor = prev && prev.user_id === m.user_id && (new Date(m.created_at) - new Date(prev.created_at) < 5*60*1000);
                const mine = m.user_id === meId;
                const author = userById(m.user_id);
                return (
                  <div key={m.id} style={{display:'flex', gap:10, justifyContent: mine?'flex-end':'flex-start', marginTop: sameAuthor?0:8}}>
                    {!mine && !sameAuthor && <UI.Avatar name={author?.nome || '?'} size={28}/>}
                    {!mine && sameAuthor && <div style={{width:28}}/>}
                    <div style={{maxWidth:'70%'}}>
                      {!sameAuthor && (
                        <div style={{fontSize:11, color:'hsl(var(--fg-muted))', marginBottom:3, textAlign: mine?'right':'left'}}>
                          {mine ? 'Você' : (author?.nome || '?')} · {new Date(m.created_at).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}
                        </div>
                      )}
                      <div style={{
                        padding:'8px 12px', borderRadius:14,
                        background: mine ? 'hsl(var(--b-accent))' : 'hsl(var(--surface-2))',
                        color: mine ? 'white' : 'hsl(var(--fg))',
                        borderTopRightRadius: mine && sameAuthor ? 6 : 14,
                        borderTopLeftRadius: !mine && sameAuthor ? 6 : 14,
                        fontSize:13.5, lineHeight:1.45,
                        opacity: m.deleted_at ? .5 : 1,
                        fontStyle: m.deleted_at ? 'italic' : 'normal',
                        whiteSpace:'pre-wrap', wordBreak:'break-word',
                        position:'relative',
                      }}>
                        {m.conteudo}
                        {mine && !m.deleted_at && (
                          <button onClick={()=>deleteMsg(m.id)} className="msg-del-btn"
                            style={{position:'absolute', top:-8, right:-8, width:20, height:20, borderRadius:10, background:'hsl(var(--danger))', color:'white', border:0, cursor:'pointer', opacity:0, transition:'.15s', fontSize:10}}>×</button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {typingNames.length > 0 && (
                <div className="muted" style={{fontSize:11.5, padding:'4px 0', fontStyle:'italic'}}>
                  {typingNames.join(', ')} digitando…
                </div>
              )}
              <div ref={messagesEndRef}/>
            </div>

            <div style={{padding:'12px 20px', borderTop:'1px solid hsl(var(--border))', display:'flex', gap:10, alignItems:'flex-end'}}>
              <textarea
                className="input"
                rows={1}
                value={draft}
                placeholder="Mensagem… (Enter envia, Shift+Enter quebra linha)"
                onChange={e => { setDraft(e.target.value); sendTyping(); }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
                }}
                style={{resize:'none', minHeight:38, maxHeight:120, fontSize:13.5}}
              />
              <button className="btn btn-accent btn-sm" onClick={send} disabled={!draft.trim()}>
                <I.send size={13}/>
              </button>
            </div>
          </>}
        </section>
      </div>

      {showNew && (
        <NewConversationModal users={users.filter(u => u.id !== meId)} onClose={()=>setShowNew(false)}
          onCreated={(ch) => { setShowNew(false); refreshChannels(); openChannel(ch.id); }}/>
      )}

      <style>{`.msg-del-btn { opacity: 0; } div:hover > div > .msg-del-btn { opacity: 1; }`}</style>
    </>
  );
}

function ChannelRow({ channel, active, onClick }) {
  const last = channel.last_message_at ? new Date(channel.last_message_at) : null;
  return (
    <button onClick={onClick} style={{
      width:'100%', textAlign:'left', padding:'12px 14px',
      background: active ? 'hsl(var(--b-accent) / .08)' : 'transparent',
      borderLeft: active ? '3px solid hsl(var(--b-accent))' : '3px solid transparent',
      borderBottom:'1px solid hsl(var(--border))',
      cursor:'pointer', display:'flex', gap:10, alignItems:'center',
    }}>
      {channel.kind === 'group'
        ? <span style={{width:34, height:34, borderRadius:8, background:'hsl(var(--b-accent) / .15)', color:'hsl(var(--b-accent))', display:'grid', placeItems:'center', flex:'0 0 auto'}}><I.hash size={14}/></span>
        : <UI.Avatar name={channel.nome} size={34}/>}
      <div style={{flex:1, minWidth:0}}>
        <div style={{fontSize:13, fontWeight:600, display:'flex', justifyContent:'space-between', gap:6}}>
          <span style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{channel.nome}</span>
          {last && <span className="muted" style={{fontSize:10, fontWeight:400, flex:'0 0 auto'}}>{relTime(last)}</span>}
        </div>
        <div className="muted" style={{fontSize:11.5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginTop:1}}>
          {channel.last_message_preview || 'Sem mensagens'}
        </div>
      </div>
      {channel.unread > 0 && (
        <span className="chip" style={{background:'hsl(var(--b-accent))', color:'white', fontSize:10, padding:'2px 7px', minWidth:20, justifyContent:'center'}}>{channel.unread}</span>
      )}
    </button>
  );
}

function NewConversationModal({ users, onClose, onCreated }) {
  const [kind, setKind] = React.useState('dm');
  const [nome, setNome] = React.useState('');
  const [selected, setSelected] = React.useState(new Set());
  const [filter, setFilter] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (kind === 'dm') { next.clear(); next.add(id); }
      else { next.has(id) ? next.delete(id) : next.add(id); }
      return next;
    });
  };

  const create = async () => {
    if (selected.size === 0) return;
    if (kind === 'group' && !nome.trim()) { alert('Dê um nome ao grupo'); return; }
    setBusy(true);
    try {
      const ch = await window.API.api('/chat/channels', {
        method:'POST',
        body: JSON.stringify({ kind, nome: kind==='group' ? nome.trim() : null, member_ids: [...selected] }),
      });
      onCreated(ch);
    } catch (e) { alert(e.message); setBusy(false); }
  };

  const filtered = users.filter(u => !filter || (u.nome||'').toLowerCase().includes(filter.toLowerCase()) || (u.email||'').toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:520}}>
        <div className="modal-head">
          <div><div className="card-title">Nova conversa</div></div>
          <button className="icon-btn" onClick={onClose}><I.x size={16}/></button>
        </div>
        <div className="modal-body" style={{display:'flex', flexDirection:'column', gap:14}}>
          <div className="row" style={{gap:8}}>
            <button className={`btn btn-sm ${kind==='dm'?'btn-accent':'btn-ghost'}`} onClick={()=>{setKind('dm'); setSelected(new Set());}}>
              <I.user size={12}/>Mensagem direta
            </button>
            <button className={`btn btn-sm ${kind==='group'?'btn-accent':'btn-ghost'}`} onClick={()=>{setKind('group'); setSelected(new Set());}}>
              <I.hash size={12}/>Grupo
            </button>
          </div>

          {kind === 'group' && (
            <div>
              <label className="card-section-title">Nome do grupo</label>
              <input className="input" value={nome} onChange={e=>setNome(e.target.value)} placeholder="ex: Time Comercial RJ"/>
            </div>
          )}

          <div>
            <label className="card-section-title">{kind==='dm' ? 'Conversar com' : 'Adicionar membros'}</label>
            <input className="input" value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Buscar usuário…" style={{marginBottom:8}}/>
            <div style={{maxHeight:240, overflowY:'auto', border:'1px solid hsl(var(--border))', borderRadius:8}}>
              {filtered.map(u => (
                <label key={u.id} style={{display:'flex', alignItems:'center', gap:10, padding:'8px 12px', borderBottom:'1px solid hsl(var(--border))', cursor:'pointer'}}>
                  <input type="checkbox" checked={selected.has(u.id)} onChange={()=>toggle(u.id)}/>
                  <UI.Avatar name={u.nome} size={26}/>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize:13, fontWeight:500}}>{u.nome}</div>
                    <div className="muted" style={{fontSize:11}}>{u.email}</div>
                  </div>
                </label>
              ))}
              {filtered.length === 0 && <div className="muted" style={{padding:14, textAlign:'center', fontSize:12}}>Nenhum usuário encontrado</div>}
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-sm btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-sm btn-accent" onClick={create} disabled={busy || selected.size===0 || (kind==='group' && !nome.trim())}>
            {busy ? 'Criando…' : 'Criar conversa'}
          </button>
        </div>
      </div>
    </div>
  );
}

function relTime(d) {
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff/60)}m`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h`;
  if (diff < 604800) return `${Math.floor(diff/86400)}d`;
  return d.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'});
}

window.Chat = Chat;
