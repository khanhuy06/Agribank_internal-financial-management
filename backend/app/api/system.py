# =========================================================
# HỆ THỐNG QUẢN LÝ TÀI CHÍNH AGRIBANK (CHI NHÁNH HOÀN LÃO)
# API ROUTER: QUẢN LÝ CÔNG TẮC HỆ THỐNG & TRẠNG THÁI DATABASE
# =========================================================

from fastapi import APIRouter, Depends
from backend.app.schemas.schemas import CongTacDangKySchema
from backend.app.db import crud
from backend.app.db.connection import get_db_info
from backend.app.core.security import require_admin

router = APIRouter(prefix="/api/system", tags=["Hệ Thống"])

@router.get("/registration-status")
def api_kiem_tra_cong_dang_ky():
    """Kiểm tra cổng đăng ký đang MỞ (True) hay ĐÓNG (False) để hiển thị nút Đăng ký ngoài giao diện."""
    is_open = crud.get_registration_status()
    return {
        "is_open": is_open,
        "message": "Cổng đăng ký đang MỞ" if is_open else "Cổng đăng ký đang ĐÓNG"
    }

@router.put("/registration-status")
def api_gat_cong_tac_dang_ky(req: CongTacDangKySchema, admin: dict = Depends(require_admin)):
    """
    Admin gạt công tắc BẬT/TẮT cổng đăng ký.
    Khi bật: 100 nhân viên mới có thể tự vào đăng ký.
    Khi tắt: Khóa cổng lại để kiểm soát an ninh.
    """
    crud.set_registration_status(req.cho_phep)
    trang_thai = "🟢 ĐÃ MỞ CỔNG ĐĂNG KÝ (Nhân viên có thể tự đăng ký)" if req.cho_phep else "🔴 ĐÃ KHÓA CỔNG ĐĂNG KÝ"
    return {
        "success": True,
        "is_open": req.cho_phep,
        "message": trang_thai
    }

@router.get("/status")
def api_thong_tin_he_thong():
    """Trả về trạng thái máy chủ và loại Database đang kết nối (PostgreSQL / Turso / SQLite)."""
    return {
        "status": "online",
        "database": get_db_info()
    }
