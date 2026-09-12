# =========================================================
# HỆ THỐNG QUẢN LÝ TÀI CHÍNH AGRIBANK (CHI NHÁNH HOÀN LÃO)
# MODULE DATABASE (SQLITE) - LƯU TRỮ DỮ LIỆU AN TOÀN
# =========================================================

import sqlite3
import json
import os
import sys

# Đảm bảo console Windows in tiếng Việt UTF-8 không bị lỗi
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Đường dẫn file Database trong thư mục dự án
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "agribank.db")

def ket_noi_db():
    """Tạo kết nối tới SQLite và cho phép trả về kết quả dạng Dictionary (Row)."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # Giúp truy cập dữ liệu theo tên cột (row['ho_ten'])
    return conn

def khoi_tao_db():
    """
    Khởi tạo các bảng cơ sở dữ liệu nếu chưa tồn tại:
    1. Bảng `bang_luong`: Lưu chi tiết các dòng lương, thưởng, phụ cấp từng tháng.
    2. Bảng `cau_hinh_cot`: Lưu các cột mặc định và cột tùy chỉnh do người dùng tự thêm.
    """
    conn = ket_noi_db()
    cursor = conn.cursor()

    # 1. Tạo bảng cấu hình cột (để nhớ các cột linh hoạt mà bạn đã thêm)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS cau_hinh_cot (
            id TEXT PRIMARY KEY,
            ten TEXT NOT NULL,
            kieu TEXT NOT NULL,       -- 'so' (tiền tệ) hoặc 'chu' (văn bản)
            mac_dinh INTEGER DEFAULT 0, -- 1: Cột gốc, 0: Cột người dùng tự thêm
            thu_tu INTEGER DEFAULT 0
        )
    """)

    # 2. Tạo bảng danh sách lương
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS bang_luong (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nam INTEGER NOT NULL,
            thang INTEGER NOT NULL,
            ma_nv TEXT NOT NULL,
            ho_ten TEXT,
            luong_thang REAL DEFAULT 0,
            luong_thuong REAL DEFAULT 0,
            cot_tuy_chinh TEXT DEFAULT '{}', -- Lưu các cột linh hoạt dưới dạng JSON
            ngay_tao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # 3. Nạp sẵn các cột mặc định nếu bảng cột đang trống
    cursor.execute("SELECT COUNT(*) FROM cau_hinh_cot")
    if cursor.fetchone()[0] == 0:
        cac_cot_mac_dinh = [
            ("ma_nv", "Mã NV / ID", "chu", 1, 1),
            ("ho_ten", "Họ và Tên", "chu", 1, 2),
            ("luong_thang", "Lương Tháng", "so", 1, 3),
            ("luong_thuong", "Lương Thưởng", "so", 1, 4)
        ]
        cursor.executemany("""
            INSERT INTO cau_hinh_cot (id, ten, kieu, mac_dinh, thu_tu)
            VALUES (?, ?, ?, ?, ?)
        """, cac_cot_mac_dinh)

    # 4. Nạp dữ liệu mẫu ban đầu cho Tháng 1/2026 nếu bảng lương trống
    cursor.execute("SELECT COUNT(*) FROM bang_luong")
    if cursor.fetchone()[0] == 0:
        du_lieu_mau = [
            (2026, 1, "AG001", "Nguyễn Văn An", 18500000, 3500000, "{}"),
            (2026, 1, "AG002", "Trần Thị Mai", 16000000, 2500000, "{}")
        ]
        cursor.executemany("""
            INSERT INTO bang_luong (nam, thang, ma_nv, ho_ten, luong_thang, luong_thuong, cot_tuy_chinh)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, du_lieu_mau)

    conn.commit()
    conn.close()
    print("[OK] Da khoi tao Co so du lieu SQLite (agribank.db) thanh cong!")


# =========================================================
# CÁC HÀM THAO TÁC VỚI BẢNG LƯƠNG (CRUD)
# =========================================================

def lay_danh_sach_luong(nam: int, thang: int):
    """Lấy toàn bộ danh sách nhân viên trong một tháng cụ thể."""
    conn = ket_noi_db()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, nam, thang, ma_nv, ho_ten, luong_thang, luong_thuong, cot_tuy_chinh, ngay_tao
        FROM bang_luong
        WHERE nam = ? AND thang = ?
        ORDER BY id ASC
    """, (nam, thang))
    
    rows = cursor.fetchall()
    conn.close()

    ket_qua = []
    for r in rows:
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
    conn = ket_noi_db()
    cursor = conn.cursor()
    json_extra = json.dumps(cot_tuy_chinh or {}, ensure_ascii=False)

    cursor.execute("""
        INSERT INTO bang_luong (nam, thang, ma_nv, ho_ten, luong_thang, luong_thuong, cot_tuy_chinh)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (nam, thang, ma_nv, ho_ten, luong_thang, luong_thuong, json_extra))
    
    moi_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return moi_id

def cap_nhat_ban_ghi_luong(id_ban_ghi: int, ma_nv: str, ho_ten: str, luong_thang: float, luong_thuong: float, cot_tuy_chinh: dict = None):
    """Cập nhật thông tin của một dòng lương theo ID."""
    conn = ket_noi_db()
    cursor = conn.cursor()
    json_extra = json.dumps(cot_tuy_chinh or {}, ensure_ascii=False)

    cursor.execute("""
        UPDATE bang_luong
        SET ma_nv = ?, ho_ten = ?, luong_thang = ?, luong_thuong = ?, cot_tuy_chinh = ?
        WHERE id = ?
    """, (ma_nv, ho_ten, luong_thang, luong_thuong, json_extra, id_ban_ghi))
    
    conn.commit()
    conn.close()
    return True

def xoa_ban_ghi_luong(id_ban_ghi: int):
    """Xóa một dòng lương theo ID."""
    conn = ket_noi_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM bang_luong WHERE id = ?", (id_ban_ghi,))
    conn.commit()
    conn.close()
    return True


# =========================================================
# CÁC HÀM QUẢN LÝ CẤU HÌNH CỘT (DYNAMIC COLUMNS)
# =========================================================

def lay_danh_sach_cot():
    """Lấy danh sách tất cả các cột đang sử dụng."""
    conn = ket_noi_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, ten, kieu, mac_dinh FROM cau_hinh_cot ORDER BY thu_tu ASC, rowid ASC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def them_cot(id_cot: str, ten: str, kieu: str):
    """Thêm một cột mới vào bảng cấu hình."""
    conn = ket_noi_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO cau_hinh_cot (id, ten, kieu, mac_dinh, thu_tu)
        VALUES (?, ?, ?, 0, 99)
    """, (id_cot, ten, kieu))
    conn.commit()
    conn.close()
    return True

def xoa_cot(id_cot: str):
    """Xóa một cột tùy chỉnh (không cho phép xóa cột mặc định)."""
    conn = ket_noi_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM cau_hinh_cot WHERE id = ? AND mac_dinh = 0", (id_cot,))
    conn.commit()
    conn.close()
    return True


# Chạy thử nghiệm khởi tạo khi thực thi trực tiếp file này
if __name__ == "__main__":
    khoi_tao_db()
    print("\n--- Danh sách cột hiện tại: ---")
    for c in lay_danh_sach_cot():
        print(f"  • {c['ten']} ({c['kieu']}) - Mặc định: {bool(c['mac_dinh'])}")

    print("\n--- Dữ liệu Tháng 1/2026 trong Database: ---")
    for row in lay_danh_sach_luong(2026, 1):
        print(f"  • Mã NV: {row['ma_nv']} | Tên: {row['ho_ten']} | Lương: {row['luong_thang']:,} đ | Thưởng: {row['luong_thuong']:,} đ")
