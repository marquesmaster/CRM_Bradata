from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm

from app.core.deps import CurrentUser, DBSession
from app.core.security import create_access_token, decode_access_token, verify_password
from app.models.user import User
from app.schemas.user import LoginRequest, Token, UserOut
from app.services import google_oauth as gauth

router = APIRouter()


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
