# =========================================================
# HỆ THỐNG QUẢN LÝ TÀI CHÍNH AGRIBANK (CHI NHÁNH HOÀN LÃO)
# API ROUTER: QUẢN LÝ TÀI KHOẢN & PHÂN QUYỀN (DÀNH CHO ADMIN)
# =========================================================

from fastapi import APIRouter, HTTPException, Path, Depends
from typing import List, Dict, Any
from backend.app.schemas.schemas import DoiQuyenSchema
from backend.app.db import crud
from backend.app.core.security import require_admin

router = APIRouter(prefix="/api/users", tags=["Quản lý Tài khoản (Admin)"])

@router.get("", response_model=List[Dict[str, Any]])
def api_lay_danh_sach_tai_khoan(admin: dict = Depends(require_admin)):
    """
    Admin xem danh sách toàn bộ tài khoản có quyền vào web.
    BẢO MẬT: Chỉ hiển thị Email, Họ tên, Vai trò, Ngày tạo. Tuyệt đối KHÔNG hiển thị mật khẩu.
    """
    return crud.get_all_users()

@router.put("/{user_id}/role")
def api_thay_doi_vai_tro(
    user_id: int = Path(..., description="ID của người dùng cần đổi vai trò"),
    req: DoiQuyenSchema = ...,
    admin: dict = Depends(require_admin)
):
    """
    Admin phân quyền / thăng chức:
    Chuyển một tài khoản thành 'admin' hoặc hạ xuống 'nhan_vien'.
    """
    user = crud.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản người dùng!")

    # Chống tự hạ quyền của chính mình nếu chỉ có 1 admin
    if user["id"] == admin["id"] and req.role != "admin":
        raise HTTPException(status_code=400, detail="Bạn không thể tự hạ quyền Admin của chính mình!")

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
    Admin xóa tài khoản nhân viên (nhân viên sẽ bị xóa vĩnh viễn, không thể đăng nhập nữa).
    """
    user = crud.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản người dùng!")

    # Chống tự xóa tài khoản của chính mình
    if user["id"] == admin["id"]:
        raise HTTPException(status_code=400, detail="Bạn không thể tự xóa tài khoản của chính mình!")

    crud.delete_user(user_id)
    return {
        "success": True,
        "message": f"Đã xóa tài khoản '{user['email']}' thành công! Người này không thể vào web được nữa."
    }
