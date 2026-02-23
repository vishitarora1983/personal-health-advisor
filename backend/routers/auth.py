"""
Authentication router.

Handles user signup, login (email/password and Google OAuth), the /me endpoint,
and logout.

Security hardening applied here:
  - Rate limiting via slowapi: 3/min on signup, 5/min on login, 5/min on Google
    to slow brute-force and credential-stuffing attacks.
  - HttpOnly cookie (fedright_token): issued by the server so JavaScript cannot
    read or steal the token via XSS. The cookie is Secure in HTTPS environments
    and SameSite=Strict to mitigate CSRF.
  - The access token is ALSO returned in the JSON body so the frontend SPA can
    store it in localStorage for the axios Authorization header (keeping existing
    behavior while adding the HttpOnly cookie as a defense-in-depth layer).
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from database import get_db
from models.user import User
from schemas.auth import (
    SignupRequest, LoginRequest, GoogleLoginRequest,
    TokenResponse, UserResponse,
)
from auth import (
    hash_password, verify_password, create_access_token,
    get_current_user,
)
from config import settings

# ---------------------------------------------------------------------------
# Rate limiter
# ---------------------------------------------------------------------------
# Key function: identify clients by their real IP address.
# The limiter instance is created here; it is registered on the FastAPI app
# in main.py via app.state.limiter and the _rate_limit_exceeded_handler.
limiter = Limiter(key_func=get_remote_address)

# Cookie name used by the backend; must match the name expected by the
# Next.js edge middleware (AUTH_COOKIE_KEY in middleware.ts).
_AUTH_COOKIE_NAME = "fedright_token"

# Cookie lifetime — keep in sync with JWT_ACCESS_TOKEN_EXPIRE_MINUTES (7 days).
_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 3600

router = APIRouter(prefix="/auth", tags=["Auth"])


def _build_token_response(request: Request, token: str) -> JSONResponse:
    """
    Build a JSONResponse that both:
      1. Returns the token in the JSON body (for the SPA Authorization header).
      2. Sets an HttpOnly, SameSite=Strict cookie so the token is not accessible
         to JavaScript in a potential XSS scenario.

    The `secure` flag is set only when the request arrived over HTTPS so that
    local development (HTTP) continues to work without extra config.
    """
    response = JSONResponse(
        content={"access_token": token, "token_type": "bearer"},
        status_code=200,
    )
    response.set_cookie(
        key=_AUTH_COOKIE_NAME,
        value=token,
        httponly=True,                                    # Not accessible via JS
        secure=request.url.scheme == "https",             # HTTPS-only in prod
        samesite="strict",                                # Blocks cross-site use
        max_age=_COOKIE_MAX_AGE_SECONDS,
        path="/",
    )
    return response


# ---------------------------------------------------------------------------
# Signup
# ---------------------------------------------------------------------------

@router.post("/signup", status_code=status.HTTP_201_CREATED)
@limiter.limit("3/minute")
def signup(request: Request, data: SignupRequest, db: Session = Depends(get_db)):
    """
    Register a new user.

    Rate-limited to 3 requests/minute per IP to prevent mass account creation.
    Returns a JWT both in the JSON body and as an HttpOnly cookie.
    """
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user = User(
        email=data.email,
        hashed_password=hash_password(data.password),
        display_name=data.display_name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id, user.email)
    # Build a 201 response manually since we override the status code above
    response = _build_token_response(request, token)
    response.status_code = status.HTTP_201_CREATED
    return response


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------

@router.post("/login")
@limiter.limit("5/minute")
def login(request: Request, data: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate an existing user with email and password.

    Rate-limited to 5 requests/minute per IP to slow brute-force attacks.
    Returns a JWT both in the JSON body and as an HttpOnly cookie.

    Note: both "user not found" and "wrong password" return the same generic
    error message to avoid user enumeration.
    """
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )
    if not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    token = create_access_token(user.id, user.email)
    return _build_token_response(request, token)


# ---------------------------------------------------------------------------
# Google OAuth
# ---------------------------------------------------------------------------

@router.post("/google")
@limiter.limit("5/minute")
def google_login(request: Request, data: GoogleLoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate via Google ID token (OAuth 2.0).

    Rate-limited to 5 requests/minute per IP.
    Returns a JWT both in the JSON body and as an HttpOnly cookie.
    """
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Google login not configured",
        )

    from google.oauth2 import id_token as google_id_token
    from google.auth.transport import requests as google_requests

    try:
        idinfo = google_id_token.verify_oauth2_token(
            data.id_token,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google token",
        )

    google_sub = idinfo["sub"]
    email = idinfo["email"]
    name = idinfo.get("name", email.split("@")[0])

    # Look up by google_sub first, then by email
    user = db.query(User).filter(User.google_sub == google_sub).first()
    if not user:
        user = db.query(User).filter(User.email == email).first()
        if user:
            # Link Google account to existing email-based user
            user.google_sub = google_sub
        else:
            # First-time Google user — create account
            user = User(email=email, display_name=name, google_sub=google_sub)
            db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id, user.email)
    return _build_token_response(request, token)


# ---------------------------------------------------------------------------
# Logout
# ---------------------------------------------------------------------------

@router.post("/logout")
def logout():
    """
    Server-side logout: clear the HttpOnly auth cookie.

    The frontend should also remove the token from localStorage on its side.
    This endpoint is fire-and-forget; it always returns 200 regardless of
    whether the user was authenticated, to avoid information leakage.
    """
    response = JSONResponse(content={"message": "Logged out"})
    # Delete the cookie by setting Max-Age=0 so the browser expires it immediately
    response.delete_cookie(key=_AUTH_COOKIE_NAME, path="/")
    return response


# ---------------------------------------------------------------------------
# Current user
# ---------------------------------------------------------------------------

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Return the currently authenticated user's profile."""
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        display_name=current_user.display_name,
        has_password=current_user.hashed_password is not None,
        has_google=current_user.google_sub is not None,
    )
