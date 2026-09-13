# =========================================================
# HỆ THỐNG QUẢN LÝ TÀI CHÍNH AGRIBANK (CHI NHÁNH HOÀN LÃO)
# MODULE DATABASE (SQLITE / TURSO CLOUD) - LƯU TRỮ DỮ LIỆU AN TOÀN
# =========================================================

import os
import sys
import json
import sqlite3

# Đảm bảo console Windows in tiếng Việt UTF-8 không bị lỗi
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Thử import thư viện Turso LibSQL Client
try:
    import libsql_client
    HAS_LIBSQL = True
except ImportError:
    HAS_LIBSQL = False

# Cấu hình biến môi trường Turso Cloud
TURSO_DATABASE_URL = os.environ.get("TURSO_DATABASE_URL", "").strip()
TURSO_AUTH_TOKEN = os.environ.get("TURSO_AUTH_TOKEN", "").strip()

# Đường dẫn file Database SQLite cục bộ (dự phòng khi chạy offline)
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "agribank.db")

def is_turso_enabled() -> bool:
    """Kiểm tra xem hệ thống có được cấu hình kết nối Turso Cloud hay không."""
    return bool(HAS_LIBSQL and TURSO_DATABASE_URL)

def get_turso_url() -> str:
    """Chuyển đổi giao thức libsql:// sang https:// để dùng HTTP pipeline ổn định 100%."""
    url = TURSO_DATABASE_URL.strip()
    if url.startswith("libsql://"):
        url = "https://" + url[len("libsql://"):]
    return url

def lay_thong_tin_db() -> dict:
    """Trả về thông tin loại Database đang được sử dụng."""
    if is_turso_enabled():
        return {
            "mode": "cloud_turso",
            "ten": "Turso Cloud SQLite",
            "mo_ta": "Lưu trữ đám mây vĩnh viễn (Turso LibSQL)",
            "url": get_turso_url()
        }
    return {
        "mode": "local_sqlite",
        "ten": "SQLite Cục Bộ",
        "mo_ta": "Lưu trên file agribank.db (Lưu ý: Trên Render cần cấu hình Turso để không mất dữ liệu)",
        "url": "file:agribank.db"
    }

def _thuc_thi_turso(query: str, params: list) -> dict:
    """Thực thi câu lệnh qua giao thức HTTP của Turso Cloud."""
    client = libsql_client.create_client_sync(
        url=get_turso_url(),
        auth_token=TURSO_AUTH_TOKEN if TURSO_AUTH_TOKEN else None
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

def _thuc_thi_sqlite(query: str, params: list) -> dict:
    """Thực thi câu lệnh trên SQLite cục bộ."""
    conn = sqlite3.connect(DB_PATH)
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
        return {
            "rows": rows,
            "lastrowid": lastrowid,
            "rowcount": rowcount
        }
    finally:
        conn.close()

def thuc_thi_sql(query: str, params: list = None) -> dict:
    """
    Thực thi câu lệnh SQL với cơ chế dự phòng tự động (Auto-Fallback).
    Nếu Turso gặp sự cố, tự động lưu trên SQLite cục bộ để server không bao giờ bị sập.
    """
    params = params or []

    if is_turso_enabled():
        try:
            return _thuc_thi_turso(query, params)
        except Exception as err:
            print(f"[CANH BAO TURSO] {err}. He thong tu dong chuyen sang SQLite cuc bo!")
            return _thuc_thi_sqlite(query, params)

    return _thuc_thi_sqlite(query, params)

def khoi_tao_db():
    """
    Khởi tạo các bảng cơ sở dữ liệu nếu chưa tồn tại:
    1. Bảng `cau_hinh_cot`: Lưu các cột mặc định và cột tùy chỉnh do người dùng tự thêm.
    2. Bảng `bang_luong`: Lưu chi tiết các dòng lương, thưởng, phụ cấp từng tháng.
    3. Bảng `tai_khoan`: Lưu tài khoản đăng nhập quản trị.
    """
    # 1. Bảng cấu hình cột
    thuc_thi_sql("""
        CREATE TABLE IF NOT EXISTS cau_hinh_cot (
            id TEXT PRIMARY KEY,
            ten TEXT NOT NULL,
            kieu TEXT NOT NULL,
            mac_dinh INTEGER DEFAULT 0,
            thu_tu INTEGER DEFAULT 0
        )
    """)

    # 2. Bảng lương chi tiết
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

    # 3. Bảng tài khoản quản trị
    thuc_thi_sql("""
        CREATE TABLE IF NOT EXISTS tai_khoan (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            ho_ten TEXT NOT NULL
        )
    """)

    # Nạp tài khoản mặc định (user / qwerty) nếu chưa có
    res_tk = thuc_thi_sql("SELECT COUNT(*) as count FROM tai_khoan WHERE username = 'user'")
    if res_tk["rows"] and res_tk["rows"][0]["count"] == 0:
        thuc_thi_sql("""
            INSERT INTO tai_khoan (username, password, ho_ten)
            VALUES ('user', 'qwerty', 'Quản Trị Viên Agribank')
        """)

    # Nạp sẵn các cột mặc định nếu bảng cột đang trống
    res_cot = thuc_thi_sql("SELECT COUNT(*) as count FROM cau_hinh_cot")
    if res_cot["rows"] and res_cot["rows"][0]["count"] == 0:
        cac_cot_mac_dinh = [
            ("ma_nv", "Mã NV / ID", "chu", 1, 1),
            ("ho_ten", "Họ và Tên", "chu", 1, 2),
            ("luong_thang", "Lương Tháng", "so", 1, 3),
            ("luong_thuong", "Lương Thưởng", "so", 1, 4)
        ]
        for c in cac_cot_mac_dinh:
            thuc_thi_sql("""
                INSERT INTO cau_hinh_cot (id, ten, kieu, mac_dinh, thu_tu)
                VALUES (?, ?, ?, ?, ?)
            """, list(c))

    # Nạp dữ liệu mẫu ban đầu cho Tháng 1/2026 nếu bảng lương hoàn toàn trống
    res_luong = thuc_thi_sql("SELECT COUNT(*) as count FROM bang_luong")
    if res_luong["rows"] and res_luong["rows"][0]["count"] == 0:
        du_lieu_mau = [
            (2026, 1, "AG001", "Nguyễn Văn An", 18500000, 3500000, "{}"),
            (2026, 1, "AG002", "Trần Thị Mai", 16000000, 2500000, "{}")
        ]
        for d in du_lieu_mau:
            thuc_thi_sql("""
                INSERT INTO bang_luong (nam, thang, ma_nv, ho_ten, luong_thang, luong_thuong, cot_tuy_chinh)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, list(d))

    db_info = lay_thong_tin_db()
    print(f"[OK] Khoi tao Database thanh cong! Che do: {db_info['ten']} ({db_info['url']})")


# =========================================================
# CÁC HÀM THAO TÁC VỚI BẢNG LƯƠNG (CRUD)
# =========================================================

def lay_danh_sach_luong(nam: int, thang: int):
    """Lấy toàn bộ danh sách nhân viên trong một tháng cụ thể."""
    res = thuc_thi_sql("""
        SELECT id, nam, thang, ma_nv, ho_ten, luong_thang, luong_thuong, cot_tuy_chinh, ngay_tao
        FROM bang_luong
        WHERE nam = ? AND thang = ?
        ORDER BY id ASC
    """, [nam, thang])

    ket_qua = []
    for r in res["rows"]:
        item = {
            "id": r["id"],
            "nam": r["nam"],
            "thang": r["thang"],
            "ma_nv": r["ma_nv"],
            "ho_ten": r["ho_ten"],
            "luong_thang": r["luong_thang"],
            "luong_thuong": r["luong_thuong"],
            "ngay_tao": r["ngay_tao"]
        }
        # Giải nén các cột tùy chỉnh nếu có
        try:
            extra = json.loads(r["cot_tuy_chinh"] or "{}")
            item.update(extra)
        except Exception:
            pass
        ket_qua.append(item)

    return ket_qua

def them_ban_ghi_luong(nam: int, thang: int, ma_nv: str, ho_ten: str, luong_thang: float, luong_thuong: float, cot_tuy_chinh: dict = None):
    """Thêm một dòng lương mới vào Database."""
    json_extra = json.dumps(cot_tuy_chinh or {}, ensure_ascii=False)
    res = thuc_thi_sql("""
        INSERT INTO bang_luong (nam, thang, ma_nv, ho_ten, luong_thang, luong_thuong, cot_tuy_chinh)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, [nam, thang, ma_nv, ho_ten, luong_thang, luong_thuong, json_extra])
    return res["lastrowid"]

def cap_nhat_ban_ghi_luong(id_ban_ghi: int, ma_nv: str, ho_ten: str, luong_thang: float, luong_thuong: float, cot_tuy_chinh: dict = None):
    """Cập nhật thông tin của một dòng lương theo ID."""
    json_extra = json.dumps(cot_tuy_chinh or {}, ensure_ascii=False)
    thuc_thi_sql("""
        UPDATE bang_luong
        SET ma_nv = ?, ho_ten = ?, luong_thang = ?, luong_thuong = ?, cot_tuy_chinh = ?
        WHERE id = ?
    """, [ma_nv, ho_ten, luong_thang, luong_thuong, json_extra, id_ban_ghi])
    return True

def xoa_ban_ghi_luong(id_ban_ghi: int):
    """Xóa một dòng lương theo ID."""
    thuc_thi_sql("DELETE FROM bang_luong WHERE id = ?", [id_ban_ghi])
    return True


# =========================================================
# CÁC HÀM QUẢN LÝ CẤU HÌNH CỘT (DYNAMIC COLUMNS)
# =========================================================

def lay_danh_sach_cot():
    """Lấy danh sách tất cả các cột đang sử dụng."""
    res = thuc_thi_sql("SELECT id, ten, kieu, mac_dinh FROM cau_hinh_cot ORDER BY thu_tu ASC, rowid ASC")
    return res["rows"]

def them_cot(id_cot: str, ten: str, kieu: str):
    """Thêm một cột mới vào bảng cấu hình."""
    thuc_thi_sql("""
        INSERT OR REPLACE INTO cau_hinh_cot (id, ten, kieu, mac_dinh, thu_tu)
        VALUES (?, ?, ?, 0, 99)
    """, [id_cot, ten, kieu])
    return True

def xoa_cot(id_cot: str):
    """Xóa một cột tùy chỉnh (không cho phép xóa cột mặc định)."""
    thuc_thi_sql("DELETE FROM cau_hinh_cot WHERE id = ? AND mac_dinh = 0", [id_cot])
    return True


# =========================================================
# HÀM XÁC THỰC ĐĂNG NHẬP (AUTHENTICATION)
# =========================================================

def xac_thuc_dang_nhap(username: str, mat_khau: str):
    """Kiểm tra tài khoản và mật khẩu đăng nhập."""
    res = thuc_thi_sql("""
        SELECT id, username, ho_ten
        FROM tai_khoan
        WHERE username = ? AND password = ?
    """, [username.strip(), mat_khau.strip()])
    if res["rows"]:
        return res["rows"][0]
    return None


if __name__ == "__main__":
    khoi_tao_db()
    print(f"\n--- Thông tin Database: {lay_thong_tin_db()} ---")
    print("\n--- Danh sách cột hiện tại: ---")
    for c in lay_danh_sach_cot():
        print(f"  • {c['ten']} ({c['kieu']}) - Mặc định: {bool(c['mac_dinh'])}")

    print("\n--- Dữ liệu Tháng 1/2026 trong Database: ---")
    for row in lay_danh_sach_luong(2026, 1):
        print(f"  • Mã NV: {row['ma_nv']} | Tên: {row['ho_ten']} | Lương: {row['luong_thang']:,} đ | Thưởng: {row['luong_thuong']:,} đ")

