# =========================================================
# HỆ THỐNG QUẢN LÝ TÀI CHÍNH AGRIBANK (CHI NHÁNH HOÀN LÃO)
# PYDANTIC SCHEMAS - KIỂM SOÁT ĐỊNH DẠNG DỮ LIỆU ĐẦU VÀO
# =========================================================

from pydantic import BaseModel, EmailStr, Field
from typing import Dict, Any, Optional, Literal

# --- 1. XÁC THỰC & TÀI KHOẢN ---

class DangNhapSchema(BaseModel):
    email: str = Field(..., description="Email đăng nhập hoặc username")
    password: str = Field(..., min_length=4, description="Mật khẩu tài khoản")

class DangKySchema(BaseModel):
    email: str = Field(..., description="Địa chỉ email cá nhân / công vụ")
    ho_ten: str = Field(..., min_length=2, description="Họ và tên cán bộ")
    password: str = Field(..., min_length=6, description="Mật khẩu tối thiểu 6 ký tự")

class DoiTenSchema(BaseModel):
    ho_ten: str = Field(..., min_length=2, max_length=100, description="Họ và tên / Tên tài khoản mới")

class DoiMatKhauSchema(BaseModel):
    mat_khau_cu: str = Field(..., description="Mật khẩu hiện tại")
    mat_khau_moi: str = Field(..., min_length=6, description="Mật khẩu mới tối thiểu 6 ký tự")
    otp_code: str = Field(..., min_length=6, max_length=6, description="Mã OTP 6 số xác thực gửi về email")

class QuenMatKhauRequestSchema(BaseModel):
    email: str = Field(..., description="Email đã đăng ký để nhận mã OTP")

class DatLaiMatKhauSchema(BaseModel):
    email: str = Field(..., description="Email tài khoản cần đặt lại mật khẩu")
    otp_code: str = Field(..., min_length=6, max_length=6, description="Mã OTP 6 số nhận qua email")
    mat_khau_moi: str = Field(..., min_length=6, description="Mật khẩu mới")

class DoiQuyenSchema(BaseModel):
    role: Literal["admin", "nhan_vien"] = Field(..., description="Vai trò mới của người dùng")

class TaoTaiKhoanThuCongSchema(BaseModel):
    email: str = Field(..., min_length=3, description="Email tài khoản mới")
    ho_ten: str = Field(..., min_length=2, description="Họ và tên người dùng")
    mat_khau: str = Field(..., min_length=6, description="Mật khẩu khởi tạo ban đầu (tối thiểu 6 ký tự)")
    role: Literal["admin", "nhan_vien"] = Field("nhan_vien", description="Vai trò tài khoản: admin hoặc nhan_vien")

# --- 2. CÔNG TẮC HỆ THỐNG ---

class CongTacDangKySchema(BaseModel):
    cho_phep: bool = Field(..., description="Trạng thái mở (True) hoặc đóng (False) cổng đăng ký")

# --- 3. CẤU HÌNH CỘT ---

class CotMoiSchema(BaseModel):
    id: str = Field(..., description="Mã định danh cột")
    ten: str = Field(..., min_length=1, description="Tên cột hiển thị")
    kieu: Literal["so", "chu"] = Field(..., description="'so' (tiền tệ VND) hoặc 'chu' (văn bản)")

# --- 4. BẢNG LƯƠNG & TÀI CHÍNH ---

class BanGhiLuongSchema(BaseModel):
    nam: int = 2026
    thang: int = 1
    ma_nv: str = Field(..., min_length=1, description="Mã nhân viên / ID bắt buộc")
    ho_ten: Optional[str] = ""
    luong_thang: Optional[float] = 0.0
    luong_thuong: Optional[float] = 0.0
    cot_tuy_chinh: Optional[Dict[str, Any]] = {}

class CapNhatLuongSchema(BaseModel):
    ma_nv: str = Field(..., min_length=1)
    ho_ten: Optional[str] = ""
    luong_thang: Optional[float] = 0.0
    luong_thuong: Optional[float] = 0.0
    cot_tuy_chinh: Optional[Dict[str, Any]] = {}
