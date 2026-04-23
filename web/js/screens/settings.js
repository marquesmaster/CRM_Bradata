function Settings() {
  return (
    <>
      <div className="page-head"><h1 className="page-title">Configurações</h1></div>
      <div className="grid-2">
        <GoogleConnectCard/>
        <div className="card">
          <div className="card-head"><div className="card-title">Integração PNCP</div><span className="chip success"><I.check size={10}/>Ativa</span></div>
          <div className="card-p">
            <div className="setting-row"><div><strong>Endpoint API</strong><div className="muted" style={{fontSize:11.5}}>pncp.gov.br/api</div></div><span className="chip">v1</span></div>
            <div className="setting-row"><div><strong>Frequência de sync</strong><div className="muted" style={{fontSize:11.5}}>Diário 03h</div></div><button className="btn btn-xs btn-ghost">Alterar</button></div>
            <div className="setting-row"><div><strong>Última sync</strong><div className="muted" style={{fontSize:11.5}}>—</div></div><button className="btn btn-xs btn-ghost"><I.refresh size={10}/>Agora</button></div>
            <div className="setting-row" style={{borderBottom:'none'}}><div><strong>Filtros ativos</strong><div className="muted" style={{fontSize:11.5}}>Bodyshop · todas UFs</div></div><button className="btn btn-xs btn-ghost">Editar</button></div>
          </div>
        </div>
        <div className="card">
          <div className="card-head"><div className="card-title">Bradata AI</div><span className="chip primary"><I.sparkle size={10}/>DeepSeek</span></div>
          <div className="card-p">
            <div className="setting-row"><div><strong>Classificação automática</strong><div className="muted" style={{fontSize:11.5}}>É contrato de bodyshop?</div></div><Toggle on={true}/></div>
            <div className="setting-row"><div><strong>Enriquecimento de contato</strong><div className="muted" style={{fontSize:11.5}}>Website + LinkedIn</div></div><Toggle on={false}/></div>
            <div className="setting-row" style={{borderBottom:'none'}}><div><strong>Resumo de leads</strong><div className="muted" style={{fontSize:11.5}}>Briefing antes de calls</div></div><Toggle on={true}/></div>
          </div>
        </div>
      </div>
    </>
  );
}

function GoogleConnectCard() {
  const [status, setStatus] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState(null);

  const refresh = React.useCallback(() => {
    setLoading(true);
    window.API.api('/auth/google/status')
      .then(s => { setStatus(s); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);
  React.useEffect(refresh, [refresh]);

  React.useEffect(() => {
    const onMsg = (e) => {
      if (e.data && e.data.type === 'google-oauth') {
        setBusy(false);
        setMsg(e.data.ok ? { tone:'success', text:'Conectado!' } : { tone:'danger', text:'Falha na conexão' });
        refresh();
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [refresh]);

  const conectar = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await window.API.api('/auth/google/connect');
      window.open(r.url, 'google-oauth', 'width=540,height=680');
    } catch (e) {
      setBusy(false);
      setMsg({ tone:'danger', text: e.message });
    }
  };

  const desconectar = async () => {
    if (!confirm('Desconectar conta Google? E-mails voltarão a sair pelo SMTP global.')) return;
    setBusy(true);
    try {
      await window.API.api('/auth/google/disconnect', { method:'POST' });
      setMsg({ tone:'success', text:'Desconectado.' });
      refresh();
    } catch (e) {
      setMsg({ tone:'danger', text: e.message });
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="card"><div className="card-p"><div className="muted">Carregando…</div></div></div>;

  const connected = status?.connected;
  const configured = status?.configured;

  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title">Conta Google · envio de e-mail</div>
        {connected
          ? <span className="chip success"><I.check size={10}/>Conectado</span>
          : <span className="chip warn">Não conectado</span>}
      </div>
      <div className="card-p" style={{display:'flex', flexDirection:'column', gap:14}}>
        <div className="muted" style={{fontSize:13, lineHeight:1.5}}>
          Quando você conecta sua conta Google, todos os e-mails que <strong>você</strong> enviar pelo CRM saem com seu endereço, e as <strong>respostas chegam direto no seu Gmail</strong>. Sem isso, o sistema usa o e-mail noreply compartilhado.
        </div>

        {!configured && (
          <div style={{
            padding:'10px 14px', borderRadius:8, fontSize:12.5,
            background:'hsl(var(--warning-soft))', color:'hsl(var(--warning))',
            border:'1px solid hsl(var(--warning) / .25)',
          }}>
            ⚠️ Servidor sem credenciais OAuth configuradas. O admin precisa preencher <code>GOOGLE_CLIENT_ID</code> e <code>GOOGLE_CLIENT_SECRET</code> no <code>.env</code>.
          </div>
        )}

        {connected && (
          <div className="setting-row" style={{borderBottom:'none', padding:'10px 0'}}>
            <div>
              <strong>{status.email}</strong>
              <div className="muted" style={{fontSize:11.5}}>
                Conectado em {status.connected_at ? new Date(status.connected_at).toLocaleString('pt-BR') : '—'}
              </div>
            </div>
            <button className="btn btn-xs btn-ghost" onClick={desconectar} disabled={busy}>Desconectar</button>
          </div>
        )}

        {!connected && configured && (
          <button className="btn btn-accent" onClick={conectar} disabled={busy} style={{alignSelf:'flex-start'}}>
            <I.mail size={14}/>{busy ? 'Aguardando…' : 'Conectar com Google'}
          </button>
        )}

        {msg && (
          <div style={{
            padding:'10px 12px', borderRadius:8, fontSize:12.5,
            background: msg.tone==='success'?'hsl(var(--success-soft))':'hsl(var(--danger-soft))',
            color: msg.tone==='success'?'hsl(var(--success))':'hsl(var(--danger))',
          }}>{msg.text}</div>
        )}
      </div>
    </div>
  );
}

function Toggle({ on: initial }) {
  const [on, setOn] = React.useState(initial);
  return (
    <button onClick={()=>setOn(!on)} style={{
      width:40, height:22, borderRadius:99, padding:2,
      background: on ? 'hsl(var(--b-accent))' : 'hsl(var(--surface-3))',
      border:0, cursor:'pointer', transition:'.2s', display:'flex', alignItems:'center'
    }}>
      <span style={{width:18, height:18, borderRadius:'50%', background:'white', marginLeft: on ? 18 : 0, transition:'.2s', boxShadow:'0 2px 4px rgba(0,0,0,.15)'}}/>
    </button>
  );
}
window.Settings = Settings;
