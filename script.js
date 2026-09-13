// =========================================================
// HỆ THỐNG QUẢN LÝ TÀI CHÍNH AGRIBANK (CHI NHÁNH HOÀN LÃO)
// JAVASCRIPT ĐIỀU HÀNH GIAO DIỆN SPA & KẾT NỐI API FASTAPI
// =========================================================

document.addEventListener("DOMContentLoaded", function() {
    
    // Đường dẫn API (Tự động thích ứng nếu chạy qua server FastAPI hay mở file trực tiếp)
    const API_URL = window.location.origin.startsWith("http") ? "" : "http://localhost:8000";

    // =====================================================
    // 1. KHỞI TẠO TRẠNG THÁI ỨNG DỤNG (APP STATE)
    // =====================================================
    let appState = {
        thangHienTai: 1,
        namHienTai: 2026,
        tuKhoaTimKiem: "",
        backendOnline: false, // Trạng thái kết nối máy chủ
        
        // Cấu hình danh sách cột (Mặc định + Cột tùy chỉnh)
        danhSachCot: [
            { id: "ma_nv", ten: "Mã NV / ID", kieu: "chu", macDinh: true },
            { id: "ho_ten", ten: "Họ và Tên", kieu: "chu", macDinh: true },
            { id: "luong_thang", ten: "Lương Tháng", kieu: "so", macDinh: true },
            { id: "luong_thuong", ten: "Lương Thưởng", kieu: "so", macDinh: true }
        ],
        
        // Bộ nhớ dữ liệu theo tháng: key dạng "agribank_data_2026_1"
        duLieu: {}
    };

    // =====================================================
    // 2. KHỞI CHẠY VÀ NẠP DỮ LIỆU BAN ĐẦU
    // =====================================================
    khoiTaoMenu12Thang();
    dangKySuKien();
    kiemTraTrangThaiDangNhap();

    async function khoiDongHeThong() {
        // Thử kết nối tới Backend FastAPI trước
        const daKetNoi = await kiemTraVaNapTuAPI();
        if (!daKetNoi) {
            // Nếu chưa chạy server thì dùng LocalStorage dự phòng
            khoiPhucDuLieuTuBoNho();
        }
        capNhatToanBoGiaoDien();
    }

    // =====================================================
    // 3. CÁC HÀM GIAO TIẾP VỚI API BACKEND FASTAPI & SQLITE
    // =====================================================
    async function kiemTraVaNapTuAPI() {
        try {
            // Kiểm tra trạng thái database từ backend
            let dbThongTin = null;
            try {
                const resStatus = await fetch(`${API_URL}/api/status`);
                if (resStatus.ok) {
                    const statusData = await resStatus.json();
                    dbThongTin = statusData.database;
                }
            } catch (err) {}

            const resCot = await fetch(`${API_URL}/api/cot`);
            if (resCot.ok) {
                const cotData = await resCot.json();
                if (Array.isArray(cotData) && cotData.length > 0) {
                    appState.danhSachCot = cotData.map(c => ({
                        id: c.id,
                        ten: c.ten,
                        kieu: c.kieu,
                        macDinh: Boolean(c.mac_dinh)
                    }));
                }
                appState.backendOnline = true;
                capNhatStatusBadge(true, dbThongTin);

                // Nạp dữ liệu tháng hiện tại từ SQLite qua API
                await nạpDuLieuThang(appState.thangHienTai);
                return true;
            }
        } catch (e) {
            console.log("Server FastAPI chua chay, he thong tu dong chuyen sang che do cuc bo (LocalStorage).");
            appState.backendOnline = false;
            capNhatStatusBadge(false);
        }
        return false;
    }

    function capNhatStatusBadge(online, dbThongTin = null) {
        const badgeSpan = document.querySelector(".user-status-badge span:last-child");
        const statusDot = document.querySelector(".status-dot");
        if (badgeSpan && statusDot) {
            if (online) {
                if (dbThongTin && dbThongTin.mode === "cloud_turso") {
                    badgeSpan.textContent = "Cloud DB: Turso (Lưu vĩnh viễn)";
                    badgeSpan.title = "Dữ liệu được lưu trên Turso Cloud an toàn 100%";
                } else {
                    badgeSpan.textContent = "Máy chủ: Database Cục Bộ";
                    badgeSpan.title = "Đang chạy SQLite cục bộ. Trên Render cần cấu hình Turso để lưu vĩnh viễn.";
                }
                statusDot.style.backgroundColor = "#34d399";
                statusDot.style.boxShadow = "0 0 8px #34d399";
            } else {
                badgeSpan.textContent = "Chế độ: Cục bộ (Offline)";
                badgeSpan.title = "Chưa kết nối máy chủ, dữ liệu lưu tạm trên trình duyệt";
                statusDot.style.backgroundColor = "#fbbf24";
                statusDot.style.boxShadow = "0 0 8px #fbbf24";
            }
        }
    }

    async function nạpDuLieuThang(thang) {
        const keyDuLieu = `agribank_data_${appState.namHienTai}_${thang}`;

        if (appState.backendOnline) {
            try {
                const res = await fetch(`${API_URL}/api/luong?nam=${appState.namHienTai}&thang=${thang}`);
                if (res.ok) {
                    appState.duLieu[keyDuLieu] = await res.json();
                    return;
                }
            } catch (err) {
                console.error("Loi khi tai du lieu tu API:", err);
            }
        }

        // Dự phòng LocalStorage nếu offline
        const duLieuLuu = localStorage.getItem(keyDuLieu);
        if (duLieuLuu) {
            try {
                appState.duLieu[keyDuLieu] = JSON.parse(duLieuLuu);
            } catch (e) {
                appState.duLieu[keyDuLieu] = [];
            }
        } else {
            appState.duLieu[keyDuLieu] = [];
        }
    }

    function luuVaoBoNho() {
        const keyDuLieu = `agribank_data_${appState.namHienTai}_${appState.thangHienTai}`;
        const keyCot = `agribank_columns_${appState.namHienTai}`;
        localStorage.setItem(keyCot, JSON.stringify(appState.danhSachCot));
        localStorage.setItem(keyDuLieu, JSON.stringify(appState.duLieu[keyDuLieu] || []));
    }

    function khoiPhucDuLieuTuBoNho() {
        const keyCot = `agribank_columns_${appState.namHienTai}`;
        const cotDaLuu = localStorage.getItem(keyCot);
        if (cotDaLuu) {
            try { appState.danhSachCot = JSON.parse(cotDaLuu); } catch (e) {}
        }
        nạpDuLieuThang(appState.thangHienTai);
    }

    function layDanhSachHienTai() {
        const keyDuLieu = `agribank_data_${appState.namHienTai}_${appState.thangHienTai}`;
        return appState.duLieu[keyDuLieu] || [];
    }

    function ganDanhSachHienTai(danhSachMoi) {
        const keyDuLieu = `agribank_data_${appState.namHienTai}_${appState.thangHienTai}`;
        appState.duLieu[keyDuLieu] = danhSachMoi;
        luuVaoBoNho();
    }

    // =====================================================
    // 4. TIỆN ÍCH ĐỊNH DẠNG SỐ VÀ TIỀN TỆ
    // =====================================================
    function dinhDangTien(soTien) {
        let so = Number(soTien) || 0;
        return so.toLocaleString("vi-VN") + " đ";
    }

    function tinhTongDong(dong) {
        let tong = 0;
        appState.danhSachCot.forEach(cot => {
            if (cot.kieu === "so") {
                tong += (Number(dong[cot.id]) || 0);
            }
        });
        return tong;
    }

    // =====================================================
    // 5. VẼ VÀ CẬP NHẬT GIAO DIỆN (RENDER DOM)
    // =====================================================
    function khoiTaoMenu12Thang() {
        const khungMenu = document.getElementById("menu-12-thang");
        khungMenu.innerHTML = "";
        
        for (let t = 1; t <= 12; t++) {
            const btn = document.createElement("button");
            btn.className = `month-btn ${t === appState.thangHienTai ? 'active' : ''}`;
            btn.innerHTML = `
                <span>Tháng ${t}</span>
                <span class="month-badge">T${t}</span>
            `;
            btn.addEventListener("click", async () => {
                appState.thangHienTai = t;
                await nạpDuLieuThang(t);
                capNhatToanBoGiaoDien();
            });
            khungMenu.appendChild(btn);
        }
    }

    function capNhatToanBoGiaoDien() {
        // Cập nhật tiêu đề banner
        document.getElementById("tieu-de-thang-hien-tai").textContent = 
            `BẢNG LƯƠNG THÁNG ${appState.thangHienTai} / ${appState.namHienTai}`;

        // Cập nhật active class cho sidebar menu
        const cacNutThang = document.querySelectorAll(".month-btn");
        cacNutThang.forEach((btn, index) => {
            if (index + 1 === appState.thangHienTai) {
                btn.classList.add("active");
            } else {
                btn.classList.remove("active");
            }
        });

        // Vẽ bảng dữ liệu & tính toán KPI
        veBangDuLieu();
    }

    function veBangDuLieu() {
        const theadRow = document.getElementById("hang-tieu-de-bang");
        const tbody = document.getElementById("than-bang-du-lieu");
        const tfootRow = document.getElementById("hang-tong-ket-bang");

        // 1. Dựng Tiêu đề các Cột (THEAD)
        theadRow.innerHTML = "";
        appState.danhSachCot.forEach(cot => {
            const th = document.createElement("th");
            th.textContent = cot.ten;
            
            // Nếu là cột tùy chỉnh do người dùng tự thêm -> cho phép xóa cột
            if (!cot.macDinh) {
                th.classList.add("th-tuy-chinh");
                const btnXoaCot = document.createElement("button");
                btnXoaCot.className = "btn-xoa-cot";
                btnXoaCot.title = "Xóa cột này";
                btnXoaCot.innerHTML = "&times;";
                btnXoaCot.addEventListener("click", (e) => {
                    e.stopPropagation();
                    xoaCotTuyChinh(cot.id, cot.ten);
                });
                th.appendChild(btnXoaCot);
            }
            theadRow.appendChild(th);
        });

        // Cột Tổng cộng và Cột Hành động cố định ở cuối
        const thTong = document.createElement("th");
        thTong.textContent = "Tổng Cộng";
        thTong.style.textAlign = "right";
        theadRow.appendChild(thTong);

        const thActions = document.createElement("th");
        thActions.textContent = "Thao Tác";
        thActions.className = "col-actions";
        theadRow.appendChild(thActions);

        // 2. Lọc và Dựng Dòng dữ liệu (TBODY)
        const danhSach = layDanhSachHienTai();
        const tuKhoa = appState.tuKhoaTimKiem.toLowerCase().trim();
        
        const danhSachLoc = danhSach.filter(item => {
            if (!tuKhoa) return true;
            return Object.values(item).some(val => 
                String(val).toLowerCase().includes(tuKhoa)
            );
        });

        tbody.innerHTML = "";

        // Biến tích lũy tính tổng footer & KPI
        let tongLuongCoBan = 0;
        let tongLuongThuong = 0;
        let tongTatCaNganSach = 0;
        let tongTungCotSo = {};
        
        appState.danhSachCot.forEach(cot => {
            if (cot.kieu === "so") tongTungCotSo[cot.id] = 0;
        });

        if (danhSachLoc.length === 0) {
            const tongSoCot = appState.danhSachCot.length + 2;
            tbody.innerHTML = `
                <tr>
                    <td colspan="${tongSoCot}" class="empty-state">
                        <div style="font-size: 30px;">📂</div>
                        <p>Chưa có dữ liệu nào trong Tháng ${appState.thangHienTai}. Hãy bấm "+ Thêm Giao Dịch" hoặc "Nhập Excel"!</p>
                    </td>
                </tr>
            `;
        } else {
            danhSachLoc.forEach((item, index) => {
                const tr = document.createElement("tr");
                const tongDong = tinhTongDong(item);
                tongTatCaNganSach += tongDong;

                // Các ô dữ liệu theo danh sách cột
                appState.danhSachCot.forEach(cot => {
                    const td = document.createElement("td");
                    const giaTri = item[cot.id] !== undefined ? item[cot.id] : "";

                    if (cot.kieu === "so") {
                        const soVal = Number(giaTri) || 0;
                        td.className = "col-so";
                        td.textContent = dinhDangTien(soVal);
                        tongTungCotSo[cot.id] = (tongTungCotSo[cot.id] || 0) + soVal;

                        if (cot.id === "luong_thang") tongLuongCoBan += soVal;
                        if (cot.id === "luong_thuong") tongLuongThuong += soVal;
                    } else {
                        td.textContent = giaTri;
                    }
                    tr.appendChild(td);
                });

                // Cột Tổng cộng của dòng
                const tdTong = document.createElement("td");
                tdTong.className = "col-tong";
                tdTong.textContent = dinhDangTien(tongDong);
                tr.appendChild(tdTong);

                // Cột nút Sửa & Xóa
                const tdActions = document.createElement("td");
                tdActions.className = "col-actions";
                tdActions.innerHTML = `
                    <button class="btn-action btn-edit" title="Chỉnh sửa">✏️</button>
                    <button class="btn-action btn-delete" title="Xóa dòng">🗑️</button>
                `;

                // Gắn sự kiện nút sửa & xóa
                tdActions.querySelector(".btn-edit").addEventListener("click", () => moModalChinhSua(item, index));
                tdActions.querySelector(".btn-delete").addEventListener("click", () => xoaDong(item, index));

                tr.appendChild(tdActions);
                tbody.appendChild(tr);
            });
        }

        // 3. Dựng Dòng Tổng Kết Cuối Bảng (TFOOT)
        tfootRow.innerHTML = "";
        let daGhiNhanNhanTong = false;

        appState.danhSachCot.forEach(cot => {
            const td = document.createElement("td");
            if (!daGhiNhanNhanTong) {
                td.textContent = "TỔNG CỘNG";
                td.style.fontWeight = "bold";
                daGhiNhanNhanTong = true;
            } else if (cot.kieu === "so") {
                td.className = "col-so";
                td.textContent = dinhDangTien(tongTungCotSo[cot.id] || 0);
            } else {
                td.textContent = "-";
            }
            tfootRow.appendChild(td);
        });

        const tdTongTatCa = document.createElement("td");
        tdTongTatCa.className = "col-tong";
        tdTongTatCa.textContent = dinhDangTien(tongTatCaNganSach);
        tfootRow.appendChild(tdTongTatCa);

        const tdFootTrong = document.createElement("td");
        tfootRow.appendChild(tdFootTrong);

        // 4. Cập nhật 4 thẻ KPI Thống Kê
        document.getElementById("kpi-tong-luong").textContent = dinhDangTien(tongLuongCoBan);
        document.getElementById("kpi-tong-thuong").textContent = dinhDangTien(tongLuongThuong);
        document.getElementById("kpi-tong-chi").textContent = dinhDangTien(tongTatCaNganSach);
        document.getElementById("kpi-so-nhan-su").textContent = `${danhSach.length} người`;
    }

    // =====================================================
    // 6. XỬ LÝ THÊM & XÓA CỘT TÙY CHỈNH (ĐỒNG BỘ API)
    // =====================================================
    const modalThemCot = document.getElementById("modal-them-cot");
    const btnMoModalThemCot = document.getElementById("btn-mo-modal-them-cot");
    const btnDongModalCot = document.getElementById("btn-dong-modal-cot");
    const btnHuyThemCot = document.getElementById("btn-huy-them-cot");
    const formThemCot = document.getElementById("form-them-cot");

    btnMoModalThemCot.addEventListener("click", () => {
        formThemCot.reset();
        modalThemCot.style.display = "flex";
    });

    const dongModalCotHandler = () => modalThemCot.style.display = "none";
    btnDongModalCot.addEventListener("click", dongModalCotHandler);
    btnHuyThemCot.addEventListener("click", dongModalCotHandler);

    formThemCot.addEventListener("submit", async function(e) {
        e.preventDefault();
        const tenCot = document.getElementById("ten-cot-moi").value.trim();
        const kieuCot = document.getElementById("kieu-cot-moi").value;

        if (!tenCot) {
            hienThiToast("Vui lòng nhập tên cột!", "error");
            return;
        }

        const idCot = "cot_" + Date.now();
        
        // Gọi API lưu vào Database nếu có server
        if (appState.backendOnline) {
            try {
                await fetch(`${API_URL}/api/cot`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: idCot, ten: tenCot, kieu: kieuCot })
                });
            } catch (err) {
                console.error("Lỗi khi lưu cột lên API:", err);
            }
        }

        appState.danhSachCot.push({
            id: idCot,
            ten: tenCot,
            kieu: kieuCot,
            macDinh: false
        });

        luuVaoBoNho();
        veBangDuLieu();
        dongModalCotHandler();
        hienThiToast(`Đã thêm cột "${tenCot}" (${kieuCot === 'so' ? 'Số tiền' : 'Văn bản'}) thành công!`);
    });

    async function xoaCotTuyChinh(idCot, tenCot) {
        if (!confirm(`Bạn có chắc chắn muốn xóa cột "${tenCot}"? Dữ liệu của cột này sẽ bị ẩn.`)) return;

        // Gọi API xóa trong Database
        if (appState.backendOnline) {
            try {
                await fetch(`${API_URL}/api/cot/${idCot}`, { method: "DELETE" });
            } catch (err) {
                console.error("Lỗi khi xóa cột qua API:", err);
            }
        }

        appState.danhSachCot = appState.danhSachCot.filter(c => c.id !== idCot);
        luuVaoBoNho();
        veBangDuLieu();
        hienThiToast(`Đã xóa cột "${tenCot}" thành công!`, "info");
    }

    // =====================================================
    // 7. XỬ LÝ THÊM & SỬA DÒNG DỮ LIỆU (ĐỒNG BỘ API)
    // =====================================================
    const modalNhapLieu = document.getElementById("modal-nhap-lieu");
    const btnMoModalThem = document.getElementById("btn-mo-modal-them");
    const btnDongModalNhap = document.getElementById("btn-dong-modal-nhap");
    const btnHuyNhap = document.getElementById("btn-huy-nhap");
    const formNhapLieu = document.getElementById("form-nhap-lieu");
    const khungCacONhap = document.getElementById("khung-cac-o-nhap-lieu");
    const previewTongCong = document.getElementById("preview-tong-cong");
    const tieuDeModalNhap = document.getElementById("tieu-de-modal-nhap");
    const editRowIndexInput = document.getElementById("edit-row-index");

    btnMoModalThem.addEventListener("click", () => {
        tieuDeModalNhap.textContent = "Thêm Giao Dịch / Nhân Viên Mới";
        editRowIndexInput.value = "";
        dungFormNhapLieu({});
        modalNhapLieu.style.display = "flex";
    });

    const dongModalNhapHandler = () => modalNhapLieu.style.display = "none";
    btnDongModalNhap.addEventListener("click", dongModalNhapHandler);
    btnHuyNhap.addEventListener("click", dongModalNhapHandler);

    function dungFormNhapLieu(duLieuCoSan = {}) {
        khungCacONhap.innerHTML = "";

        appState.danhSachCot.forEach(cot => {
            const div = document.createElement("div");
            div.className = "form-group";

            const label = document.createElement("label");
            label.textContent = cot.ten + (cot.kieu === "so" ? " (VND):" : ":");
            label.setAttribute("for", "input_" + cot.id);

            const input = document.createElement("input");
            input.id = "input_" + cot.id;
            input.name = cot.id;
            input.dataset.kieu = cot.kieu;

            if (cot.kieu === "so") {
                input.type = "number";
                input.placeholder = "0";
                input.value = duLieuCoSan[cot.id] !== undefined ? duLieuCoSan[cot.id] : "";
                input.addEventListener("input", capNhatPreviewTongModal);
            } else {
                input.type = "text";
                input.placeholder = `Nhập ${cot.ten.toLowerCase()}...`;
                input.value = duLieuCoSan[cot.id] || "";
            }

            if (cot.id === "ma_nv") input.required = true;

            div.appendChild(label);
            div.appendChild(input);
            khungCacONhap.appendChild(div);
        });

        capNhatPreviewTongModal();
    }

    function capNhatPreviewTongModal() {
        let tong = 0;
        const inputs = khungCacONhap.querySelectorAll("input");
        inputs.forEach(input => {
            if (input.dataset.kieu === "so") {
                tong += (Number(input.value) || 0);
            }
        });
        previewTongCong.textContent = dinhDangTien(tong);
    }

    function moModalChinhSua(item, index) {
        tieuDeModalNhap.textContent = `Chỉnh Sửa Giao Dịch (${item.ma_nv || 'Dòng ' + (index + 1)})`;
        editRowIndexInput.value = index;
        dungFormNhapLieu(item);
        modalNhapLieu.style.display = "flex";
    }

    formNhapLieu.addEventListener("submit", async function(e) {
        e.preventDefault();
        const danhSach = layDanhSachHienTai();
        const editIndex = editRowIndexInput.value;

        let banGhiMoi = {};
        let cotTuyChinhObj = {};

        const inputs = khungCacONhap.querySelectorAll("input");
        inputs.forEach(input => {
            const id = input.name;
            const kieu = input.dataset.kieu;
            const val = kieu === "so" ? (Number(input.value) || 0) : input.value.trim();
            banGhiMoi[id] = val;

            // Nếu là cột tự thêm thì gom vào object tùy chỉnh để gửi API
            if (!["ma_nv", "ho_ten", "luong_thang", "luong_thuong"].includes(id)) {
                cotTuyChinhObj[id] = val;
            }
        });

        if (editIndex !== "") {
            // Chỉnh sửa dòng cũ
            const itemCu = danhSach[Number(editIndex)];
            banGhiMoi.id = itemCu.id; // giữ nguyên ID trong database

            if (appState.backendOnline && itemCu.id) {
                try {
                    await fetch(`${API_URL}/api/luong/${itemCu.id}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            ma_nv: banGhiMoi.ma_nv,
                            ho_ten: banGhiMoi.ho_ten || "",
                            luong_thang: banGhiMoi.luong_thang || 0,
                            luong_thuong: banGhiMoi.luong_thuong || 0,
                            cot_tuy_chinh: cotTuyChinhObj
                        })
                    });
                } catch (err) {
                    console.error("Lỗi cập nhật qua API:", err);
                }
            }

            danhSach[Number(editIndex)] = banGhiMoi;
            hienThiToast("Đã cập nhật thông tin thành công!");
        } else {
            // Thêm mới
            if (appState.backendOnline) {
                try {
                    const res = await fetch(`${API_URL}/api/luong`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            nam: appState.namHienTai,
                            thang: appState.thangHienTai,
                            ma_nv: banGhiMoi.ma_nv,
                            ho_ten: banGhiMoi.ho_ten || "",
                            luong_thang: banGhiMoi.luong_thang || 0,
                            luong_thuong: banGhiMoi.luong_thuong || 0,
                            cot_tuy_chinh: cotTuyChinhObj
                        })
                    });
                    if (res.ok) {
                        const dataRes = await res.json();
                        banGhiMoi.id = dataRes.id;
                    }
                } catch (err) {
                    console.error("Lỗi thêm qua API:", err);
                }
            }

            danhSach.push(banGhiMoi);
            hienThiToast("Đã thêm giao dịch mới thành công!");
        }

        ganDanhSachHienTai(danhSach);
        veBangDuLieu();
        dongModalNhapHandler();
    });

    async function xoaDong(item, index) {
        const tenHienThi = item.ma_nv || item.ho_ten || `Dòng ${index + 1}`;
        if (confirm(`Bạn có chắc chắn muốn xóa giao dịch (${tenHienThi}) này không?`)) {
            let danhSach = layDanhSachHienTai();
            
            // Nếu có API và có ID trong database thì xóa qua API
            if (appState.backendOnline && item.id) {
                try {
                    await fetch(`${API_URL}/api/luong/${item.id}`, { method: "DELETE" });
                } catch (err) {
                    console.error("Lỗi khi xóa qua API:", err);
                }
            }

            danhSach.splice(index, 1);
            ganDanhSachHienTai(danhSach);
            veBangDuLieu();
            hienThiToast("Đã xóa giao dịch thành công!", "info");
        }
    }

    // =====================================================
    // 8. TÌM KIẾM NHANH (REALTIME SEARCH)
    // =====================================================
    const oTimKiem = document.getElementById("o-tim-kiem");
    oTimKiem.addEventListener("input", function(e) {
        appState.tuKhoaTimKiem = e.target.value;
        veBangDuLieu();
    });

    // =====================================================
    // 9. XUẤT VÀ NHẬP DỮ LIỆU EXCEL (.XLSX)
    // =====================================================
    document.getElementById("btn-xuat-excel").addEventListener("click", function() {
        const danhSach = layDanhSachHienTai();
        if (danhSach.length === 0) {
            hienThiToast("Không có dữ liệu trong tháng này để xuất Excel!", "error");
            return;
        }

        let duLieuXuat = [];
        let tieuDe = appState.danhSachCot.map(c => c.ten);
        tieuDe.push("Tổng Cộng");
        duLieuXuat.push(tieuDe);

        let tongCotSo = {};
        appState.danhSachCot.forEach(c => { if (c.kieu === 'so') tongCotSo[c.id] = 0; });
        let tongToanBo = 0;

        danhSach.forEach(item => {
            let dong = [];
            let tongDong = tinhTongDong(item);
            tongToanBo += tongDong;

            appState.danhSachCot.forEach(c => {
                if (c.kieu === "so") {
                    let val = Number(item[c.id]) || 0;
                    tongCotSo[c.id] += val;
                    dong.push(val);
                } else {
                    dong.push(item[c.id] || "");
                }
            });
            dong.push(tongDong);
            duLieuXuat.push(dong);
        });

        let dongTong = [];
        let daGhiChu = false;
        appState.danhSachCot.forEach(c => {
            if (!daGhiChu) {
                dongTong.push("TỔNG CỘNG");
                daGhiChu = true;
            } else if (c.kieu === "so") {
                dongTong.push(tongCotSo[c.id]);
            } else {
                dongTong.push("");
            }
        });
        dongTong.push(tongToanBo);
        duLieuXuat.push(dongTong);

        const ws = XLSX.utils.aoa_to_sheet(duLieuXuat);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `Thang_${appState.thangHienTai}`);
        
        const tenFile = `Bang_Luong_Agribank_Thang_${appState.thangHienTai}_${appState.namHienTai}.xlsx`;
        XLSX.writeFile(wb, tenFile);
        hienThiToast(`Đã xuất file "${tenFile}" thành công!`);
    });

    // Nhập file Excel hàng loạt
    const inputImportExcel = document.getElementById("input-import-excel");
    inputImportExcel.addEventListener("change", function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.readAsArrayBuffer(file);
        
        reader.onload = async function(evt) {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, { type: "array" });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                
                const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                if (rows.length < 2) {
                    hienThiToast("File Excel không có dữ liệu hợp lệ!", "error");
                    return;
                }

                let danhSachMoi = layDanhSachHienTai().slice();
                let soDongThem = 0;

                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i];
                    if (!row || row.length === 0 || !row[0]) continue;
                    
                    let banGhi = {
                        ma_nv: String(row[0] || `AG_${Date.now()}`),
                        ho_ten: String(row[1] || ""),
                        luong_thang: Number(row[2]) || 0,
                        luong_thuong: Number(row[3]) || 0
                    };

                    let cotTuyChinhObj = {};
                    for (let cIdx = 4; cIdx < row.length; cIdx++) {
                        const cotTuyChinhIndex = cIdx - 4;
                        if (appState.danhSachCot[4 + cotTuyChinhIndex]) {
                            const cot = appState.danhSachCot[4 + cotTuyChinhIndex];
                            const val = cot.kieu === 'so' ? (Number(row[cIdx]) || 0) : String(row[cIdx] || "");
                            banGhi[cot.id] = val;
                            cotTuyChinhObj[cot.id] = val;
                        }
                    }

                    // Nếu có backend online, lưu thẳng vào database
                    if (appState.backendOnline) {
                        try {
                            const res = await fetch(`${API_URL}/api/luong`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    nam: appState.namHienTai,
                                    thang: appState.thangHienTai,
                                    ma_nv: banGhi.ma_nv,
                                    ho_ten: banGhi.ho_ten,
                                    luong_thang: banGhi.luong_thang,
                                    luong_thuong: banGhi.luong_thuong,
                                    cot_tuy_chinh: cotTuyChinhObj
                                })
                            });
                            if (res.ok) {
                                const dataRes = await res.json();
                                banGhi.id = dataRes.id;
                            }
                        } catch (err) {
                            console.error(err);
                        }
                    }

                    danhSachMoi.push(banGhi);
                    soDongThem++;
                }

                ganDanhSachHienTai(danhSachMoi);
                veBangDuLieu();
                hienThiToast(`Đã nạp thành công ${soDongThem} nhân viên từ file Excel!`);
                inputImportExcel.value = "";
            } catch (err) {
                console.error(err);
                hienThiToast("Lỗi khi đọc file Excel: " + err.message, "error");
            }
        };
    });

    // =====================================================
    // 10. QUẢN LÝ ĐĂNG NHẬP & BẢO VỆ HỆ THỐNG
    // =====================================================
    function kiemTraTrangThaiDangNhap() {
        const manHinhDangNhap = document.getElementById("man-hinh-dang-nhap");
        const khungUngDung = document.getElementById("khung-ung-dung-chinh");
        const khungUserHeader = document.getElementById("khung-user-header");
        const khungChonNam = document.getElementById("khung-chon-nam");
        const tenCanBoSpan = document.getElementById("ten-can-bo-header");

        const userLuu = sessionStorage.getItem("agribank_user");

        if (userLuu) {
            // ĐÃ ĐĂNG NHẬP: Mở khóa giao diện bảng tính
            try {
                const userObj = JSON.parse(userLuu);
                tenCanBoSpan.textContent = userObj.ho_ten || userObj.username || "user";
            } catch (e) {
                tenCanBoSpan.textContent = "user";
            }

            manHinhDangNhap.style.display = "none";
            khungUngDung.style.display = "flex";
            khungUserHeader.style.display = "flex";
            khungChonNam.style.display = "flex";

            khoiDongHeThong();
        } else {
            // CHƯA ĐĂNG NHẬP: Khóa chặt hệ thống, chỉ hiện form đăng nhập
            manHinhDangNhap.style.display = "flex";
            khungUngDung.style.display = "none";
            khungUserHeader.style.display = "none";
            khungChonNam.style.display = "none";
        }
    }

    function dangKySuKien() {
        // 1. Xử lý Đăng nhập
        const formDangNhap = document.getElementById("form-dang-nhap");
        const inputUsername = document.getElementById("login-username");
        const inputPassword = document.getElementById("login-password");
        const errorMsg = document.getElementById("login-error-msg");

        formDangNhap.addEventListener("submit", async function(e) {
            e.preventDefault();
            const u = inputUsername.value.trim();
            const p = inputPassword.value.trim();
            errorMsg.style.display = "none";

            // Thử xác thực qua Backend API nếu server đang chạy
            let dangNhapThanhCong = false;
            let thongTinUser = null;

            try {
                const res = await fetch(`${API_URL}/api/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username: u, password: p })
                });

                if (res.ok) {
                    const data = await res.json();
                    dangNhapThanhCong = true;
                    thongTinUser = data.user;
                }
            } catch (err) {
                console.log("Khong the ket noi den API login, kiem tra fallback cuc bo");
            }

            // Fallback nếu chạy offline cục bộ: kiểm tra đúng user / qwerty
            if (!dangNhapThanhCong) {
                if (u === "user" && p === "qwerty") {
                    dangNhapThanhCong = true;
                    thongTinUser = { username: "user", ho_ten: "Quản Trị Viên Agribank" };
                }
            }

            if (dangNhapThanhCong) {
                sessionStorage.setItem("agribank_user", JSON.stringify(thongTinUser));
                inputPassword.value = "";
                kiemTraTrangThaiDangNhap();
                hienThiToast("Đăng nhập thành công! Chào mừng Quản trị viên.");
            } else {
                errorMsg.style.display = "block";
            }
        });

        // 2. Xử lý Đăng xuất
        const btnDangXuat = document.getElementById("btn-dang-xuat");
        btnDangXuat.addEventListener("click", function() {
            if (confirm("Bạn có chắc chắn muốn đăng xuất và khóa hệ thống lại không?")) {
                sessionStorage.removeItem("agribank_user");
                kiemTraTrangThaiDangNhap();
                hienThiToast("Đã đăng xuất thành công!", "info");
            }
        });

        // 3. Chọn Năm tài chính
        const chonNam = document.getElementById("chon-nam");
        chonNam.addEventListener("change", async function(e) {
            appState.namHienTai = Number(e.target.value);
            await nạpDuLieuThang(appState.thangHienTai);
            capNhatToanBoGiaoDien();
            hienThiToast(`Đã chuyển sang Năm Tài Chính ${appState.namHienTai}!`);
        });
    }

    function hienThiToast(tinNhan, loai = "success") {
        const toastContainer = document.getElementById("toast-container");
        const toast = document.createElement("div");
        toast.className = `toast toast-${loai}`;
        
        let icon = "✅";
        if (loai === "error") icon = "❌";
        if (loai === "info") icon = "ℹ️";

        toast.innerHTML = `<span>${icon}</span> <span>${tinNhan}</span>`;
        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = "0";
            toast.style.transform = "translateX(100%)";
            toast.style.transition = "all 0.3s ease";
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

});
