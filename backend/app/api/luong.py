# =========================================================
# HỆ THỐNG QUẢN LÝ TÀI CHÍNH AGRIBANK (CHI NHÁNH HOÀN LÃO)
# API ROUTER: QUẢN LÝ BẢNG LƯƠNG & TÀI CHÍNH (RBAC PROTECTED)
# =========================================================

from fastapi import APIRouter, HTTPException, Query, Path, Depends
from typing import List, Dict, Any
from backend.app.schemas.schemas import BanGhiLuongSchema, CapNhatLuongSchema
from backend.app.db import crud
from backend.app.core.security import get_current_user, require_admin

router = APIRouter(prefix="/api/luong", tags=["Bảng Lương"])

@router.get("", response_model=List[Dict[str, Any]])
def api_lay_bang_luong(
    nam: int = Query(2026, description="Năm tài chính"),
    thang: int = Query(1, description="Tháng cần xem (1 - 12)"),
    current_user: dict = Depends(get_current_user)
):
    """
    Lấy toàn bộ danh sách lương trong tháng.
    Cả Admin và Nhân viên đã đăng nhập đều có quyền xem.
    Chống F12: Chưa có JWT Token hợp lệ sẽ bị chặn 401 ngay lập tức.
    """
    return crud.get_salaries(nam, thang)

@router.post("")
def api_them_ban_ghi(req: BanGhiLuongSchema, admin: dict = Depends(require_admin)):
    """
    Thêm giao dịch / nhân viên mới vào bảng lương.
    CHỈ ADMIN mới có quyền. Nhân viên thường gọi vào đây sẽ bị chặn 403 Forbidden.
    """
    if not req.ma_nv.strip():
        raise HTTPException(status_code=400, detail="Mã nhân viên / ID không được để trống!")

    moi_id = crud.add_salary(
        nam=req.nam,
        thang=req.thang,
        ma_nv=req.ma_nv.strip(),
        ho_ten=req.ho_ten.strip(),
        luong_thang=req.luong_thang,
        luong_thuong=req.luong_thuong,
        cot_tuy_chinh=req.cot_tuy_chinh
    )
    return {"message": "Đã thêm giao dịch thành công", "id": moi_id}

@router.put("/{id_ban_ghi}")
def api_cap_nhat_ban_ghi(
    id_ban_ghi: int = Path(..., description="ID dòng cần sửa"),
    req: CapNhatLuongSchema = ...,
    admin: dict = Depends(require_admin)
):
    """
    Cập nhật dòng lương theo ID.
    CHỈ ADMIN mới có quyền. Ngăn chặn triệt để lỗi IDOR.
    """
    crud.update_salary(
        id_ban_ghi=id_ban_ghi,
        ma_nv=req.ma_nv.strip(),
        ho_ten=req.ho_ten.strip(),
        luong_thang=req.luong_thang,
        luong_thuong=req.luong_thuong,
        cot_tuy_chinh=req.cot_tuy_chinh
    )
    return {"message": "Đã cập nhật thông tin giao dịch thành công!"}

@router.delete("/{id_ban_ghi}")
def api_xoa_ban_ghi(
    id_ban_ghi: int = Path(..., description="ID dòng cần xóa"),
    admin: dict = Depends(require_admin)
):
    """
    Xóa dòng giao dịch theo ID.
    CHỈ ADMIN mới có quyền.
    """
    crud.delete_salary(id_ban_ghi)
    return {"message": f"Đã xóa dòng giao dịch ID {id_ban_ghi} thành công!"}
