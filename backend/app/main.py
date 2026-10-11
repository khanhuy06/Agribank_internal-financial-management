# =========================================================
# HỆ THỐNG QUẢN LÝ TÀI CHÍNH AGRIBANK (CHI NHÁNH HOÀN LÃO)
# BACKEND SERVER (FASTAPI) - APPLICATION ENTRYPOINT
# =========================================================

import os
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Đảm bảo in tiếng Việt UTF-8
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

from backend.app.core.config import settings
from backend.app.db import connection
from backend.app.api import auth, users, system, cot, luong

app = FastAPI(
    title="Hệ thống Quản lý Tài chính - Agribank Chi nhánh Hoàn Lão",
    description="Hệ thống Backend chuẩn Security, Phân quyền RBAC, Hỗ trợ PostgreSQL & Docker",
    version="3.0.0"
)

# 1. Cấu hình CORS an toàn
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
    try:
        connection.khoi_tao_db()
        print("[SERVER] FastAPI đã kết nối Database và sẵn sàng phục vụ!")
    except Exception as e:
        print(f"[CẢNH BÁO STARTUP] Lỗi khởi tạo database: {e}")

# 3. Đăng ký các Module API Routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(system.router)
app.include_router(cot.router)
app.include_router(luong.router)

# Endpoint tương thích ngược cho các client cũ
@app.get("/api/status", tags=["Hệ Thống"])
def status_alias():
    return system.api_thong_tin_he_thong()

@app.post("/api/login", tags=["Xác thực & Bảo mật"])
def login_alias(req: auth.DangNhapSchema):
    return auth.api_dang_nhap(req)

# 4. Phục vụ giao diện Frontend (Static Files)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

# Nếu thư mục frontend tồn tại thì phục vụ từ frontend, nếu không phục vụ từ root
STATIC_DIR = FRONTEND_DIR if os.path.exists(FRONTEND_DIR) else BASE_DIR

@app.get("/")
def trang_chu():
    index_file = os.path.join(STATIC_DIR, "index.html")
    return FileResponse(index_file)

@app.get("/robots.txt")
def robots_file():
    robots_path = os.path.join(STATIC_DIR, "robots.txt")
    if os.path.exists(robots_path):
        return FileResponse(robots_path)
    return {"message": "User-agent: *\nDisallow: /api/"}

if os.path.exists(STATIC_DIR):
    app.mount("/", StaticFiles(directory=STATIC_DIR), name="static")

if __name__ == "__main__":
    import uvicorn
    print(f"[INFO] Khởi động Web Server Agribank tại: http://localhost:{settings.PORT}")
    print(f"[INFO] Tài liệu API Swagger UI tại: http://localhost:{settings.PORT}/docs")
    uvicorn.run("backend.app.main:app", host=settings.HOST, port=settings.PORT, reload=False)
