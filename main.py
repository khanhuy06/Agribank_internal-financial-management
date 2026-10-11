# =========================================================
# HỆ THỐNG QUẢN LÝ TÀI CHÍNH AGRIBANK (CHI NHÁNH HOÀN LÃO)
# ROOT RUNNER - ENTRYPOINT TƯƠNG THÍCH NGƯỢC CHO RENDER & VPS
# =========================================================

import os
import sys

# Thêm đường dẫn gốc vào sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import ứng dụng FastAPI từ kiến trúc module backend mới
from backend.app.main import app

if __name__ == "__main__":
    import uvicorn
    from backend.app.core.config import settings
    port = int(os.environ.get("PORT", settings.PORT))
    print(f"[INFO] Khởi động Web Server Agribank tại: http://localhost:{port}")
    print(f"[INFO] Tài liệu API Swagger UI tại: http://localhost:{port}/docs")
    uvicorn.run("backend.app.main:app", host=settings.HOST, port=port, reload=False)
