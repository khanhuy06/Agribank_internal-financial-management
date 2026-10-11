# =========================================================
# HỆ THỐNG QUẢN LÝ TÀI CHÍNH AGRIBANK (CHI NHÁNH HOÀN LÃO)
# API ROUTER: XÁC THỰC, ĐĂNG NHẬP, ĐĂNG KÝ, QUÊN & ĐỔI MẬT KHẨU
# =========================================================

import random
from fastapi import APIRouter, HTTPException, status, Depends
from backend.app.schemas.schemas import (
    DangNhapSchema, DangKySchema, DoiMatKhauSchema, DoiTenSchema,
    QuenMatKhauRequestSchema, DatLaiMatKhauSchema
)
from backend.app.db import crud
from backend.app.core.security import (
    hash_password, verify_password, create_access_token, get_current_user
)
from backend.app.core.email import send_password_changed_email, send_otp_email, send_change_password_otp_email

router = APIRouter(prefix="/api/auth", tags=["Xác thực & Bảo mật"])

@router.post("/send-change-password-otp")
def api_gui_otp_doi_mat_khau(current_user: dict = Depends(get_current_user)):
    """
    Gửi mã OTP 6 số tới email của người dùng đang đăng nhập để xác thực việc đổi mật khẩu.
    Bảo mật ngân hàng 2 lớp (2FA): Kẻ xấu dù biết mật khẩu cũ cũng không thể đổi nếu không có OTP email.
    """
    user = crud.get_user_by_id(current_user["id"])
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản!")

    otp_code = f"{random.randint(100000, 999999)}"
    crud.save_otp(user["email"], otp_code, expire_minutes=10)
    send_change_password_otp_email(user["email"], user.get("ho_ten", "Cán bộ"), otp_code)

    parts = user["email"].split("@")
    masked = f"{parts[0][:2]}***@{parts[1]}" if len(parts[0]) > 2 else user["email"]

    return {
        "success": True,
        "message": f"Mã xác thực OTP 6 số đã được gửi tới email '{masked}'. Vui lòng kiểm tra hộp thư!"
    }

@router.post("/doi-mat-khau")
def api_doi_mat_khau(req: DoiMatKhauSchema, current_user: dict = Depends(get_current_user)):
    """
    Người dùng tự đổi mật khẩu cá nhân.
    BẢO MẬT NGÂN HÀNG (2FA):
    1. Xác thực mật khẩu cũ.
    2. Xác thực mã OTP 6 số gửi về email chính chủ.
    3. Băm Bcrypt mật khẩu mới.
    4. Gửi email cảnh báo bảo mật.
    """
    user = crud.get_user_by_id(current_user["id"])
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản!")

    # 1. Xác thực mật khẩu cũ
    if not verify_password(req.mat_khau_cu, user["hashed_password"]):
        raise HTTPException(status_code=400, detail="Mật khẩu hiện tại không chính xác!")

    # 2. Bắt buộc kiểm tra mã OTP xác thực qua email
    if not req.otp_code or not crud.verify_and_consume_otp(user["email"], req.otp_code.strip()):
        raise HTTPException(status_code=400, detail="Mã OTP xác thực email không chính xác hoặc đã hết hạn (10 phút)!")

    # 3. Băm mật khẩu mới và lưu
    new_hashed = hash_password(req.mat_khau_moi)
    crud.update_user_password(user["id"], new_hashed)

    # 4. Gửi email thông báo bảo mật
    send_password_changed_email(user["email"], user["ho_ten"])

    return {
        "success": True,
        "message": "Đổi mật khẩu thành công! Email thông báo an ninh đã được gửi tới hòm thư của bạn."
    }

@router.put("/doi-ten")
def api_doi_ten_tai_khoan(req: DoiTenSchema, current_user: dict = Depends(get_current_user)):
    """
    Người dùng tự đổi tên tài khoản / họ tên hiển thị.
    """
    user = crud.get_user_by_id(current_user["id"])
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản người dùng!")

    new_name = req.ho_ten.strip()
    if len(new_name) < 2:
        raise HTTPException(status_code=400, detail="Tên tài khoản phải có độ dài từ 2 ký tự trở lên!")

    crud.update_user_name(user["id"], new_name)
    return {
        "success": True,
        "message": "Cập nhật tên tài khoản thành công!",
        "ho_ten": new_name
    }

@router.post("/login")
def api_dang_nhap(req: DangNhapSchema):
    """
    Xác thực đăng nhập và cấp vé thông hành JWT.
    Chống lại F12: Mọi truy cập sau đó đều bắt buộc phải kèm vé này.
    """
    user = crud.get_user_by_email(req.email)
    
    # Hỗ trợ đăng nhập bằng username 'user' nếu là SuperAdmin
    if not user and req.email.strip().lower() == "user":
        user = crud.get_user_by_email("admin@agribank.com.vn")

    if not user or not verify_password(req.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email hoặc mật khẩu không chính xác!"
        )

    if not user.get("is_active", 1):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản này đã bị Quản trị viên vô hiệu hóa!"
        )

    # Cấp JWT Token có chứa Email và Vai trò (Role)
    payload = {
        "sub": user["email"],
        "id": user["id"],
        "role": user["role"],
        "ho_ten": user["ho_ten"]
    }
    token = create_access_token(payload)

    return {
        "success": True,
        "message": "Đăng nhập thành công!",
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "ho_ten": user["ho_ten"],
            "role": user["role"]
        }
    }

@router.post("/register")
def api_dang_ky(req: DangKySchema):
    """
    Đăng ký tài khoản tự động (Chỉ hoạt động khi Admin BẬT cổng đăng ký).
    Toàn bộ người tự đăng ký sẽ nhận quyền 'nhan_vien' (chỉ xem).
    """
    # 1. Kiểm tra công tắc hệ thống
    if not crud.get_registration_status():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cổng đăng ký hiện đang ĐÓNG. Vui lòng liên hệ Quản trị viên chi nhánh để được mở cổng!"
        )

    # 2. Kiểm tra email đã tồn tại chưa
    if crud.get_user_by_email(req.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Địa chỉ Email này đã được đăng ký trên hệ thống!"
        )

    # 3. Băm mật khẩu bằng Bcrypt Salt ngẫu nhiên
    hashed = hash_password(req.password)
    new_id = crud.create_user(
        email=req.email,
        ho_ten=req.ho_ten,
        hashed_password=hashed,
        role="nhan_vien"  # Luôn mặc định là nhân viên an toàn
    )

    return {
        "success": True,
        "message": "Đăng ký tài khoản thành công! Bạn có thể đăng nhập ngay bây giờ.",
        "user_id": new_id
    }

@router.post("/forgot-password")
def api_yeu_cau_quen_mat_khau(req: QuenMatKhauRequestSchema):
    """
    Quên mật khẩu tự động: Bất kỳ ai nhập đúng Email sẽ nhận được mã OTP 6 số.
    """
    user = crud.get_user_by_email(req.email)
    if not user:
        # Bảo mật: Không thông báo email không tồn tại để tránh rò rỉ danh sách email
        return {
            "success": True,
            "message": "Nếu email tồn tại trong hệ thống, mã xác thực OTP 6 số đã được gửi tới hòm thư của bạn!"
        }

    # Sinh mã OTP 6 chữ số ngẫu nhiên
    otp_code = str(random.randint(100000, 999999))
    crud.save_otp(user["email"], otp_code, expire_minutes=10)

    # Gửi mã OTP qua email
    send_otp_email(user["email"], user["ho_ten"], otp_code)

    return {
        "success": True,
        "message": "Mã xác thực OTP 6 số đã được gửi tới hòm thư của bạn. Vui lòng kiểm tra hộp thư đến (hoặc hòm thư rác)!"
    }

@router.post("/reset-password")
def api_dat_lai_mat_khau(req: DatLaiMatKhauSchema):
    """
    Nhập mã OTP 6 số để tự đặt lại mật khẩu mới mà không cần nhờ Admin.
    """
    user = crud.get_user_by_email(req.email)
    if not user:
        raise HTTPException(status_code=404, detail="Tài khoản không tồn tại!")

    # Kiểm tra mã OTP
    is_valid = crud.verify_and_consume_otp(req.email, req.otp_code)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mã OTP không chính xác hoặc đã hết hạn hiệu lực (10 phút)!"
        )

    # Băm mật khẩu mới và cập nhật
    new_hashed = hash_password(req.mat_khau_moi)
    crud.update_user_password(user["id"], new_hashed)

    # Gửi email xác nhận
    send_password_changed_email(user["email"], user["ho_ten"])

    return {
        "success": True,
        "message": "Đặt lại mật khẩu thành công! Bạn có thể sử dụng mật khẩu mới để đăng nhập."
    }
