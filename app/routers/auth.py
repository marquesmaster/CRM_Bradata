from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from app.core.deps import DBSession
from app.core.security import create_access_token, verify_password
from app.models.user import User
from app.schemas.user import LoginRequest, Token, UserOut

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
