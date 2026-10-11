# =========================================================
# HỆ THỐNG QUẢN LÝ TÀI CHÍNH AGRIBANK (CHI NHÁNH HOÀN LÃO)
# MODULE EMAIL - GỬI THÔNG BÁO VÀ MÃ XÁC THỰC OTP
# =========================================================

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from backend.app.core.config import settings

def send_email_notification(to_email: str, subject: str, html_content: str) -> bool:
    """
    Gửi email qua giao thức SMTP.
    Nếu chưa cấu hình tài khoản SMTP, hệ thống sẽ in trực tiếp nội dung email ra Console để nhà phát triển xem mã OTP.
    """
    if not settings.SMTP_HOST or not settings.SMTP_USER:
        print("\n" + "="*60)
        print(f"[MÔ PHỎNG EMAIL] Gửi tới: {to_email}")
        print(f"[TIÊU ĐỀ]: {subject}")
        print(f"[NỘI DUNG]:\n{html_content}")
        print("="*60 + "\n")
        return True

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
        
        print(f"[EMAIL] Đã gửi thư thành công tới {to_email}")
        return True
    except Exception as e:
        print(f"[EMAIL LỖI] Không thể gửi email tới {to_email}: {e}")
        return False

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
