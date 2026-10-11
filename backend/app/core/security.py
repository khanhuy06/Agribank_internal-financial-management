# =========================================================
# HỆ THỐNG QUẢN LÝ TÀI CHÍNH AGRIBANK (CHI NHÁNH HOÀN LÃO)
# MODULE SECURITY - BẢO MẬT BCRYPT SALT & JWT AUTHENTICATION
# =========================================================

import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from fastapi import HTTPException, Security, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from backend.app.core.config import settings

security_bearer = HTTPBearer(auto_error=False)

def hash_password(password: str) -> str:
    """
    Băm mật khẩu bằng Bcrypt kết hợp Salt ngẫu nhiên 12 rounds.
    Mỗi lần băm sẽ tạo ra một chuỗi băm hoàn toàn khác nhau để chống Rainbow Table.
    """
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Kiểm tra mật khẩu người dùng nhập có khớp với chuỗi băm trong database hay không."""
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Tạo vé thông hành JWT có thời hạn sống."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Giải mã và kiểm tra tính hợp lệ của token."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except (jwt.PyJWTError, Exception):
        return None

def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Security(security_bearer)) -> Dict[str, Any]:
    """
    Dependency bắt buộc: Kiểm tra vé thông hành JWT.
    Bất kỳ ai cố tình dùng F12 xóa CSS mà không có Token hợp lệ sẽ bị đuổi ngay lập tức (401 Unauthorized).
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bạn chưa đăng nhập hoặc phiên làm việc đã hết hạn. Vui lòng đăng nhập lại!",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Vé thông hành (Token) không hợp lệ hoặc đã hết hạn!",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return payload

def require_admin(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Dependency kiểm tra quyền Quản trị viên (RBAC).
    Chỉ tài khoản có role='admin' mới được vượt qua. Nhân viên thường sẽ bị chặn (403 Forbidden).
    """
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền thực hiện hành động này. Chỉ Quản trị viên (Admin) mới có quyền!",
        )
    return current_user
