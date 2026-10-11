# =========================================================
# HỆ THỐNG QUẢN LÝ TÀI CHÍNH AGRIBANK (CHI NHÁNH HOÀN LÃO)
# API ROUTER: QUẢN LÝ CỘT BẢNG LƯƠNG LINH HOẠT
# =========================================================

from fastapi import APIRouter, HTTPException, Path, Depends
from typing import List, Dict, Any
from backend.app.schemas.schemas import CotMoiSchema
from backend.app.db import crud
from backend.app.core.security import get_current_user, require_admin

router = APIRouter(prefix="/api/cot", tags=["Cấu hình Cột"])

@router.get("", response_model=List[Dict[str, Any]])
def api_lay_danh_sach_cot(current_user: dict = Depends(get_current_user)):
    """Lấy danh sách các cột (cả Admin và Nhân viên đều xem được)."""
    return crud.get_columns()

@router.post("")
def api_them_cot(req: CotMoiSchema, admin: dict = Depends(require_admin)):
    """Chỉ Admin mới có quyền thêm cột linh hoạt mới."""
    try:
        crud.add_column(req.id, req.ten, req.kieu)
        data = req.model_dump() if hasattr(req, "model_dump") else req.dict()
        return {"success": True, "message": "Thêm cột thành công", "cot": data}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Lỗi lưu cột vào cơ sở dữ liệu: {str(e)}")

@router.delete("/{id_cot}")
def api_xoa_cot(
    id_cot: str = Path(..., description="Mã ID của cột cần xóa"),
    admin: dict = Depends(require_admin)
):
    """Chỉ Admin mới có quyền xóa cột tùy chỉnh."""
    try:
        crud.delete_column(id_cot)
        return {"success": True, "message": f"Đã xóa cột '{id_cot}' thành công!"}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Lỗi khi xóa cột: {str(e)}")
