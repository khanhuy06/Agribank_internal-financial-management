# =========================================================
# DOCKERFILE CHO BACKEND FASTAPI (AGRIBANK FINANCIAL SYSTEM)
# =========================================================

FROM python:3.11-slim

WORKDIR /app

# Ngăn Python tạo file .pyc và in log trực tiếp ra console
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Cài đặt thư viện hệ thống cần thiết
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Cài đặt các thư viện Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy mã nguồn backend
COPY . .

EXPOSE 8000

# Khởi động máy chủ Uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
