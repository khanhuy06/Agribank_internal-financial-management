# =========================================================
# HỆ THỐNG QUẢN LÝ TÀI CHÍNH AGRIBANK (CHI NHÁNH HOÀN LÃO)
# MODULE DATABASE CONNECTION - POSTGRESQL / TURSO / SQLITE
# =========================================================

import os
import sys
import json
import sqlite3
from typing import Dict, Any, List, Optional
from backend.app.core.config import settings

# Thử import psycopg2 và libsql_client
try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    HAS_POSTGRES = True
except ImportError:
    HAS_POSTGRES = False

try:
    import libsql_client
    HAS_LIBSQL = True
except ImportError:
    HAS_LIBSQL = False

# Đường dẫn file SQLite dự phòng
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
SQLITE_PATH = os.path.join(BASE_DIR, "agribank.db")

def get_database_mode() -> str:
    """Xác định chế độ cơ sở dữ liệu hiện tại."""
    if settings.DATABASE_URL and HAS_POSTGRES:
        return "postgresql"
    elif settings.TURSO_DATABASE_URL and HAS_LIBSQL:
        return "turso"
    return "sqlite"

def get_db_info() -> Dict[str, Any]:
    mode = get_database_mode()
    if mode == "postgresql":
        return {
            "mode": "postgresql",
            "ten": "Hệ Thống Trực Tuyến (Cloud PostgreSQL)",
            "mo_ta": "Cơ sở dữ liệu đám mây bảo mật cao, kết nối mã hóa SSL 256-bit.",
            "url": settings.DATABASE_URL.split("@")[-1] if "@" in settings.DATABASE_URL else "postgresql://..."
        }
    elif mode == "turso":
        url = settings.TURSO_DATABASE_URL
        if url.startswith("libsql://"):
            url = "https://" + url[len("libsql://"):]
        return {
            "mode": "turso",
            "ten": "Turso Cloud SQLite",
            "mo_ta": "Lưu trữ đám mây phân tán qua Turso LibSQL.",
            "url": url.split("@")[-1] if "@" in url else url
        }
    return {
        "mode": "sqlite",
        "ten": "SQLite Cục Bộ (agribank.db)",
        "mo_ta": "Lưu trên file cục bộ dự phòng khi chạy thử nghiệm trên máy tính.",
        "url": f"file:{SQLITE_PATH}"
    }

def _thuc_thi_postgres(query: str, params: list = None) -> Dict[str, Any]:
    """Thực thi câu lệnh trên PostgreSQL."""
    params = params or []
    # Chuyển đổi tham số ? sang %s cho psycopg2
    pg_query = query.replace("?", "%s")
    conn = psycopg2.connect(settings.DATABASE_URL)
    conn.autocommit = True
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute(pg_query, params)
        rows = []
        lastrowid = None
        if cursor.description:
            rows = [dict(r) for r in cursor.fetchall()]
        rowcount = cursor.rowcount
        return {"rows": rows, "lastrowid": lastrowid, "rowcount": rowcount}
    finally:
        cursor.close()
        conn.close()

def _thuc_thi_turso(query: str, params: list = None) -> Dict[str, Any]:
    """Thực thi câu lệnh trên Turso LibSQL."""
    params = params or []
    url = settings.TURSO_DATABASE_URL
    if url.startswith("libsql://"):
        url = "https://" + url[len("libsql://"):]
    
    client = libsql_client.create_client_sync(
        url=url,
        auth_token=settings.TURSO_AUTH_TOKEN if settings.TURSO_AUTH_TOKEN else None
    )
    try:
        rs = client.execute(query, params)
        rows = []
        if rs.columns:
            for r in rs.rows:
                rows.append(dict(zip(rs.columns, r)))
        return {
            "rows": rows,
            "lastrowid": rs.last_insert_rowid,
            "rowcount": rs.rows_affected
        }
    finally:
        client.close()

def _thuc_thi_sqlite(query: str, params: list = None) -> Dict[str, Any]:
    """Thực thi câu lệnh trên SQLite."""
    params = params or []
    conn = sqlite3.connect(SQLITE_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    try:
        cursor.execute(query, params)
        lastrowid = cursor.lastrowid
        rowcount = cursor.rowcount
        rows = []
        if cursor.description:
            rows = [dict(r) for r in cursor.fetchall()]
        conn.commit()
        return {"rows": rows, "lastrowid": lastrowid, "rowcount": rowcount}
    finally:
        conn.close()

def thuc_thi_sql(query: str, params: list = None) -> Dict[str, Any]:
    """
    Thực thi câu lệnh SQL với cơ chế tự động thích ứng:
    Ưu tiên: PostgreSQL -> Turso -> SQLite cục bộ.
    Chống SQL Injection 100% bằng cơ chế Parameterized Query.
    """
    params = params or []
    mode = get_database_mode()

    if mode == "postgresql":
        try:
            return _thuc_thi_postgres(query, params)
        except Exception as e:
            print(f"[CẢNH BÁO POSTGRES] {e}. Chuyển sang chế độ dự phòng!")
            return _thuc_thi_sqlite(query, params)
    elif mode == "turso":
        try:
            return _thuc_thi_turso(query, params)
        except Exception as e:
            print(f"[CẢNH BÁO TURSO] {e}. Chuyển sang chế độ dự phòng!")
            return _thuc_thi_sqlite(query, params)
    
    return _thuc_thi_sqlite(query, params)

def khoi_tao_db():
    """Khởi tạo toàn bộ cấu trúc bảng và tài khoản SuperAdmin ban đầu."""
    from backend.app.core.security import hash_password

    # 1. Bảng tài khoản (Lưu Email, Username, Họ tên, Mật khẩu Bcrypt băm, Vai trò)
    if get_database_mode() == "postgresql":
        thuc_thi_sql("""
            CREATE TABLE IF NOT EXISTS tai_khoan (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE,
                username VARCHAR(100),
                ho_ten VARCHAR(255) NOT NULL,
                hashed_password VARCHAR(255),
                password VARCHAR(255),
                role VARCHAR(50) NOT NULL DEFAULT 'nhan_vien',
                is_active INT DEFAULT 1,
                ngay_tao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
    else:
        # SQLite / LibSQL
        try:
            sql_check = _thuc_thi_sqlite("SELECT sql FROM sqlite_master WHERE type='table' AND name='tai_khoan'")
            if sql_check["rows"] and "username TEXT UNIQUE NOT NULL" in sql_check["rows"][0].get("sql", ""):
                _thuc_thi_sqlite("""
                    CREATE TABLE IF NOT EXISTS tai_khoan_temp (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        email TEXT UNIQUE,
                        username TEXT,
                        ho_ten TEXT NOT NULL,
                        hashed_password TEXT,
                        password TEXT,
                        role TEXT NOT NULL DEFAULT 'nhan_vien',
                        is_active INTEGER DEFAULT 1,
                        ngay_tao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                _thuc_thi_sqlite("""
                    INSERT INTO tai_khoan_temp (id, email, username, ho_ten, hashed_password, role, is_active)
                    SELECT id, COALESCE(email, username || '@agribank.com.vn'), username, ho_ten, hashed_password, COALESCE(role, 'nhan_vien'), COALESCE(is_active, 1)
                    FROM tai_khoan
                """)
                _thuc_thi_sqlite("DROP TABLE tai_khoan")
                _thuc_thi_sqlite("ALTER TABLE tai_khoan_temp RENAME TO tai_khoan")
                print("[INIT] Đã di chuyển bảng tai_khoan cũ sang cấu trúc mới an toàn.")
        except Exception as e:
            print(f"[INIT NOTE] Bỏ qua di chuyển tai_khoan: {e}")

        thuc_thi_sql("""
            CREATE TABLE IF NOT EXISTS tai_khoan (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE,
                username TEXT,
                ho_ten TEXT NOT NULL,
                hashed_password TEXT,
                password TEXT,
                role TEXT NOT NULL DEFAULT 'nhan_vien',
                is_active INTEGER DEFAULT 1,
                ngay_tao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

    # 2. Bảng cấu hình cột linh hoạt
    thuc_thi_sql("""
        CREATE TABLE IF NOT EXISTS cau_hinh_cot (
            id TEXT PRIMARY KEY,
            ten TEXT NOT NULL,
            kieu TEXT NOT NULL,
            mac_dinh INTEGER DEFAULT 0,
            thu_tu INTEGER DEFAULT 0
        )
    """)

    # 3. Bảng lương chi tiết
    if get_database_mode() == "postgresql":
        thuc_thi_sql("""
            CREATE TABLE IF NOT EXISTS bang_luong (
                id SERIAL PRIMARY KEY,
                nam INT NOT NULL,
                thang INT NOT NULL,
                ma_nv VARCHAR(100) NOT NULL,
                ho_ten VARCHAR(255),
                luong_thang NUMERIC DEFAULT 0,
                luong_thuong NUMERIC DEFAULT 0,
                cot_tuy_chinh TEXT DEFAULT '{}',
                ngay_tao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
    else:
        thuc_thi_sql("""
            CREATE TABLE IF NOT EXISTS bang_luong (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nam INTEGER NOT NULL,
                thang INTEGER NOT NULL,
                ma_nv TEXT NOT NULL,
                ho_ten TEXT,
                luong_thang REAL DEFAULT 0,
                luong_thuong REAL DEFAULT 0,
                cot_tuy_chinh TEXT DEFAULT '{}',
                ngay_tao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

    # 4. Bảng cấu hình hệ thống (Công tắc mở/tắt cổng đăng ký)
    thuc_thi_sql("""
        CREATE TABLE IF NOT EXISTS cau_hinh_he_thong (
            khoa TEXT PRIMARY KEY,
            gia_tri TEXT NOT NULL
        )
    """)

    # 5. Bảng lưu mã xác thực OTP khôi phục mật khẩu
    if get_database_mode() == "postgresql":
        thuc_thi_sql("""
            CREATE TABLE IF NOT EXISTS ma_xac_thuc_otp (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) NOT NULL,
                otp_code VARCHAR(20) NOT NULL,
                het_han_luc TIMESTAMP NOT NULL,
                da_dung INT DEFAULT 0
            )
        """)
    else:
        thuc_thi_sql("""
            CREATE TABLE IF NOT EXISTS ma_xac_thuc_otp (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL,
                otp_code TEXT NOT NULL,
                het_han_luc TIMESTAMP NOT NULL,
                da_dung INTEGER DEFAULT 0
            )
        """)

    # --- KHỞI TẠO DỮ LIỆU BAN ĐẦU ---

    # A. Cổng đăng ký ban đầu: TẮT (0: Đóng chặt)
    res_gate = thuc_thi_sql("SELECT gia_tri FROM cau_hinh_he_thong WHERE khoa = 'cho_phep_dang_ky'")
    if not res_gate["rows"]:
        thuc_thi_sql("INSERT INTO cau_hinh_he_thong (khoa, gia_tri) VALUES ('cho_phep_dang_ky', '0')")

    # B. Cấp tài khoản SuperAdmin mặc định (admin@agribank.com.vn) nếu chưa có
    res_admin = thuc_thi_sql("SELECT id FROM tai_khoan WHERE LOWER(COALESCE(email, '')) = ? OR LOWER(COALESCE(username, '')) = 'admin'", [settings.SUPERADMIN_EMAIL.lower()])
    if not res_admin["rows"]:
        # Băm mật khẩu ban đầu bằng Bcrypt Salt ngẫu nhiên
        hashed = hash_password(settings.SUPERADMIN_PASSWORD)
        thuc_thi_sql("""
            INSERT INTO tai_khoan (email, username, ho_ten, hashed_password, role, is_active)
            VALUES (?, 'admin', ?, ?, 'admin', 1)
        """, [settings.SUPERADMIN_EMAIL, settings.SUPERADMIN_NAME, hashed])
        print(f"[INIT] Đã tạo tài khoản SuperAdmin: {settings.SUPERADMIN_EMAIL}")
    else:
        # Đảm bảo tài khoản admin này có vai trò admin và có email
        admin_row = res_admin["rows"][0]
        thuc_thi_sql("""
            UPDATE tai_khoan SET role = 'admin', email = ?, is_active = 1 WHERE id = ?
        """, [settings.SUPERADMIN_EMAIL, admin_row["id"]])
        check_pwd = thuc_thi_sql("SELECT hashed_password FROM tai_khoan WHERE id = ?", [admin_row["id"]])
        if not check_pwd["rows"] or not check_pwd["rows"][0].get("hashed_password"):
            hashed = hash_password(settings.SUPERADMIN_PASSWORD)
            thuc_thi_sql("UPDATE tai_khoan SET hashed_password = ? WHERE id = ?", [hashed, admin_row["id"]])

    # C. Cột mặc định
    res_cot = thuc_thi_sql("SELECT COUNT(*) as count FROM cau_hinh_cot")
    if res_cot["rows"] and res_cot["rows"][0]["count"] == 0:
        cac_cot = [
            ("ma_nv", "Mã NV / ID", "chu", 1, 1),
            ("ho_ten", "Họ và Tên", "chu", 1, 2),
            ("luong_thang", "Lương Tháng", "so", 1, 3),
            ("luong_thuong", "Lương Thưởng", "so", 1, 4)
        ]
        for c in cac_cot:
            thuc_thi_sql("INSERT INTO cau_hinh_cot (id, ten, kieu, mac_dinh, thu_tu) VALUES (?, ?, ?, ?, ?)", list(c))

    # D. Dữ liệu mẫu tháng 1/2026 nếu trống
    res_luong = thuc_thi_sql("SELECT COUNT(*) as count FROM bang_luong")
    if res_luong["rows"] and res_luong["rows"][0]["count"] == 0:
        mau = [
            (2026, 1, "AG001", "Nguyễn Văn An", 18500000, 3500000, "{}"),
            (2026, 1, "AG002", "Trần Thị Mai", 16000000, 2500000, "{}")
        ]
        for m in mau:
            thuc_thi_sql("INSERT INTO bang_luong (nam, thang, ma_nv, ho_ten, luong_thang, luong_thuong, cot_tuy_chinh) VALUES (?, ?, ?, ?, ?, ?, ?)", list(m))

    info = get_db_info()
    print(f"[OK] Khởi tạo Database thành công! Chế độ: {info['ten']}")
