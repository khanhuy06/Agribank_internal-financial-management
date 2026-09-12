# =========================================================
# HỆ THỐNG QUẢN LÝ TÀI CHÍNH AGRIBANK (CHI NHÁNH HOÀN LÃO)
# BACKEND SERVER (FASTAPI) - ĐIỀU HÀNH VÀ CUNG CẤP CÁC API
# =========================================================

from fastapi import FastAPI, HTTPException, Query, Path
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Dict, Any, Optional
import os
import sys

# Đảm bảo console Windows in tiếng Việt UTF-8
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Import module Database đã tạo
import database

# Khởi tạo ứng dụng FastAPI với tài liệu Swagger UI tự động
app = FastAPI(
    title="Hệ thống Quản lý Tài chính - Agribank Chi nhánh Hoàn Lão",
    description="API điều hành bảng lương, cấu hình cột linh hoạt và lưu trữ SQLite",
    version="2.0.0"
)

# 1. Cấu hình CORS: Cho phép trình duyệt gọi API an toàn
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Khởi tạo Database khi server khởi động
@app.on_event("startup")
def startup_event():
    database.khoi_tao_db()
    print("[SERVER] FastAPI da ket noi va san sang phuc vu!")


# =========================================================
# PYDANTIC SCHEMAS (Định nghĩa định dạng dữ liệu gửi lên)
# =========================================================

class CotMoiSchema(BaseModel):
    id: str
    ten: str
    kieu: str  # 'so' hoặc 'chu'

class BanGhiLuongSchema(BaseModel):
    nam: int = 2026
    thang: int = 1
    ma_nv: str
    ho_ten: Optional[str] = ""
    luong_thang: Optional[float] = 0.0
    luong_thuong: Optional[float] = 0.0
    cot_tuy_chinh: Optional[Dict[str, Any]] = {}

class CapNhatLuongSchema(BaseModel):
    ma_nv: str
    ho_ten: Optional[str] = ""
    luong_thang: Optional[float] = 0.0
    luong_thuong: Optional[float] = 0.0
    cot_tuy_chinh: Optional[Dict[str, Any]] = {}


# =========================================================
# 3. CÁC ĐƯỜNG LINK API (ENDPOINTS)
# =========================================================

# --- API CẤU HÌNH CỘT ---
@app.get("/api/cot", tags=["Cấu hình Cột"])
def api_lay_danh_sach_cot():
    """Lấy danh sách tất cả các cột đang sử dụng trên bảng."""
    return database.lay_danh_sach_cot()

@app.post("/api/cot", tags=["Cấu hình Cột"])
def api_them_cot(req: CotMoiSchema):
    """Thêm một cột tùy chỉnh mới (kiểu số hoặc văn bản)."""
    database.them_cot(req.id, req.ten, req.kieu)
    return {"message": "Thêm cột thành công", "cot": req.dict()}

@app.delete("/api/cot/{id_cot}", tags=["Cấu hình Cột"])
def api_xoa_cot(id_cot: str = Path(..., description="Mã ID của cột cần xóa")):
    """Xóa một cột tùy chỉnh khỏi bảng."""
    database.xoa_cot(id_cot)
    return {"message": f"Đã xóa cột {id_cot} thành công"}


# --- API BẢNG LƯƠNG & TÀI CHÍNH ---
@app.get("/api/luong", tags=["Bảng Lương"])
def api_lay_bang_luong(
    nam: int = Query(2026, description="Năm tài chính"),
    thang: int = Query(1, description="Tháng cần xem (1 - 12)")
):
    """Lấy toàn bộ danh sách nhân viên và bảng lương của tháng từ Database SQLite."""
    return database.lay_danh_sach_luong(nam, thang)

@app.post("/api/luong", tags=["Bảng Lương"])
def api_them_ban_ghi(req: BanGhiLuongSchema):
    """Thêm một nhân viên / giao dịch lương mới vào Database."""
    if not req.ma_nv.strip():
        raise HTTPException(status_code=400, detail="Mã nhân viên / ID không được để trống")
    
    moi_id = database.them_ban_ghi_luong(
        nam=req.nam,
        thang=req.thang,
        ma_nv=req.ma_nv.strip(),
        ho_ten=req.ho_ten.strip(),
        luong_thang=req.luong_thang,
        luong_thuong=req.luong_thuong,
        cot_tuy_chinh=req.cot_tuy_chinh
    )
    return {"message": "Đã thêm giao dịch thành công", "id": moi_id}

@app.put("/api/luong/{id_ban_ghi}", tags=["Bảng Lương"])
def api_cap_nhat_ban_ghi(
    id_ban_ghi: int = Path(..., description="ID dòng cần sửa"),
    req: CapNhatLuongSchema = ...
):
    """Cập nhật thông tin nhân viên theo ID."""
    database.cap_nhat_ban_ghi_luong(
        id_ban_ghi=id_ban_ghi,
        ma_nv=req.ma_nv.strip(),
        ho_ten=req.ho_ten.strip(),
        luong_thang=req.luong_thang,
        luong_thuong=req.luong_thuong,
        cot_tuy_chinh=req.cot_tuy_chinh
    )
    return {"message": "Đã cập nhật giao dịch thành công"}

@app.delete("/api/luong/{id_ban_ghi}", tags=["Bảng Lương"])
def api_xoa_ban_ghi(id_ban_ghi: int = Path(..., description="ID dòng cần xóa")):
    """Xóa một dòng giao dịch theo ID."""
    database.xoa_ban_ghi_luong(id_ban_ghi)
    return {"message": f"Đã xóa giao dịch ID {id_ban_ghi} thành công"}


# =========================================================
# 4. PHỤC VỤ GIAO DIỆN WEB (STATIC FRONTEND)
# =========================================================
THU_MUC_HIEN_TAI = os.path.dirname(os.path.abspath(__file__))

@app.get("/")
def trang_chu():
    """Truy cập đường dẫn gốc trả về giao diện chính của Agribank."""
    return FileResponse(os.path.join(THU_MUC_HIEN_TAI, "index.html"))

# Tự động nạp css, js, logo ảnh
app.mount("/", StaticFiles(directory=THU_MUC_HIEN_TAI), name="static")

if __name__ == "__main__":
    import uvicorn
    print("[INFO] Dang khoi dong Web Server Agribank tai: http://localhost:8000")
    print("[INFO] Trang kiem tra API tu dong tai: http://localhost:8000/docs")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
