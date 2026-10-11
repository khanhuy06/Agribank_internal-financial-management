# =========================================================
# HỆ THỐNG QUẢN LÝ TÀI CHÍNH AGRIBANK (CHI NHÁNH HOÀN LÃO)
# MODULE CONFIG - QUẢN LÝ BIẾN MÔI TRƯỜNG & THIẾT LẬP
# =========================================================

import os
import sys

# Đảm bảo in tiếng Việt UTF-8
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

class Settings:
    # 1. Cấu hình bảo mật JWT Token
    SECRET_KEY: str = os.environ.get("SECRET_KEY", "agribank_jwt_security_secret_key_2026_hoanlao_vietnam")
    ALGORITHM: str = os.environ.get("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", 1440))  # 24 giờ

    # 2. Cấu hình Database: PostgreSQL > Turso > SQLite
    DATABASE_URL: str = os.environ.get("DATABASE_URL", "").strip()
    TURSO_DATABASE_URL: str = os.environ.get("TURSO_DATABASE_URL", "").strip()
    TURSO_AUTH_TOKEN: str = os.environ.get("TURSO_AUTH_TOKEN", "").strip()

    # 3. Máy chủ
    PORT: int = int(os.environ.get("PORT", 8000))
    HOST: str = os.environ.get("HOST", "0.0.0.0")

    # 4. Tài khoản SuperAdmin ban đầu khi bàn giao
    SUPERADMIN_EMAIL: str = os.environ.get("SUPERADMIN_EMAIL", "admin@agribank.com.vn")
    SUPERADMIN_PASSWORD: str = os.environ.get("SUPERADMIN_PASSWORD", "Agribank@2026")
    SUPERADMIN_NAME: str = "Quản Trị Viên Agribank"

    # 5. Cấu hình Email: Hỗ trợ Resend (mã bắt đầu bằng re_...) hoặc SMTP (Gmail)
    RESEND_API_KEY: str = os.environ.get("RESEND_API_KEY", "").strip()
    SMTP_HOST: str = os.environ.get("SMTP_HOST", "")
    SMTP_PORT: int = int(os.environ.get("SMTP_PORT", 587))
    SMTP_USER: str = os.environ.get("SMTP_USER", "")
    SMTP_PASSWORD: str = os.environ.get("SMTP_PASSWORD", "")
    EMAILS_FROM: str = os.environ.get("EMAILS_FROM", "Agribank Hoàn Lão <no-reply@agribank.com.vn>")

settings = Settings()
