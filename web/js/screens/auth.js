// Tela de login — mostrada quando não há JWT no localStorage.
function LoginScreen({ onLoggedIn }) {
  const [email, setEmail] = React.useState('');
  const [senha, setSenha] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState(null);

  const submit = async (e) => {
    if (e) e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const user = await window.API.login(email.trim(), senha);
      await window.API.refresh();
      onLoggedIn(user);
    } catch (e) {
      setErr(e.message || 'Erro ao autenticar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      background: 'linear-gradient(135deg, hsl(var(--b-primary)) 0%, hsl(var(--b-primary-600)) 100%)',
      padding: 20,
    }}>
      <form onSubmit={submit} style={{
        width: 'min(420px, 100%)',
        background: 'hsl(var(--surface))',
        borderRadius: 16,
        padding: 32,
        boxShadow: '0 24px 60px -10px rgba(0,0,0,.4)',
      }}>
        <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:24}}>
          <div style={{
            width: 44, height: 44, borderRadius: 11,
            background: 'linear-gradient(135deg, hsl(var(--b-accent)), hsl(var(--b-accent-light)))',
            display: 'grid', placeItems: 'center', color: 'white',
            boxShadow: '0 6px 14px -4px hsl(var(--b-accent) / .5)',
          }}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/>
            </svg>
          </div>
          <div>
            <div style={{fontSize:20, fontWeight:800, letterSpacing:'-.015em'}}>Bradata CRM</div>
            <div style={{fontSize:12, color:'hsl(var(--fg-muted))'}}>Prospecção governamental · Bodyshop</div>
          </div>
        </div>

        <h1 style={{margin:'0 0 4px', fontSize:20, fontWeight:700, letterSpacing:'-.01em'}}>Entrar</h1>
        <p style={{margin:'0 0 20px', fontSize:13, color:'hsl(var(--fg-muted))'}}>Use sua conta corporativa.</p>

        <div style={{marginBottom:14}}>
          <div className="form-label" style={{fontSize:11, fontWeight:600, color:'hsl(var(--fg-muted))', marginBottom:6, textTransform:'uppercase', letterSpacing:'.04em'}}>E-mail</div>
          <input
            className="input"
            type="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="voce@bradata.com.br"
            required
            style={{width:'100%', padding:'10px 12px', border:'1px solid hsl(var(--border))', borderRadius:8, background:'hsl(var(--surface-1, var(--surface)))', color:'hsl(var(--fg))', fontSize:14, outline:'none'}}
          />
        </div>

        <div style={{marginBottom:16}}>
          <div className="form-label" style={{fontSize:11, fontWeight:600, color:'hsl(var(--fg-muted))', marginBottom:6, textTransform:'uppercase', letterSpacing:'.04em'}}>Senha</div>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={senha}
            onChange={e => setSenha(e.target.value)}
            required
            style={{width:'100%', padding:'10px 12px', border:'1px solid hsl(var(--border))', borderRadius:8, background:'hsl(var(--surface-1, var(--surface)))', color:'hsl(var(--fg))', fontSize:14, outline:'none'}}
          />
        </div>

        {err && (
          <div style={{padding:'8px 12px', background:'hsl(var(--danger-soft))', color:'hsl(var(--danger))', borderRadius:8, fontSize:12.5, marginBottom:14, border:'1px solid hsl(var(--danger) / .2)'}}>
            {err}
          </div>
        )}

        <button
          type="submit"
          className="btn btn-accent"
          disabled={loading || !email || !senha}
          style={{width:'100%', height:42, fontSize:14, justifyContent:'center', opacity: loading?.7:1}}
        >
          {loading ? 'Autenticando…' : 'Entrar'}
        </button>

        <div style={{marginTop:16, fontSize:11.5, color:'hsl(var(--fg-faint))', textAlign:'center'}}>
          Esqueceu a senha? Peça ao admin para reenviar o convite.
        </div>
      </form>
    </div>
  );
}

window.LoginScreen = LoginScreen;
