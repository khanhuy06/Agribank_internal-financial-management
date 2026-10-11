# HỆ THỐNG QUẢN LÝ TÀI CHÍNH & BẢNG LƯƠNG - AGRIBANK CHI NHÁNH HOÀN LÃO
> **Phiên bản 3.0.0 (Enterprise Edition)** — Hỗ trợ PostgreSQL, Phân quyền RBAC, Bảo mật JWT & Bcrypt Salt, Cổng Đăng Ký Linh Hoạt, OTP Email và Đóng gói Docker.

---

## 📌 1. THÔNG TIN BÀN GIAO CHO KHÁCH HÀNG

Khi bàn giao trang web cho Khách hàng (Giám đốc chi nhánh / Trưởng phòng kế toán), hãy gửi cho họ thông tin sau:

* **Đường dẫn truy cập:** `http://localhost:8000` *(hoặc tên miền / link Render của bạn)*
* **Tài khoản Quản Trị Viên (SuperAdmin) ban đầu:**
  * **Email / Tên đăng nhập:** `admin@agribank.com.vn` *(hoặc có thể gõ `user`)*
  * **Mật khẩu ban đầu:** `Agribank@2026`
  * **Vai trò:** Quản trị viên (Admin)

### 👉 Quy trình khách hàng tự bảo mật tài khoản khi nhận bàn giao:
1. Khách hàng đăng nhập bằng tài khoản và mật khẩu ban đầu ở trên.
2. Nhìn lên góc trên bên phải màn hình, bấm vào nút **`🔑 Đổi Mật Khẩu`**.
3. Nhập mật khẩu cũ (`Agribank@2026`) và tự đặt mật khẩu mới bí mật của riêng họ.
4. Mật khẩu mới sẽ được băm bằng thuật toán **Bcrypt kèm Salt ngẫu nhiên 12 rounds** và lưu an toàn vào cơ sở dữ liệu. Ngay cả lập trình viên hay người quản lý máy chủ cũng **không thể xem được mật khẩu** của khách hàng.

---

## ⚡ 2. CÁC TÍNH NĂNG ĐẶC BIỆT CỦA HỆ THỐNG

### 🚪 Cơ chế "Công tắc mở cổng Đăng ký" (Registration Gateway Switch)
* **Bình thường:** Cổng đăng ký **ĐÓNG CHẶT** để đảm bảo an ninh, người lạ không thể tự tạo tài khoản.
* **Khi có đợt tiếp nhận nhân viên mới (100 người):**
  1. Admin đăng nhập vào, bấm nút **`👥 Quản Lý Tài Khoản`**.
  2. Bấm nút **`Gạt Công Tắc`** ➔ Cổng chuyển sang trạng thái **`🟢 ĐANG MỞ`**.
  3. Ngoài màn hình đăng nhập lập tức xuất hiện tab **"Đăng Ký Mới"**.
  4. 100 nhân viên tự vào điền Email, Họ tên và tự đặt Mật khẩu của họ (tất cả tài khoản tự đăng ký đều tự động nhận quyền **Nhân viên chỉ xem**).
  5. Sau khi nhân viên đăng ký xong, Admin chỉ cần bấm **`Gạt Công Tắc`** lần nữa ➔ Cổng chuyển thành **`🔴 ĐANG KHÓA`**. Nút đăng ký biến mất hoàn toàn!

### 👥 Phân quyền vai trò (Role-Based Access Control - RBAC)
* **Nhân viên (Chỉ xem - Read-only):**
  * Đăng nhập vào chỉ xem được bảng lương của các tháng, tìm kiếm và xuất file Excel.
  * Toàn bộ nút: `+ Thêm giao dịch`, `+ Thêm cột`, `Nhập Excel`, `✏️ Sửa`, `🗑️ Xóa` bị **ẩn hoàn toàn**.
  * Chặn bảo mật ở Backend: Kể cả dùng F12 hay Postman cố tình gửi lệnh thì máy chủ vẫn chặn đứng (`403 Forbidden`).
* **Quản trị viên (Admin):**
  * Toàn quyền thêm, sửa, xóa lương; thêm/xóa cột động; nhập/xuất file Excel.
  * Quản lý danh sách tài khoản: Xem danh sách theo Email, Họ tên, Ngày tạo.
  * Có nút bấm: **`[Thăng Chức Admin]`** hoặc **`[Hạ Quyền Nhân Viên]`** cạnh từng người.
  * Có nút: **`🗑️ Xóa Tài Khoản`** (xóa là người đó không thể đăng nhập được nữa).

### 🔑 Quên mật khẩu tự động qua Email (Self-Service OTP)
* **Không cần hỏi Admin:** Cả Admin và Nhân viên khi quên mật khẩu:
  1. Bấm dòng chữ **`Quên mật khẩu?`** ngoài màn hình đăng nhập.
  2. Nhập Email của mình vào ➔ Hệ thống tự động bắn một **Mã xác thực OTP 6 số** về hòm thư Email (hiệu lực 10 phút).
  3. Người dùng nhập mã OTP và tự gõ mật khẩu mới để lấy lại quyền truy cập một cách riêng tư.
* **Email cảnh báo bảo mật:** Bất kỳ khi nào có ai đổi mật khẩu thành công, hệ thống tự động gửi email cảnh báo về hòm thư người đó.

---

## 🛡️ 3. TIÊU CHUẨN BẢO MẬT ĐÃ ĐƯỢC NÂNG CẤP
1. **Chống can thiệp F12:** Toàn bộ API lấy dữ liệu và sửa đổi đều được bảo vệ bằng **Vé thông hành JWT (Bearer Token)**. Người lạ có bấm F12 xóa CSS thì máy chủ cũng từ chối trả dữ liệu (`401 Unauthorized`).
2. **Bcrypt Password Hashing with Salt:** Sử dụng `bcrypt.gensalt(12)` sinh muối ngẫu nhiên mỗi lần băm, vô hiệu hóa hoàn toàn các cuộc tấn công tra từ điển Rainbow Table.
3. **Zero Password Visibility:** Tuyệt đối không ai (kể cả Admin) có thể nhìn thấy mật khẩu của người khác.
4. **Chống SQL Injection (SQLi):** 100% câu lệnh truy vấn đều sử dụng tham số hóa (`Parameterized Queries`).
5. **Chống XSS:** Dữ liệu người dùng nhập đều được xử lý bằng `textContent` an toàn, ngăn chặn tiêm mã độc Javascript.
6. **Bảo vệ Robots.txt:** Đã cài đặt [robots.txt](frontend/robots.txt) chặn Googlebot và các công cụ tìm kiếm thu thập thông tin API hay tài liệu nội bộ.

---

## 📁 4. CẤU TRÚC THƯ MỤC CHUẨN MODULE HÓA

```text
Agribank/
├── backend/                        # Thư mục mã nguồn Backend (FastAPI)
│   ├── app/
│   │   ├── api/                    # Các Router API phân tách rõ ràng
│   │   │   ├── auth.py             # Đăng nhập, đăng ký, OTP, đổi mật khẩu
│   │   │   ├── users.py            # Admin quản lý tài khoản & phân quyền
│   │   │   ├── system.py           # Công tắc mở cổng & kiểm tra database
│   │   │   ├── cot.py              # Thêm/xóa cột linh hoạt
│   │   │   └── luong.py            # Bảng lương & tính toán tài chính
│   │   ├── core/                   # Cốt lõi hệ thống
│   │   │   ├── config.py           # Đọc biến môi trường an toàn
│   │   │   ├── security.py         # Bcrypt băm muối & JWT xác thực
│   │   │   └── email.py            # Dịch vụ gửi email thông báo & OTP
│   │   ├── db/                     # Cơ sở dữ liệu
│   │   │   ├── connection.py       # Kết nối PostgreSQL / Turso / SQLite
│   │   │   └── crud.py             # Thao tác đọc/ghi chống SQLi
│   │   ├── schemas/                # Kiểm soát kiểu dữ liệu Pydantic
│   │   └── main.py                 # FastAPI Application Entrypoint
│   ├── Dockerfile                  # Đóng gói thùng chứa Backend
│   └── requirements.txt            # Danh sách thư viện Python
├── frontend/                       # Thư mục giao diện Web (SPA)
│   ├── index.html                  # Giao diện chính Agribank
│   ├── style.css                   # Định dạng nhận diện thương hiệu
│   ├── script.js                   # Logic giao diện & gọi API JWT
│   ├── logo_agribank.png           # Logo chuẩn Agribank
│   └── robots.txt                  # Chặn bot tìm kiếm
├── docker-compose.yml              # Đóng gói thùng Web và thùng PostgreSQL độc lập
├── .env.example                    # Mẫu cấu hình môi trường
├── .gitignore                      # Tuyệt đối không đẩy file mật lên GitHub
├── main.py                         # Root Runner chạy trực tiếp
└── README.md                       # Tài liệu hướng dẫn này
```

---

## 🚀 5. HƯỚNG DẪN KHỞI CHẠY HỆ THỐNG

### Cách 1: Chạy trực tiếp trên máy tính cá nhân (Development)
```bash
# 1. Cài đặt các thư viện cần thiết
pip install -r requirements.txt

# 2. Khởi động Web Server
python main.py
```
* Mở trình duyệt truy cập: `http://localhost:8000`
* Xem tài liệu API tự động tại: `http://localhost:8000/docs`

---

### Cách 2: Triển khai bằng Docker Compose lên máy chủ VPS (Khuyên Dùng Cho Production)
Hệ thống đã được thiết kế **tách riêng 2 thùng container độc lập**:
* **Thùng `db` (PostgreSQL 15):** Có vùng lưu trữ ổ cứng riêng biệt (`postgres_data`). Kể cả khi bạn cập nhật code hay nhân bản thêm 10 thùng web thì dữ liệu kế toán **không bao giờ bị mất**.
* **Thùng `backend`:** Chạy ứng dụng web FastAPI phục vụ người dùng.

Để khởi chạy trên VPS, bạn chỉ cần gõ đúng 1 dòng lệnh:
```bash
docker compose up -d
```
* Kiểm tra các thùng đang chạy: `docker compose ps`
* Xem nhật ký hoạt động: `docker compose logs -f`
* Dừng hệ thống an toàn: `docker compose down`
