// Tela de login — split-screen com modos: senha / primeiro acesso (3 passos) / Google
function LoginScreen({ onLoggedIn }) {
  const [mode, setMode] = React.useState('password');  // 'password' | 'first_access'
  const [busy, setBusy] = React.useState(false);

  // Recebe postMessage do popup do Google signin
  React.useEffect(() => {
    const onMsg = (e) => {
      if (e.data?.type !== 'google-signin') return;
      if (e.data.token) {
        localStorage.setItem('bradata-crm-token', e.data.token);
        // Pega user info via /users/me e dispara onLoggedIn
        window.API.api('/users/me').then(user => {
          window.API.auth.setSession(e.data.token, user);
          window.API.refresh().then(() => onLoggedIn(user));
        });
      } else if (e.data.error) {
        alert(e.data.error);
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [onLoggedIn]);

  const loginGoogle = async () => {
    setBusy(true);
    try {
      const { url } = await window.API.api('/auth/google/signin');
      window.open(url, 'google-signin', 'width=540,height=680');
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(false);
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
        {mode === 'password' && (
          <PasswordLoginForm
            onLoggedIn={onLoggedIn}
            onFirstAccess={()=>setMode('first_access')}
            onGoogle={loginGoogle}
            googleBusy={busy}
          />
        )}
        {mode === 'first_access' && (
          <FirstAccessForm
            onLoggedIn={onLoggedIn}
            onCancel={()=>setMode('password')}
            onGoogle={loginGoogle}
            googleBusy={busy}
          />
        )}
      </main>
    </div>
  );
}

function PasswordLoginForm({ onLoggedIn, onFirstAccess, onGoogle, googleBusy }) {
  const [email, setEmail] = React.useState('');
  const [senha, setSenha] = React.useState('');
  const [showPwd, setShowPwd] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState(null);

  const submit = async (e) => {
    e.preventDefault();
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
    <form onSubmit={submit} className="login-form">
      <BrandMobileMark/>
      <div className="login-form-head">
        <h2>Bem-vindo de volta</h2>
        <p>Entre com sua conta corporativa para continuar.</p>
      </div>

      <label className="login-field">
        <span>E-mail</span>
        <div className="login-input-wrap">
          <I.mail size={16} className="login-input-icon"/>
          <input type="email" autoComplete="email" autoFocus value={email}
            onChange={e=>setEmail(e.target.value)} placeholder="voce@bradata.com.br" required/>
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
          <input type={showPwd ? 'text':'password'} autoComplete="current-password"
            value={senha} onChange={e=>setSenha(e.target.value)} required/>
        </div>
      </label>

      {err && <div className="login-error"><I.x size={14}/><span>{err}</span></div>}

      <button type="submit" className="login-submit" disabled={loading || !email || !senha}>
        {loading ? <><span className="login-spinner"/>Entrando…</> : <>Entrar <I.chevron size={14}/></>}
      </button>

      <div className="login-divider"><span>ou</span></div>

      <button type="button" className="login-google login-google-active" onClick={onGoogle} disabled={googleBusy}>
        <GoogleLogo/>
        <span>{googleBusy ? 'Aguardando…' : 'Continuar com Google'}</span>
      </button>

      <div className="login-form-footer">
        Primeiro acesso? <a href="#" onClick={e=>{e.preventDefault(); onFirstAccess();}}>Receber código por e-mail</a>
      </div>
    </form>
  );
}

function FirstAccessForm({ onLoggedIn, onCancel, onGoogle, googleBusy }) {
  const [step, setStep] = React.useState(1);  // 1: email | 2: code | 3: senha
  const [email, setEmail] = React.useState('');
  const [code, setCode] = React.useState('');
  const [senha, setSenha] = React.useState('');
  const [senha2, setSenha2] = React.useState('');
  const [showPwd, setShowPwd] = React.useState(false);
  const [tempToken, setTempToken] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const [info, setInfo] = React.useState(null);

  // Cooldown de reenvio (60s)
  const [resendIn, setResendIn] = React.useState(0);
  React.useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const requestCode = async () => {
    setErr(null);
    setLoading(true);
    try {
      const r = await window.API.api('/auth/first-access/request', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      setInfo(r.message);
      setStep(2);
      setResendIn(60);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    setErr(null);
    setLoading(true);
    try {
      const r = await window.API.api('/auth/first-access/verify', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim() }),
      });
      setTempToken(r.first_access_token);
      setStep(3);
      setInfo(`Olá, ${r.user.nome.split(' ')[0]}! Defina sua senha pra continuar.`);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const setPassword = async () => {
    setErr(null);
    if (senha.length < 8) { setErr('Senha precisa ter ao menos 8 caracteres'); return; }
    if (senha !== senha2) { setErr('Senhas não coincidem'); return; }
    setLoading(true);
    try {
      const r = await fetch('/api/v1/auth/first-access/set-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tempToken}`,
        },
        body: JSON.stringify({ senha }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || 'Erro');
      window.API.auth.setSession(data.access_token, data.user);
      await window.API.refresh();
      onLoggedIn(data.user);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-form">
      <BrandMobileMark/>

      <div className="login-form-head">
        <button type="button" onClick={onCancel} className="login-back" title="Voltar">
          <I.chevron size={12} style={{transform:'rotate(180deg)'}}/> Voltar
        </button>
        <h2>Primeiro acesso</h2>
        <p>
          {step === 1 && 'Enviaremos um código de 6 dígitos pro e-mail cadastrado pelo seu admin.'}
          {step === 2 && `Digite o código que enviamos para ${email}.`}
          {step === 3 && 'Defina uma senha forte (mínimo 8 caracteres).'}
        </p>
      </div>

      <FirstAccessSteps current={step}/>

      {step === 1 && (
        <>
          <label className="login-field">
            <span>E-mail corporativo</span>
            <div className="login-input-wrap">
              <I.mail size={16} className="login-input-icon"/>
              <input type="email" autoFocus value={email} onChange={e=>setEmail(e.target.value)}
                placeholder="voce@bradata.com.br" required/>
            </div>
          </label>
          {err && <div className="login-error"><I.x size={14}/><span>{err}</span></div>}
          <button onClick={requestCode} className="login-submit" disabled={loading || !email}>
            {loading ? <><span className="login-spinner"/>Enviando…</> : <>Enviar código <I.chevron size={14}/></>}
          </button>
          <div className="login-divider"><span>ou</span></div>
          <button type="button" className="login-google login-google-active" onClick={onGoogle} disabled={googleBusy}>
            <GoogleLogo/>
            <span>{googleBusy ? 'Aguardando…' : 'Entrar com Google'}</span>
          </button>
        </>
      )}

      {step === 2 && (
        <>
          {info && <div className="login-info"><I.check size={14}/><span>{info}</span></div>}
          <label className="login-field">
            <span>Código de 6 dígitos</span>
            <div className="login-input-wrap">
              <I.lock size={16} className="login-input-icon"/>
              <input type="text" inputMode="numeric" maxLength={6} autoFocus
                value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))}
                placeholder="000000" style={{letterSpacing:'.5em', fontSize:18, fontWeight:700, fontFamily:'JetBrains Mono, monospace'}} required/>
            </div>
          </label>
          {err && <div className="login-error"><I.x size={14}/><span>{err}</span></div>}
          <button onClick={verifyCode} className="login-submit" disabled={loading || code.length !== 6}>
            {loading ? <><span className="login-spinner"/>Verificando…</> : <>Verificar <I.chevron size={14}/></>}
          </button>
          <div className="login-form-footer">
            Não recebeu? {resendIn > 0
              ? <span className="muted">Reenviar em {resendIn}s</span>
              : <a href="#" onClick={e=>{e.preventDefault(); requestCode();}}>Reenviar código</a>}
          </div>
        </>
      )}

      {step === 3 && (
        <>
          {info && <div className="login-info"><I.check size={14}/><span>{info}</span></div>}
          <label className="login-field">
            <span>
              Nova senha
              <button type="button" className="login-eye" onClick={()=>setShowPwd(!showPwd)} tabIndex={-1}>
                {showPwd ? 'ocultar' : 'mostrar'}
              </button>
            </span>
            <div className="login-input-wrap">
              <I.lock size={16} className="login-input-icon"/>
              <input type={showPwd?'text':'password'} autoFocus value={senha}
                onChange={e=>setSenha(e.target.value)} placeholder="mínimo 8 caracteres" required/>
            </div>
          </label>
          <label className="login-field">
            <span>Confirmar senha</span>
            <div className="login-input-wrap">
              <I.lock size={16} className="login-input-icon"/>
              <input type={showPwd?'text':'password'} value={senha2}
                onChange={e=>setSenha2(e.target.value)} required/>
            </div>
          </label>
          {err && <div className="login-error"><I.x size={14}/><span>{err}</span></div>}
          <button onClick={setPassword} className="login-submit"
            disabled={loading || senha.length < 8 || senha !== senha2}>
            {loading ? <><span className="login-spinner"/>Salvando…</> : <>Definir senha e entrar <I.chevron size={14}/></>}
          </button>
        </>
      )}
    </div>
  );
}

function FirstAccessSteps({ current }) {
  return (
    <div className="login-steps">
      {[1,2,3].map(n => (
        <div key={n} className={`login-step ${current >= n ? 'done' : ''} ${current === n ? 'current' : ''}`}>
          <span>{n}</span>
          <em>{n===1?'Email':n===2?'Código':'Senha'}</em>
        </div>
      ))}
    </div>
  );
}

function BrandMobileMark() {
  return (
    <div className="login-form-mobile-brand">
      <div className="login-brand-mark">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/>
        </svg>
      </div>
      <strong>Bradata CRM</strong>
    </div>
  );
}

function GoogleLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

window.LoginScreen = LoginScreen;
