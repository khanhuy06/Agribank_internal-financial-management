# =========================================================
# HỆ THỐNG QUẢN LÝ TÀI CHÍNH AGRIBANK (CHI NHÁNH HOÀN LÃO)
# MODULE CRUD - CÁC HÀM TRUY VẤN DỮ LIỆU AN TOÀN
# =========================================================

import json
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
from backend.app.db.connection import thuc_thi_sql

# =========================================================
# 1. QUẢN LÝ TÀI KHOẢN & NGƯỜI DÙNG (USER CRUD)
# =========================================================

def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """Tìm tài khoản theo email, username hoặc họ tên (chuẩn hóa chữ thường)."""
    clean_val = email.strip().lower()
    res = thuc_thi_sql("""
        SELECT id, email, username, ho_ten, hashed_password, role, is_active, ngay_tao
        FROM tai_khoan
        WHERE LOWER(COALESCE(email, '')) = ? 
           OR LOWER(COALESCE(username, '')) = ? 
           OR LOWER(COALESCE(ho_ten, '')) = ?
    """, [clean_val, clean_val, clean_val])
    if res["rows"]:
        return res["rows"][0]
    return None

def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    """Tìm tài khoản theo ID."""
    res = thuc_thi_sql("""
        SELECT id, email, username, ho_ten, hashed_password, role, is_active, ngay_tao
        FROM tai_khoan
        WHERE id = ?
    """, [user_id])
    if res["rows"]:
        return res["rows"][0]
    return None

def get_all_users() -> List[Dict[str, Any]]:
    """
    Lấy danh sách tất cả tài khoản.
    ĐẢM BẢO BẢO MẬT: Tuyệt đối KHÔNG trả về hashed_password (Zero Password Visibility).
    """
    res = thuc_thi_sql("""
        SELECT id, email, username, ho_ten, role, is_active, ngay_tao
        FROM tai_khoan
        ORDER BY id ASC
    """)
    return res["rows"]

def create_user(email: str, ho_ten: str, hashed_password: str, role: str = "nhan_vien") -> int:
    """Tạo người dùng mới."""
    clean_email = email.strip().lower()
    uname = clean_email.split("@")[0]
    res = thuc_thi_sql("""
        INSERT INTO tai_khoan (email, username, ho_ten, hashed_password, role, is_active)
        VALUES (?, ?, ?, ?, ?, 1)
    """, [clean_email, uname, ho_ten.strip(), hashed_password, role])
    return res["lastrowid"]

def update_user_role(user_id: int, new_role: str) -> bool:
    """Admin nâng quyền thành Admin hoặc hạ xuống Nhân viên."""
    thuc_thi_sql("""
        UPDATE tai_khoan
        SET role = ?
        WHERE id = ?
    """, [new_role, user_id])
    return True

def update_user_name(user_id: int, new_ho_ten: str) -> bool:
    """Cập nhật tên tài khoản / họ tên."""
    clean_name = new_ho_ten.strip()
    thuc_thi_sql("""
        UPDATE tai_khoan
        SET ho_ten = ?
        WHERE id = ?
    """, [clean_name, user_id])
    return True

def update_user_password(user_id: int, new_hashed_password: str) -> bool:
    """Cập nhật mật khẩu băm mới."""
    thuc_thi_sql("""
        UPDATE tai_khoan
        SET hashed_password = ?
        WHERE id = ?
    """, [new_hashed_password, user_id])
    return True

def delete_user(user_id: int) -> bool:
    """Xóa tài khoản khỏi hệ thống."""
    thuc_thi_sql("DELETE FROM tai_khoan WHERE id = ?", [user_id])
    return True

def count_admins() -> int:
    """Đếm tổng số tài khoản Admin đang hoạt động."""
    res = thuc_thi_sql("SELECT COUNT(*) as cnt FROM tai_khoan WHERE role = 'admin' AND is_active = 1")
    if res["rows"]:
        return int(res["rows"][0]["cnt"] or 0)
    return 0


# =========================================================
# 2. CÔNG TẮC CỔNG ĐĂNG KÝ HỆ THỐNG (SYSTEM SETTINGS)
# =========================================================

def get_registration_status() -> bool:
    """Kiểm tra cổng đăng ký hiện tại đang MỞ (True) hay ĐÓNG (False)."""
    res = thuc_thi_sql("SELECT gia_tri FROM cau_hinh_he_thong WHERE khoa = 'cho_phep_dang_ky'")
    if res["rows"]:
        return str(res["rows"][0]["gia_tri"]).strip() == "1"
    return False

def set_registration_status(is_open: bool) -> bool:
    """Admin gạt công tắc BẬT (True) hoặc TẮT (False) cổng đăng ký."""
    val = "1" if is_open else "0"
    from backend.app.db.connection import get_database_mode
    if get_database_mode() == "postgresql":
        thuc_thi_sql("""
            INSERT INTO cau_hinh_he_thong (khoa, gia_tri)
            VALUES ('cho_phep_dang_ky', ?)
            ON CONFLICT (khoa) DO UPDATE SET gia_tri = EXCLUDED.gia_tri
        """, [val])
    else:
        thuc_thi_sql("""
            INSERT OR REPLACE INTO cau_hinh_he_thong (khoa, gia_tri)
            VALUES ('cho_phep_dang_ky', ?)
        """, [val])
    return True


# =========================================================
# 3. QUẢN LÝ MÃ XÁC THỰC OTP QUÊN MẬT KHẨU (OTP CRUD)
# =========================================================

def save_otp(email: str, otp_code: str, expire_minutes: int = 10) -> bool:
    """Lưu mã OTP với thời hạn 10 phút."""
    # Vô hiệu hóa các OTP cũ của email này
    thuc_thi_sql("UPDATE ma_xac_thuc_otp SET da_dung = 1 WHERE LOWER(email) = LOWER(?)", [email.strip()])

    expire_at = (datetime.now() + timedelta(minutes=expire_minutes)).strftime("%Y-%m-%d %H:%M:%S")
    thuc_thi_sql("""
        INSERT INTO ma_xac_thuc_otp (email, otp_code, het_han_luc, da_dung)
        VALUES (?, ?, ?, 0)
    """, [email.strip().lower(), otp_code.strip(), expire_at])
    return True

def verify_and_consume_otp(email: str, otp_code: str) -> bool:
    """Xác thực mã OTP hợp lệ và chưa hết hạn, sau đó đánh dấu đã sử dụng."""
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    res = thuc_thi_sql("""
        SELECT id FROM ma_xac_thuc_otp
        WHERE LOWER(email) = LOWER(?) AND otp_code = ? AND da_dung = 0 AND het_han_luc >= ?
        ORDER BY id DESC LIMIT 1
    """, [email.strip(), otp_code.strip(), now_str])

    if res["rows"]:
        otp_id = res["rows"][0]["id"]
        # Đánh dấu đã dùng một lần
        thuc_thi_sql("UPDATE ma_xac_thuc_otp SET da_dung = 1 WHERE id = ?", [otp_id])
        return True
    return False


# =========================================================
# 4. QUẢN LÝ CỘT LINH HOẠT (DYNAMIC COLUMNS)
# =========================================================

def get_columns() -> List[Dict[str, Any]]:
    """Lấy danh sách các cột đang hiển thị."""
    res = thuc_thi_sql("SELECT id, ten, kieu, mac_dinh FROM cau_hinh_cot ORDER BY thu_tu ASC, id ASC")
    return res["rows"]

def add_column(id_cot: str, ten: str, kieu: str) -> bool:
    """Thêm một cột mới (tương thích PostgreSQL và SQLite/Turso)."""
    from backend.app.db.connection import get_database_mode
    if get_database_mode() == "postgresql":
        thuc_thi_sql("""
            INSERT INTO cau_hinh_cot (id, ten, kieu, mac_dinh, thu_tu)
            VALUES (?, ?, ?, 0, 99)
            ON CONFLICT (id) DO UPDATE SET ten = EXCLUDED.ten, kieu = EXCLUDED.kieu
        """, [id_cot, ten, kieu])
    else:
        thuc_thi_sql("""
            INSERT OR REPLACE INTO cau_hinh_cot (id, ten, kieu, mac_dinh, thu_tu)
            VALUES (?, ?, ?, 0, 99)
        """, [id_cot, ten, kieu])
    return True

def delete_column(id_cot: str) -> bool:
    """Xóa cột tùy chỉnh (không cho phép xóa cột mặc định)."""
    thuc_thi_sql("DELETE FROM cau_hinh_cot WHERE id = ? AND mac_dinh = 0", [id_cot])
    return True


# =========================================================
# 5. QUẢN LÝ BẢNG LƯƠNG & TÀI CHÍNH (SALARY CRUD)
# =========================================================

def get_salaries(nam: int, thang: int) -> List[Dict[str, Any]]:
    """Lấy toàn bộ danh sách lương trong tháng."""
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
            "ngay_tao": str(r["ngay_tao"])
        }
        # Mở rộng các cột động từ JSON
        try:
            extra = json.loads(r["cot_tuy_chinh"] or "{}")
            item.update(extra)
        except Exception:
            pass
        ket_qua.append(item)
    return ket_qua

def add_salary(nam: int, thang: int, ma_nv: str, ho_ten: str, luong_thang: float, luong_thuong: float, cot_tuy_chinh: dict = None) -> int:
    """Thêm bản ghi lương mới."""
    json_extra = json.dumps(cot_tuy_chinh or {}, ensure_ascii=False)
    res = thuc_thi_sql("""
        INSERT INTO bang_luong (nam, thang, ma_nv, ho_ten, luong_thang, luong_thuong, cot_tuy_chinh)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, [nam, thang, ma_nv, ho_ten, luong_thang, luong_thuong, json_extra])
    return res["lastrowid"]

def update_salary(id_ban_ghi: int, ma_nv: str, ho_ten: str, luong_thang: float, luong_thuong: float, cot_tuy_chinh: dict = None) -> bool:
    """Cập nhật thông tin dòng lương."""
    json_extra = json.dumps(cot_tuy_chinh or {}, ensure_ascii=False)
    thuc_thi_sql("""
        UPDATE bang_luong
        SET ma_nv = ?, ho_ten = ?, luong_thang = ?, luong_thuong = ?, cot_tuy_chinh = ?
        WHERE id = ?
    """, [ma_nv, ho_ten, luong_thang, luong_thuong, json_extra, id_ban_ghi])
    return True

def delete_salary(id_ban_ghi: int) -> bool:
    """Xóa một dòng lương."""
    thuc_thi_sql("DELETE FROM bang_luong WHERE id = ?", [id_ban_ghi])
    return True
