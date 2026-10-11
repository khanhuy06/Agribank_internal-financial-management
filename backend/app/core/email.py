# =========================================================
# HỆ THỐNG QUẢN LÝ TÀI CHÍNH AGRIBANK (CHI NHÁNH HOÀN LÃO)
# MODULE EMAIL - GỬI THÔNG BÁO VÀ MÃ XÁC THỰC OTP
# =========================================================

import re
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
import json
import urllib.request
from backend.app.core.config import settings

def send_email_notification(to_email: str, subject: str, html_content: str) -> bool:
    """
    Gửi email qua:
    1. Resend API (nếu có mã RESEND_API_KEY bắt đầu bằng 're_...')
    2. Giao thức SMTP (nếu có SMTP_HOST & SMTP_USER)
    3. Dự phòng in ra Console (nếu chưa cấu hình dịch vụ ngoài)
    """
    # 1. Ưu tiên gửi qua Resend API nếu có key re_...
    if settings.RESEND_API_KEY:
        try:
            # Domain gửi: nếu chưa xác thực domain riêng thì dùng onboarding@resend.dev của Resend
            from_email = settings.EMAILS_FROM if "@" in settings.EMAILS_FROM and not "agribank.com.vn" in settings.EMAILS_FROM else "Agribank Hoàn Lão <onboarding@resend.dev>"
            payload = {
                "from": from_email,
                "to": [to_email],
                "subject": subject,
                "html": html_content
            }
            req = urllib.request.Request(
                "https://api.resend.com/emails",
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                    "Content-Type": "application/json",
                    "User-Agent": "Agribank-System"
                },
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=5) as resp:
                if resp.status in (200, 201):
                    print(f"[RESEND EMAIL] Đã gửi thư thành công tới {to_email} qua Resend API.")
                    return True
        except urllib.error.HTTPError as he:
            print(f"[RESEND HTTP ERROR {he.code}]: {he.read().decode('utf-8', errors='ignore')}")
            # Nếu tài khoản Resend giới hạn chỉ gửi tới owner email (khanhhuyphamnguyen1@gmail.com)
            if he.code == 403 and to_email != "khanhhuyphamnguyen1@gmail.com":
                try:
                    payload["to"] = ["khanhhuyphamnguyen1@gmail.com"]
                    payload["subject"] = f"[{to_email}] " + subject
                    req_fwd = urllib.request.Request(
                        "https://api.resend.com/emails",
                        data=json.dumps(payload).encode("utf-8"),
                        headers={
                            "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                            "Content-Type": "application/json",
                            "User-Agent": "Agribank-System"
                        },
                        method="POST"
                    )
                    with urllib.request.urlopen(req_fwd, timeout=5) as resp_fwd:
                        if resp_fwd.status in (200, 201):
                            print(f"[RESEND EMAIL] Đã gửi thư chuyển tiếp tới khanhhuyphamnguyen1@gmail.com thành công.")
                            return True
                except Exception as ex_fwd:
                    print(f"[RESEND CHUYỂN TIẾP THẤT BẠI]: {ex_fwd}")
        except Exception as e:
            print(f"[RESEND EMAIL LỖI] Gửi qua Resend thất bại ({e}), chuyển sang phương thức dự phòng...")

    # 2. Gửi qua SMTP truyền thống (Gmail, công ty)
    if settings.SMTP_HOST and settings.SMTP_USER:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = settings.EMAILS_FROM
            msg["To"] = to_email

            part = MIMEText(html_content, "html", "utf-8")
            msg.attach(part)

            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                server.starttls()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.EMAILS_FROM, to_email, msg.as_string())
            
            print(f"[SMTP EMAIL] Đã gửi thư thành công tới {to_email}")
            return True
        except Exception as e:
            print(f"[SMTP EMAIL LỖI] Không thể gửi email tới {to_email}: {e}")

    # 3. Chế độ phát triển & kiểm thử: In mô phỏng ra Console
    print("\n" + "="*60)
    print(f"[MÔ PHỎNG EMAIL] Gửi tới: {to_email}")
    print(f"[TIÊU ĐỀ]: {subject}")
    print(f"[NỘI DUNG]:\n{html_content}")
    print("="*60 + "\n")
    return True

def send_password_changed_email(to_email: str, ho_ten: str) -> bool:
    """Gửi email cảnh báo khi mật khẩu tài khoản vừa bị thay đổi."""
    now_str = datetime.now().strftime("%H:%M:%S ngày %d/%m/%Y")
    subject = "⚠️ Cảnh báo bảo mật: Mật khẩu Agribank của bạn vừa được thay đổi"
    html = f"""
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 8px; padding: 24px;">
        <div style="text-align: center; border-bottom: 2px solid #991b1b; padding-bottom: 12px; margin-bottom: 20px;">
            <h2 style="color: #991b1b; margin: 0;">AGRIBANK - CHI NHÁNH HOÀN LÃO</h2>
            <p style="color: #666; font-size: 13px; margin: 4px 0 0 0;">Hệ thống Quản lý Tài chính & Bảng lương Nội bộ</p>
        </div>
        <p>Xin chào <strong>{ho_ten}</strong>,</p>
        <p>Mật khẩu tài khoản ngân hàng của bạn (<strong>{to_email}</strong>) vừa được cập nhật thành công vào lúc <strong>{now_str}</strong>.</p>
        <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px; margin: 16px 0;">
            <p style="margin: 0; color: #991b1b; font-size: 14px;">
                <strong>LƯU Ý BẢO MẬT:</strong> Nếu bạn KHÔNG thực hiện thao tác này, tài khoản của bạn có thể đang bị xâm nhập. Vui lòng liên hệ ngay với Quản trị viên chi nhánh để khóa tài khoản khẩn cấp!
            </p>
        </div>
        <p style="color: #888; font-size: 12px; margin-top: 24px;">Thư này được gửi tự động từ hệ thống máy chủ Agribank. Vui lòng không phản hồi thư này.</p>
    </div>
    """
    return send_email_notification(to_email, subject, html)

def send_otp_email(to_email: str, ho_ten: str, otp_code: str) -> bool:
    """Gửi mã OTP 6 số để lấy lại mật khẩu."""
    subject = f"🔑 Mã xác thực OTP khôi phục mật khẩu Agribank: {otp_code}"
    html = f"""
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 8px; padding: 24px;">
        <div style="text-align: center; border-bottom: 2px solid #991b1b; padding-bottom: 12px; margin-bottom: 20px;">
            <h2 style="color: #991b1b; margin: 0;">AGRIBANK - CHI NHÁNH HOÀN LÃO</h2>
            <p style="color: #666; font-size: 13px; margin: 4px 0 0 0;">Cổng Khôi Phục Quyền Truy Cập Nội Bộ</p>
        </div>
        <p>Xin chào <strong>{ho_ten}</strong>,</p>
        <p>Bạn (hoặc ai đó) vừa yêu cầu khôi phục mật khẩu đăng nhập cho tài khoản: <strong>{to_email}</strong>.</p>
        <p>Dưới đây là mã xác thực OTP dùng một lần của bạn:</p>
        <div style="text-align: center; margin: 24px 0;">
            <span style="display: inline-block; background: #991b1b; color: #ffffff; font-size: 28px; font-weight: bold; letter-spacing: 6px; padding: 12px 30px; border-radius: 8px;">
                {otp_code}
            </span>
        </div>
        <p style="color: #ef4444; font-size: 13px;">* Mã này có hiệu lực trong vòng <strong>10 phút</strong>. Tuyệt đối không chia sẻ mã này cho bất kỳ ai khác.</p>
        <p style="color: #888; font-size: 12px; margin-top: 24px;">Nếu bạn không yêu cầu khôi phục mật khẩu, vui lòng bỏ qua email này.</p>
    </div>
    """
    return send_email_notification(to_email, subject, html)

def send_change_password_otp_email(to_email: str, ho_ten: str, otp_code: str) -> bool:
    """Gửi mã OTP 6 số để xác thực việc đổi mật khẩu tài khoản."""
    subject = f"🔐 Mã OTP xác thực ĐỔI MẬT KHẨU Agribank: {otp_code}"
    html = f"""
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 8px; padding: 24px;">
        <div style="text-align: center; border-bottom: 2px solid #7c1419; padding-bottom: 12px; margin-bottom: 20px;">
            <h2 style="color: #7c1419; margin: 0;">AGRIBANK - CHI NHÁNH HOÀN LÃO</h2>
            <p style="color: #666; font-size: 13px; margin: 4px 0 0 0;">Xác Thực An Toàn Đổi Mật Khẩu</p>
        </div>
        <p>Xin chào <strong>{ho_ten}</strong>,</p>
        <p>Hệ thống vừa nhận được yêu cầu <strong>ĐỔI MẬT KHẨU</strong> cho tài khoản ngân hàng của bạn: <strong>{to_email}</strong>.</p>
        <p>Để đảm bảo an toàn tuyệt đối, vui lòng nhập mã xác thực OTP 6 số dưới đây để xác nhận đổi mật khẩu:</p>
        <div style="text-align: center; margin: 24px 0;">
            <span style="display: inline-block; background: #7c1419; color: #ffffff; font-size: 28px; font-weight: bold; letter-spacing: 6px; padding: 12px 30px; border-radius: 8px;">
                {otp_code}
            </span>
        </div>
        <p style="color: #ef4444; font-size: 13px;">* Mã này có hiệu lực trong vòng <strong>10 phút</strong>. Tuyệt đối không chia sẻ mã này cho bất kỳ ai.</p>
        <p style="color: #888; font-size: 12px; margin-top: 24px;">Nếu bạn KHÔNG thực hiện yêu cầu đổi mật khẩu, vui lòng liên hệ ngay với Quản trị viên để kiểm tra an ninh tài khoản.</p>
    </div>
    """
    return send_email_notification(to_email, subject, html)

def send_demote_admin_otp_email(to_email: str, ho_ten: str, otp_code: str) -> bool:
    """Gửi mã OTP 6 số để xác thực việc tự hạ cấp quyền Quản trị viên về Nhân viên."""
    subject = f"⚠️ Mã OTP xác thực HẠ CẤP QUẢN TRỊ VIÊN Agribank: {otp_code}"
    html = f"""
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 8px; padding: 24px;">
        <div style="text-align: center; border-bottom: 2px solid #b45309; padding-bottom: 12px; margin-bottom: 20px;">
            <h2 style="color: #b45309; margin: 0;">AGRIBANK - CHI NHÁNH HOÀN LÃO</h2>
            <p style="color: #666; font-size: 13px; margin: 4px 0 0 0;">Xác Thực An Ninh: Tự Hạ Cấp Quản Trị Viên</p>
        </div>
        <p>Xin chào <strong>{ho_ten}</strong>,</p>
        <p>Bạn vừa thực hiện thao tác yêu cầu <strong>TỰ HẠ CẤP VAI TRÒ TÀI KHOẢN ({to_email})</strong> từ Quản trị viên (Admin) xuống Nhân viên thông thường.</p>
        <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px; margin: 16px 0;">
            <p style="margin: 0; color: #92400e; font-size: 13.5px;">
                <strong>CẢNH BÁO:</strong> Sau khi hạ cấp, bạn sẽ mất toàn bộ quyền quản trị người dùng, quản trị cột và chỉnh sửa dữ liệu tài chính.
            </p>
        </div>
        <p>Để hoàn tất xác nhận, vui lòng nhập mã OTP 6 chữ số dưới đây:</p>
        <div style="text-align: center; margin: 24px 0;">
            <span style="display: inline-block; background: #b45309; color: #ffffff; font-size: 28px; font-weight: bold; letter-spacing: 6px; padding: 12px 30px; border-radius: 8px;">
                {otp_code}
            </span>
        </div>
        <p style="color: #ef4444; font-size: 13px;">* Mã có hiệu lực trong vòng <strong>10 phút</strong>. Nếu không phải bạn thực hiện, vui lòng bỏ qua thư này.</p>
    </div>
    """
    return send_email_notification(to_email, subject, html)

def send_delete_account_otp_email(to_email: str, ho_ten: str, otp_code: str, target_email: str) -> bool:
    """Gửi mã OTP 6 số để xác thực việc xóa vĩnh viễn một tài khoản."""
    subject = f"🗑️ Mã OTP xác thực XÓA TÀI KHOẢN ({target_email}): {otp_code}"
    html = f"""
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 8px; padding: 24px;">
        <div style="text-align: center; border-bottom: 2px solid #dc2626; padding-bottom: 12px; margin-bottom: 20px;">
            <h2 style="color: #dc2626; margin: 0;">AGRIBANK - CHI NHÁNH HOÀN LÃO</h2>
            <p style="color: #666; font-size: 13px; margin: 4px 0 0 0;">Xác Thực An Ninh: Xóa Tài Khoản Khỏi Hệ Thống</p>
        </div>
        <p>Xin chào Quản trị viên <strong>{ho_ten}</strong>,</p>
        <p>Hệ thống nhận được yêu cầu <strong>XÓA VĨNH VIỄN TÀI KHOẢN</strong>:</p>
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 12px; margin: 12px 0;">
            <strong style="color: #991b1b; font-size: 15px;">{target_email}</strong>
        </div>
        <p>Thao tác này là không thể hoàn tác. Để xác nhận xóa tài khoản này, vui lòng nhập mã OTP:</p>
        <div style="text-align: center; margin: 24px 0;">
            <span style="display: inline-block; background: #dc2626; color: #ffffff; font-size: 28px; font-weight: bold; letter-spacing: 6px; padding: 12px 30px; border-radius: 8px;">
                {otp_code}
            </span>
        </div>
        <p style="color: #ef4444; font-size: 13px;">* Mã có hiệu lực trong vòng <strong>10 phút</strong>. Tuyệt đối không cung cấp cho người khác.</p>
    </div>
    """
    return send_email_notification(to_email, subject, html)

def check_email_mx(email: str) -> tuple:
    """
    Kiểm tra tính hợp lệ và sự tồn tại của tên miền email:
    1. Định dạng cú pháp RFC chuẩn.
    2. Kiểm tra bản ghi MX (Mail Exchange server) của tên miền qua DNS over HTTPS.
    """
    email_clean = email.strip().lower()
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(pattern, email_clean):
        return False, "Định dạng email không hợp lệ (Ví dụ hợp lệ: canbo@gmail.com)!"

    parts = email_clean.split("@")
    if len(parts) != 2:
        return False, "Địa chỉ email không hợp lệ!"

    domain = parts[1]
    
    # Cho phép tên miền nội bộ agribank.com.vn
    if domain == "agribank.com.vn":
        return True, ""

    # Kiểm tra MX record qua DNS over HTTPS của Google
    try:
        url = f"https://dns.google/resolve?name={domain}&type=MX"
        req = urllib.request.Request(url, headers={"Accept": "application/dns-json", "User-Agent": "Agribank-System"})
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read().decode())
            if data.get("Status") != 0 or "Answer" not in data:
                return False, f"Tên miền email '@{domain}' không tồn tại hoặc không thể nhận thư (thiếu bản ghi MX)!"
    except Exception as e:
        print(f"[DNS CHECK WARN] Không thể tra cứu MX cho {domain}: {e}")
        if "." not in domain or len(domain.split(".")[-1]) < 2:
            return False, f"Tên miền email '@{domain}' không hợp lệ!"

    return True, ""

def send_account_registration_otp_email(to_email: str, ho_ten: str, otp_code: str) -> bool:
    """Gửi mã OTP 6 số để xác thực email tồn tại khi đăng ký hoặc tạo tài khoản mới."""
    subject = f"✨ Mã OTP xác thực KÍCH HOẠT TÀI KHOẢN Agribank: {otp_code}"
    html = f"""
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 8px; padding: 24px;">
        <div style="text-align: center; border-bottom: 2px solid #047857; padding-bottom: 12px; margin-bottom: 20px;">
            <h2 style="color: #047857; margin: 0;">AGRIBANK - CHI NHÁNH HOÀN LÃO</h2>
            <p style="color: #666; font-size: 13px; margin: 4px 0 0 0;">Xác Thực Kích Hoạt Tài Khoản Mới</p>
        </div>
        <p>Xin chào <strong>{ho_ten}</strong>,</p>
        <p>Hệ thống nhận được yêu cầu <strong>KÍCH HOẠT / TẠO TÀI KHOẢN MỚI</strong> với địa chỉ email: <strong>{to_email}</strong>.</p>
        <p>Để xác nhận email này đang hoạt động thực tế và có thể nhận thông báo bảo mật từ ngân hàng, vui lòng nhập mã xác thực OTP dưới đây:</p>
        <div style="text-align: center; margin: 24px 0;">
            <span style="display: inline-block; background: #047857; color: #ffffff; font-size: 28px; font-weight: bold; letter-spacing: 6px; padding: 12px 30px; border-radius: 8px;">
                {otp_code}
            </span>
        </div>
        <p style="color: #ef4444; font-size: 13px;">* Mã này có hiệu lực trong vòng <strong>10 phút</strong>. Tuyệt đối không chia sẻ mã này cho bất kỳ ai.</p>
        <p style="color: #888; font-size: 12px; margin-top: 24px;">Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua thư này.</p>
    </div>
    """
    return send_email_notification(to_email, subject, html)

