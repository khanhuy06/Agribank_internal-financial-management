# =========================================================
# HỆ THỐNG QUẢN LÝ TÀI CHÍNH AGRIBANK (CHI NHÁNH HOÀN LÃO)
# API ROUTER: QUẢN LÝ TÀI KHOẢN & PHÂN QUYỀN (DÀNH CHO ADMIN)
# =========================================================

import random
from fastapi import APIRouter, HTTPException, Path, Query, Depends, Body
from typing import List, Dict, Any, Optional
from backend.app.schemas.schemas import DoiQuyenSchema, TaoTaiKhoanThuCongSchema, XacNhanOtpSchema
from backend.app.db import crud
from backend.app.core.security import require_admin, hash_password, create_access_token
from backend.app.core.email import send_demote_admin_otp_email, send_delete_account_otp_email

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

    if user["id"] == admin["id"]:
        raise HTTPException(status_code=400, detail="Vui lòng dùng tính năng 'Tự Hạ Cấp' kèm OTP để hạ quyền chính mình!")

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

@router.post("/yeu-cau-otp-ha-quyen")
def api_yeu_cau_otp_ha_quyen(admin: dict = Depends(require_admin)):
    """
    BƯỚC 1 TỰ HẠ CẤP: Gửi mã OTP 6 số về email của Admin để chuẩn bị xác thực tự hạ cấp.
    KIỂM TRA AN TOÀN: Chặn ngay nếu hệ thống chỉ còn đúng 1 Admin duy nhất!
    """
    so_admin = crud.count_admins()
    if so_admin <= 1:
        raise HTTPException(
            status_code=400,
            detail="Hệ thống bắt buộc phải có ít nhất 1 Quản trị viên! Bạn là Admin duy nhất nên không thể hạ cấp."
        )

    otp_code = f"{random.randint(100000, 999999)}"
    crud.save_otp(admin["email"], otp_code, expire_minutes=10)
    send_demote_admin_otp_email(admin["email"], admin.get("ho_ten", "Quản trị viên"), otp_code)
    return {
        "success": True,
        "message": f"Mã OTP 6 số xác thực hạ cấp quyền đã được gửi về email {admin['email']}!"
    }

@router.post("/tu-ha-quyen")
def api_tu_ha_quyen_admin(
    req: XacNhanOtpSchema,
    admin: dict = Depends(require_admin)
):
    """
    BƯỚC 2 TỰ HẠ CẤP: Quản trị viên nhập mã OTP 6 số để xác nhận từ bỏ quyền Admin.
    BẢO MẬT AN TOÀN: 
    Nếu hệ thống chỉ còn đúng 1 Admin duy nhất, chặn thao tác để tránh hệ thống bị 'mồ côi' Admin!
    """
    so_admin = crud.count_admins()
    if so_admin <= 1:
        raise HTTPException(
            status_code=400,
            detail="Không thể tự hạ cấp! Bạn là Quản trị viên (Admin) duy nhất còn lại của hệ thống. Vui lòng cấp quyền Admin cho tài khoản khác trước khi từ bỏ quyền."
        )

    hop_le = crud.verify_and_consume_otp(admin["email"], req.otp_code)
    if not hop_le:
        raise HTTPException(
            status_code=400,
            detail="Mã OTP xác thực không chính xác hoặc đã hết hạn (hiệu lực 10 phút)!"
        )

    crud.update_user_role(admin["id"], "nhan_vien")
    user = crud.get_user_by_id(admin["id"])
    new_token = create_access_token(data={
        "id": user["id"],
        "email": user["email"],
        "ho_ten": user["ho_ten"],
        "role": "nhan_vien"
    })
    return {
        "success": True,
        "message": "Bạn đã tự hạ cấp về tài khoản người dùng thông thường thành công.",
        "access_token": new_token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "ho_ten": user["ho_ten"],
            "role": "nhan_vien"
        }
    }

@router.post("/{user_id}/yeu-cau-otp-xoa")
def api_yeu_cau_otp_xoa_tai_khoan(
    user_id: int = Path(..., description="ID của tài khoản muốn xóa"),
    admin: dict = Depends(require_admin)
):
    """
    BƯỚC 1 XÓA TÀI KHOẢN: Gửi mã OTP 6 số về email của Admin trước khi thực hiện xóa.
    """
    target = crud.get_user_by_id(user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản người dùng cần xóa!")

    so_admin = crud.count_admins()
    if target.get("role") == "admin":
        if so_admin <= 1:
            raise HTTPException(
                status_code=400,
                detail="Không thể xóa! Đây là Quản trị viên (Admin) duy nhất còn lại của hệ thống."
            )
        la_tai_khoan_ban_giao = (target["email"].strip().lower() == "admin@agribank.com.vn")
        la_chinh_minh = (target["id"] == admin["id"])
        if not la_tai_khoan_ban_giao and not la_chinh_minh:
            raise HTTPException(
                status_code=403,
                detail="Bảo mật cấp cao: Không thể xóa tài khoản của Quản trị viên (Admin) chính thức khác!"
            )
        if la_tai_khoan_ban_giao:
            return {
                "success": True,
                "message": "Tài khoản bàn giao không cần mã OTP, Quản trị viên có thể xóa trực tiếp!",
                "target_email": target["email"],
                "skip_otp": True
            }

    otp_code = f"{random.randint(100000, 999999)}"
    crud.save_otp(admin["email"], otp_code, expire_minutes=10)
    send_delete_account_otp_email(
        admin["email"], 
        admin.get("ho_ten", "Quản trị viên"), 
        otp_code, 
        target["email"]
    )
    return {
        "success": True,
        "message": f"Mã OTP 6 số xác thực xóa tài khoản đã được gửi tới email {admin['email']}!",
        "target_email": target["email"]
    }

@router.delete("/{user_id}")
def api_xoa_tai_khoan(
    user_id: int = Path(..., description="ID của tài khoản cần xóa"),
    otp_code: Optional[str] = Query(None, description="Mã OTP 6 số xác thực gửi về email Admin"),
    req: Optional[XacNhanOtpSchema] = Body(None),
    admin: dict = Depends(require_admin)
):
    """
    XÓA TÀI KHOẢN:
    - Nếu là tài khoản khởi tạo bàn giao (admin@agribank.com.vn): Cho phép Admin xóa trực tiếp không cần OTP.
    - Với các tài khoản khác: Bắt buộc mã OTP 6 số gửi về email của Admin để xác thực.
    """
    user = crud.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản người dùng!")

    so_admin_hien_tai = crud.count_admins()
    la_tai_khoan_ban_giao = (user["email"].strip().lower() == "admin@agribank.com.vn")
    la_chinh_minh = (user["id"] == admin["id"])

    if user.get("role") == "admin":
        if so_admin_hien_tai <= 1:
            raise HTTPException(
                status_code=400,
                detail="Không thể xóa! Đây là Quản trị viên (Admin) duy nhất còn lại của hệ thống."
            )
        if not la_tai_khoan_ban_giao and not la_chinh_minh:
            raise HTTPException(
                status_code=403,
                detail="Bảo mật cấp cao: Không thể xóa tài khoản của Quản trị viên (Admin) chính thức khác!"
            )

    # Nếu KHÔNG PHẢI tài khoản bàn giao, bắt buộc phải có OTP xác thực
    if not la_tai_khoan_ban_giao:
        ma_otp = (req.otp_code if req else None) or otp_code
        if not ma_otp:
            raise HTTPException(
                status_code=400,
                detail="Bắt buộc phải nhập mã OTP 6 số để xác nhận xóa tài khoản!"
            )

        hop_le = crud.verify_and_consume_otp(admin["email"], ma_otp.strip())
        if not hop_le:
            raise HTTPException(
                status_code=400,
                detail="Mã OTP xác thực không chính xác hoặc đã hết hạn (hiệu lực 10 phút)!"
            )

    crud.delete_user(user_id)
    return {
        "success": True,
        "message": f"Đã xóa tài khoản '{user['email']}' thành công!"
    }
