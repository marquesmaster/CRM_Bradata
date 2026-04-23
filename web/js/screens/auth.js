// Tela de login — split-screen com hero animado à esquerda e form à direita.
function LoginScreen({ onLoggedIn }) {
  const [email, setEmail] = React.useState('');
  const [senha, setSenha] = React.useState('');
  const [showPwd, setShowPwd] = React.useState(false);
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
    <div className="login-shell">
      <aside className="login-hero">
        <div className="login-hero-bg"/>
        <div className="login-hero-orb orb1"/>
        <div className="login-hero-orb orb2"/>
        <div className="login-hero-grid"/>

        <div className="login-hero-content">
          <div className="login-brand">
            <div className="login-brand-mark">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/>
              </svg>
            </div>
            <div>
              <div className="login-brand-name">Bradata</div>
              <div className="login-brand-sub">CRM Inteligência Comercial</div>
            </div>
          </div>

          <div className="login-headline">
            <h1>
              Cada contrato público<br/>
              é um <span className="login-accent">lead potencial.</span>
            </h1>
            <p>Descubra empresas integradoras de TI ganhando contratos no PNCP, enriqueça com IA e abra portas com decisores reais — tudo em um só lugar.</p>
          </div>

          <div className="login-stats">
            <div className="login-stat">
              <div className="login-stat-num">+2.000</div>
              <div className="login-stat-label">contratos PNCP analisados</div>
            </div>
            <div className="login-stat">
              <div className="login-stat-num">DeepSeek + Lusha</div>
              <div className="login-stat-label">IA + enriquecimento de contatos</div>
            </div>
            <div className="login-stat">
              <div className="login-stat-num">100% Bradata</div>
              <div className="login-stat-label">construído para bodyshop</div>
            </div>
          </div>

          <div className="login-footer">
            <span>© {new Date().getFullYear()} Bradata · Todos os direitos reservados</span>
          </div>
        </div>
      </aside>

      <main className="login-form-wrap">
        <form onSubmit={submit} className="login-form">
          <div className="login-form-mobile-brand">
            <div className="login-brand-mark">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/>
              </svg>
            </div>
            <strong>Bradata CRM</strong>
          </div>

          <div className="login-form-head">
            <h2>Bem-vindo de volta</h2>
            <p>Entre com sua conta corporativa para continuar.</p>
          </div>

          <label className="login-field">
            <span>E-mail</span>
            <div className="login-input-wrap">
              <I.mail size={16} className="login-input-icon"/>
              <input
                type="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="voce@bradata.com.br"
                required
              />
            </div>
          </label>

          <label className="login-field">
            <span>
              Senha
              <button type="button" className="login-eye" onClick={()=>setShowPwd(!showPwd)} tabIndex={-1}>
                {showPwd ? 'ocultar' : 'mostrar'}
              </button>
            </span>
            <div className="login-input-wrap">
              <I.lock size={16} className="login-input-icon"/>
              <input
                type={showPwd ? 'text' : 'password'}
                autoComplete="current-password"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                required
              />
            </div>
          </label>

          {err && (
            <div className="login-error">
              <I.x size={14}/>
              <span>{err}</span>
            </div>
          )}

          <button type="submit" className="login-submit" disabled={loading || !email || !senha}>
            {loading ? <><span className="login-spinner"/>Entrando…</> : <>Entrar <I.chevron size={14}/></>}
          </button>

          <div className="login-divider"><span>ou</span></div>

          <a href="https://accounts.google.com" target="_blank" rel="noreferrer" className="login-google" onClick={e => e.preventDefault()} title="Em breve — login federado">
            <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            <span>Continuar com Google</span>
            <span className="login-google-soon">em breve</span>
          </a>

          <div className="login-form-footer">
            Esqueceu a senha? <a href="#" onClick={e=>{e.preventDefault(); alert('Peça ao admin para reenviar o convite.');}}>Recuperar acesso</a>
          </div>
        </form>
      </main>
    </div>
  );
}

window.LoginScreen = LoginScreen;
