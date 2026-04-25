from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr

from app.core.deps import CurrentUser, DBSession
from app.core.security import create_access_token, decode_access_token, hash_password, verify_password
from app.models.user import User, UserStatus
from app.models.verification_code import VerificationKind
from app.schemas.user import LoginRequest, Token, UserOut
from app.services import first_access as fa
from app.services import google_oauth as gauth

router = APIRouter()


class FirstAccessRequest(BaseModel):
    email: EmailStr


class FirstAccessVerify(BaseModel):
    email: EmailStr
    code: str


class FirstAccessSetPassword(BaseModel):
    senha: str


def _decode_first_access_token(token: str) -> int:
    payload = decode_access_token(token)
    if not payload or not payload.get("first_access"):
        raise HTTPException(status_code=401, detail="Token de primeiro acesso inválido")
    try:
        return int(payload["sub"])
    except (KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Token inválido")


def _authenticate(db, email: str, senha: str) -> User:
    user = db.query(User).filter(User.email == email.lower()).first()
    if not user or not verify_password(senha, user.senha_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email ou senha inválidos")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuário desativado")
    return user


@router.post("/login", response_model=Token)
def login(db: DBSession, form: OAuth2PasswordRequestForm = Depends()):
    user = _authenticate(db, form.username, form.password)
    token = create_access_token(user.id, {"role": user.role.value})
    return Token(access_token=token, user=UserOut.model_validate(user))


@router.post("/login-json", response_model=Token)
def login_json(payload: LoginRequest, db: DBSession):
    user = _authenticate(db, payload.email, payload.senha)
    token = create_access_token(user.id, {"role": user.role.value})
    return Token(access_token=token, user=UserOut.model_validate(user))


# ---------------- Primeiro acesso (código por e-mail) ----------------

@router.post("/first-access/request")
def first_access_request(payload: FirstAccessRequest, db: DBSession):
    """Envia código de 6 dígitos pro e-mail. Anti-enumeração: sempre retorna ok."""
    fa.request_code(db, str(payload.email), VerificationKind.first_access)
    return {"ok": True, "message": "Se este e-mail estiver cadastrado, você receberá um código em instantes."}


@router.post("/first-access/verify")
def first_access_verify(payload: FirstAccessVerify, db: DBSession):
    """Valida código. Retorna JWT temporário pra setar senha."""
    try:
        user = fa.verify_code(db, str(payload.email), payload.code, VerificationKind.first_access)
    except fa.FirstAccessError as e:
        raise HTTPException(status_code=400, detail=str(e))
    # Token curto (10 min) com claim first_access:true — não loga no sistema, só permite definir senha
    token = create_access_token(user.id, {"first_access": True}, expires_minutes=10)
    return {"first_access_token": token, "user": {"id": user.id, "email": user.email, "nome": user.nome}}


@router.post("/first-access/set-password", response_model=Token)
def first_access_set_password(
    payload: FirstAccessSetPassword,
    db: DBSession,
    authorization: str = Depends(OAuth2PasswordBearer(tokenUrl="/api/v1/auth/first-access/verify")),
):
    """Define a senha + ativa o user + retorna JWT normal de login."""
    if len(payload.senha) < 8:
        raise HTTPException(status_code=400, detail="Senha precisa ter ao menos 8 caracteres")
    user_id = _decode_first_access_token(authorization)
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    user.senha_hash = hash_password(payload.senha)
    user.status = UserStatus.ativo
    user.is_active = True
    user.last_seen_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id, {"role": user.role.value})
    return Token(access_token=token, user=UserOut.model_validate(user))


# ---------------- Google Sign-In (login via Google) ----------------

@router.get("/google/signin")
def google_signin():
    """URL pra fazer login com Google (não só conectar Gmail).
    Diferença: state vazio (público), só pega identidade no callback."""
    if not gauth.is_configured():
        raise HTTPException(
            status_code=503,
            detail="Login com Google indisponível (servidor não configurou OAuth)",
        )
    # state = marker pra distinguir signin vs connect
    state = create_access_token(0, {"google_signin": True}, expires_minutes=10)
    return {"url": gauth.authorize_url(state)}


@router.get("/google/signin-callback")
def google_signin_callback(
    db: DBSession,
    code: str = Query(...),
    state: str = Query(...),
    error: str | None = Query(None),
):
    """Recebe code do Google, descobre email, loga se user existir no DB."""
    if error:
        return _close_signin(error_msg=f"Cancelado: {error}")
    payload = decode_access_token(state)
    if not payload or not payload.get("google_signin"):
        return _close_signin(error_msg="State inválido ou expirado")

    try:
        token_payload = gauth.exchange_code(code)
        access = token_payload.get("access_token")
        info = gauth.fetch_userinfo(access) if access else {}
    except gauth.GoogleOAuthError as e:
        return _close_signin(error_msg=str(e))

    google_email = (info.get("email") or "").lower()
    if not google_email or not info.get("email_verified", True):
        return _close_signin(error_msg="Não foi possível obter um e-mail verificado do Google")

    user = db.query(User).filter(User.email == google_email).first()
    if not user:
        return _close_signin(error_msg=f"Usuário {google_email} não cadastrado. Peça acesso ao admin.")
    if not user.is_active:
        # Ativa automaticamente já que o Google verificou o e-mail
        user.is_active = True
        user.status = UserStatus.ativo

    # Salva também os tokens pra envio Gmail (já que o user passou pelo consent)
    if not user.google_email:
        gauth.save_tokens(user, token_payload, google_email=google_email)

    user.last_seen_at = datetime.now(timezone.utc)
    db.commit()

    jwt_token = create_access_token(user.id, {"role": user.role.value})
    return _close_signin(jwt=jwt_token)


def _close_signin(jwt: str | None = None, error_msg: str | None = None) -> HTMLResponse:
    """Página HTML mínima que postMessage o JWT pra janela pai e fecha."""
    if jwt:
        body = f"""
        <div class="icon" style="color:#16a34a">✓</div>
        <div class="msg">Login efetuado. Redirecionando…</div>
        <script>
          if (window.opener) {{
            window.opener.postMessage({{type:'google-signin', token:{jwt!r}}}, '*');
            setTimeout(()=>window.close(), 800);
          }} else {{
            localStorage.setItem('bradata-crm-token', {jwt!r});
            location.href = '/';
          }}
        </script>"""
    else:
        body = f"""
        <div class="icon" style="color:#dc2626">✗</div>
        <div class="msg">{error_msg or 'Erro desconhecido'}</div>
        <button onclick="window.close()">Fechar</button>
        <script>
          if (window.opener) {{
            window.opener.postMessage({{type:'google-signin', error:{(error_msg or '')!r}}}, '*');
          }}
        </script>"""
    return HTMLResponse(f"""<!doctype html><meta charset="utf-8"><title>Login Google</title>
<style>
body{{font:16px system-ui;background:#0a1530;color:#eee;display:grid;place-items:center;height:100vh;margin:0}}
.card{{background:#0f1d3d;padding:32px 40px;border-radius:14px;border:1px solid #1f3870;text-align:center;max-width:420px}}
.icon{{font-size:48px;line-height:1;margin-bottom:8px}}
.msg{{margin:8px 0 16px;font-size:14px;opacity:.85}}
button{{background:#fb923c;color:#0a1530;border:0;padding:10px 22px;border-radius:8px;font-weight:700;cursor:pointer}}
</style>
<div class="card">{body}</div>""")


# ---------------- Google OAuth (envio Gmail per-user) ----------------

@router.get("/google/connect")
def google_connect(current: CurrentUser):
    """Retorna a URL de consentimento do Google. O front faz window.location."""
    if not gauth.is_configured():
        raise HTTPException(
            status_code=503,
            detail="Google OAuth não configurado no servidor (GOOGLE_CLIENT_ID/SECRET ausentes)",
        )
    # state = JWT curto (10 min) só pra identificar o user no callback
    state = create_access_token(current.id, {"oauth": "google"})
    return {"url": gauth.authorize_url(state)}


@router.get("/google/callback")
def google_callback(
    db: DBSession,
    code: str = Query(...),
    state: str = Query(...),
    error: str | None = Query(None),
):
    """Recebe o code do Google, troca por tokens e fecha a aba."""
    if error:
        return _close_with_msg(f"Cancelado: {error}", ok=False)
    payload = decode_access_token(state)
    if not payload:
        return _close_with_msg("State inválido ou expirado", ok=False)
    user_id = int(payload.get("sub", 0))
    user = db.get(User, user_id)
    if not user:
        return _close_with_msg("Usuário não encontrado", ok=False)

    try:
        token_payload = gauth.exchange_code(code)
        access = token_payload.get("access_token")
        info = gauth.fetch_userinfo(access) if access else {}
        gauth.save_tokens(user, token_payload, google_email=info.get("email"))
        db.add(user)
        db.commit()
    except gauth.GoogleOAuthError as e:
        return _close_with_msg(str(e), ok=False)

    return _close_with_msg(f"Conectado como {user.google_email}", ok=True)


@router.get("/google/status")
def google_status(current: CurrentUser):
    return {
        "configured": gauth.is_configured(),
        "connected": bool(current.google_refresh_token),
        "email": current.google_email,
        "connected_at": current.google_connected_at,
        "expires_at": current.google_token_expiry,
    }


@router.post("/google/disconnect")
def google_disconnect(db: DBSession, current: CurrentUser):
    gauth.disconnect(current)
    db.add(current)
    db.commit()
    return {"ok": True}


def _close_with_msg(message: str, ok: bool) -> HTMLResponse:
    color = "#16a34a" if ok else "#dc2626"
    icon = "✓" if ok else "✗"
    html = f"""<!doctype html><meta charset="utf-8"><title>Google OAuth</title>
<style>
body{{font:16px system-ui;background:#0a1530;color:#eee;display:grid;place-items:center;height:100vh;margin:0}}
.card{{background:#0f1d3d;padding:32px 40px;border-radius:14px;border:1px solid #1f3870;text-align:center;max-width:420px}}
.icon{{font-size:48px;color:{color};line-height:1;margin-bottom:8px}}
.msg{{margin:8px 0 16px;font-size:14px;opacity:.85}}
button{{background:#fb923c;color:#0a1530;border:0;padding:10px 22px;border-radius:8px;font-weight:700;cursor:pointer}}
</style>
<div class="card">
  <div class="icon">{icon}</div>
  <div class="msg">{message}</div>
  <button onclick="window.close()">Fechar</button>
</div>
<script>
  if (window.opener) {{ try {{ window.opener.postMessage({{type:'google-oauth', ok: {str(ok).lower()}}}, '*'); }} catch(e){{}} setTimeout(()=>window.close(), 1500); }}
</script>"""
    return HTMLResponse(html)
