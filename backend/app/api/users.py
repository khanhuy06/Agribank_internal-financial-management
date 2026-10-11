# =========================================================
# HỆ THỐNG QUẢN LÝ TÀI CHÍNH AGRIBANK (CHI NHÁNH HOÀN LÃO)
# API ROUTER: QUẢN LÝ TÀI KHOẢN & PHÂN QUYỀN (DÀNH CHO ADMIN)
# =========================================================

from fastapi import APIRouter, HTTPException, Path, Depends
from typing import List, Dict, Any
from backend.app.schemas.schemas import DoiQuyenSchema, TaoTaiKhoanThuCongSchema
from backend.app.db import crud
from backend.app.core.security import require_admin, hash_password

router = APIRouter(prefix="/api/users", tags=["Quản lý Tài khoản (Admin)"])

@router.get("", response_model=List[Dict[str, Any]])
def api_lay_danh_sach_tai_khoan(admin: dict = Depends(require_admin)):
    """
    Admin xem danh sách toàn bộ tài khoản có quyền vào web.
    BẢO MẬT: Chỉ hiển thị Email, Họ tên, Vai trò, Ngày tạo. Tuyệt đối KHÔNG hiển thị mật khẩu.
    """
    return crud.get_all_users()

@router.post("", response_model=Dict[str, Any])
def api_tao_tai_khoan_thu_cong(
    req: TaoTaiKhoanThuCongSchema,
    admin: dict = Depends(require_admin)
):
    """
    Admin chủ động thêm tài khoản thủ công:
    - Nhập Email, Họ tên, Mật khẩu ban đầu và phân quyền (Admin hoặc Nhân viên).
    - Mật khẩu băm 1 chiều Bcrypt, sau đó người dùng tự đổi mật khẩu cá nhân, Admin không thể biết.
    """
    clean_email = req.email.strip().lower()
    existing = crud.get_user_by_email(clean_email)
    if existing:
        raise HTTPException(status_code=400, detail=f"Email '{clean_email}' đã tồn tại trên hệ thống!")

    hashed = hash_password(req.mat_khau)
    new_user_id = crud.create_user(
        email=clean_email,
        ho_ten=req.ho_ten.strip(),
        hashed_password=hashed,
        role=req.role
    )
    vai_tro_text = "Quản trị viên (Admin)" if req.role == "admin" else "Nhân viên"
    return {
        "success": True,
        "message": f"Đã tạo thành công tài khoản '{clean_email}' với vai trò {vai_tro_text}!",
        "user_id": new_user_id
    }

@router.put("/{user_id}/role")
def api_thay_doi_vai_tro(
    user_id: int = Path(..., description="ID của người dùng cần đổi vai trò"),
    req: DoiQuyenSchema = ...,
    admin: dict = Depends(require_admin)
):
    """
    Admin phân quyền / thăng chức:
    Chuyển một nhân viên thành 'admin'.
    AN NINH TỐI CAO: Admin KHÔNG ĐƯỢC PHÉP hạ cấp Admin khác!
    """
    user = crud.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản người dùng!")

    # Chống tự hạ quyền của chính mình
    if user["id"] == admin["id"]:
        raise HTTPException(status_code=400, detail="Bạn không thể tự thay đổi vai trò của chính mình!")

    # AN NINH TỐI CAO: Các Admin bình đẳng - Không ai được phép hạ cấp Admin khác
    if user.get("role") == "admin":
        raise HTTPException(
            status_code=403, 
            detail="Bảo mật cấp cao: Quản trị viên (Admin) không có quyền hạ cấp Quản trị viên khác!"
        )

    crud.update_user_role(user_id, req.role)
    vai_tro_text = "Quản trị viên (Admin)" if req.role == "admin" else "Nhân viên (Chỉ xem)"
    return {
        "success": True,
        "message": f"Đã thay đổi vai trò của '{user['email']}' thành {vai_tro_text} thành công!"
    }

@router.delete("/{user_id}")
def api_xoa_tai_khoan(
    user_id: int = Path(..., description="ID của tài khoản cần xóa"),
    admin: dict = Depends(require_admin)
):
    """
    Admin xóa tài khoản nhân viên.
    AN NINH TỐI CAO: Admin KHÔNG ĐƯỢC PHÉP kick/xóa tài khoản của Admin khác!
    """
    user = crud.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản người dùng!")

    # Chống tự xóa tài khoản của chính mình
    if user["id"] == admin["id"]:
        raise HTTPException(status_code=400, detail="Bạn không thể tự xóa tài khoản của chính mình!")

    # AN NINH TỐI CAO: Chống kick/xóa Admin khác
    if user.get("role") == "admin":
        raise HTTPException(
            status_code=403, 
            detail="Bảo mật cấp cao: Không thể xóa tài khoản của Quản trị viên (Admin) khác!"
        )

    crud.delete_user(user_id)
    return {
        "success": True,
        "message": f"Đã xóa tài khoản '{user['email']}' thành công! Người này không thể vào web được nữa."
    }
