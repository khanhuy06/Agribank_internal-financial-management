// =========================================================
// HỆ THỐNG QUẢN LÝ TÀI CHÍNH AGRIBANK (CHI NHÁNH HOÀN LÃO)
// JAVASCRIPT ĐIỀU HÀNH GIAO DIỆN SPA, BẢO MẬT JWT & PHÂN QUYỀN RBAC
// =========================================================

document.addEventListener("DOMContentLoaded", function() {
    
    // Đường dẫn API (Thích ứng tự động)
    const API_URL = window.location.origin.startsWith("http") ? "" : "http://localhost:8000";

    // =====================================================
    // 1. TRẠNG THÁI ỨNG DỤNG (APP STATE)
    // =====================================================
    let appState = {
        thangHienTai: 1,
        namHienTai: 2026,
        tuKhoaTimKiem: "",
        token: sessionStorage.getItem("agribank_token") || "",
        currentUser: null,
        congDangKyOpen: false,
        soLuongAdmin: 1,
        
        // Cấu hình danh sách cột (Mặc định + Cột tùy chỉnh)
        danhSachCot: [
            { id: "ma_nv", ten: "Mã NV / ID", kieu: "chu", macDinh: true },
            { id: "ho_ten", ten: "Họ và Tên", kieu: "chu", macDinh: true },
            { id: "luong_thang", ten: "Lương Tháng", kieu: "so", macDinh: true },
            { id: "luong_thuong", ten: "Lương Thưởng", kieu: "so", macDinh: true }
        ],
        
        duLieu: {}
    };

    try {
        const uSaved = sessionStorage.getItem("agribank_user");
        if (uSaved) appState.currentUser = JSON.parse(uSaved);
    } catch (e) {
        appState.currentUser = null;
    }

    // Dự phòng an toàn: nếu có token mà currentUser chưa có role, giải mã từ JWT payload
    if (appState.token && (!appState.currentUser || !appState.currentUser.role)) {
        try {
            const payloadBase64 = appState.token.split('.')[1];
            const payloadJson = decodeURIComponent(escape(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'))));
            const payload = JSON.parse(payloadJson);
            if (payload && payload.role) {
                appState.currentUser = {
                    id: payload.id,
                    email: payload.email,
                    ho_ten: payload.ho_ten,
                    role: payload.role
                };
                sessionStorage.setItem("agribank_user", JSON.stringify(appState.currentUser));
            }
        } catch (err) {
            console.warn("Không thể parse JWT:", err);
        }
    }

    // =====================================================
    // 2. HÀM GỌI API KÈM VÉ THÔNG HÀNH JWT (CHỐNG F12)
    // =====================================================
    async function fetchAuth(endpoint, options = {}) {
        options.headers = options.headers || {};
        if (appState.token) {
            options.headers["Authorization"] = `Bearer ${appState.token}`;
        }
        if (!options.headers["Content-Type"] && !(options.body instanceof FormData)) {
            options.headers["Content-Type"] = "application/json";
        }

        try {
            const res = await fetch(`${API_URL}${endpoint}`, options);
            if (res.status === 401) {
                // Token không hợp lệ hoặc hết hạn -> Đá văng ra màn hình đăng nhập
                console.warn("[AUTH] Phiên làm việc đã hết hạn hoặc không có token!");
                dangXuat(false);
                hienThiToast("Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại!", "error");
                throw new Error("Unauthorized");
            }
            return res;
        } catch (err) {
            throw err;
        }
    }

    // =====================================================
    // 3. KHỞI CHẠY HỆ THỐNG
    // =====================================================
    khoiTaoMenu12Thang();
    dangKySuKienChung();
    kiemTraTrangThaiDangNhap();
    kiemTraCongDangKy();

    async function khoiDongHeThong() {
        await layThongTinServer();
        await taiDanhSachCot();
        await napDuLieuThang(appState.thangHienTai);
        capNhatToanBoGiaoDien();
        await kiemTraSoLuongAdmin();
    }

    async function kiemTraSoLuongAdmin() {
        if (!appState.currentUser || appState.currentUser.role !== 'admin') return;
        try {
            const res = await fetchAuth("/api/users");
            if (res.ok) {
                const users = await res.json();
                const tongSoAdmin = users.filter(usr => usr.role === 'admin').length;
                appState.soLuongAdmin = tongSoAdmin;
                if (typeof capNhatCacNutHaQuyen === "function") {
                    capNhatCacNutHaQuyen(tongSoAdmin);
                }
            }
        } catch (e) {}
    }

    async function layThongTinServer() {
        try {
            const res = await fetch(`${API_URL}/api/system/status`);
            if (res.ok) {
                const data = await res.json();
                const badgeText = document.getElementById("text-db-status");
                const dot = document.querySelector(".status-dot");
                if (badgeText && dot) {
                    badgeText.textContent = data.database ? data.database.ten : "Hệ Thống Trực Tuyến";
                    dot.style.backgroundColor = "#34d399";
                    dot.style.boxShadow = "0 0 8px #34d399";
                }
            }
        } catch (e) {}
    }

    async function taiDanhSachCot() {
        try {
            const res = await fetchAuth("/api/cot");
            if (res.ok) {
                const cotData = await res.json();
                if (Array.isArray(cotData) && cotData.length > 0) {
                    appState.danhSachCot = cotData.map(c => ({
                        id: c.id,
                        ten: c.ten,
                        kieu: c.kieu,
                        macDinh: Boolean(c.mac_dinh)
                    }));
                }
            }
        } catch (e) {}
    }

    async function napDuLieuThang(thang) {
        const keyDuLieu = `agribank_data_${appState.namHienTai}_${thang}`;
        try {
            const res = await fetchAuth(`/api/luong?nam=${appState.namHienTai}&thang=${thang}`);
            if (res.ok) {
                appState.duLieu[keyDuLieu] = await res.json();
                return;
            }
        } catch (err) {
            console.error("Lỗi khi tải bảng lương:", err);
        }
        appState.duLieu[keyDuLieu] = [];
    }

    function layDanhSachHienTai() {
        const keyDuLieu = `agribank_data_${appState.namHienTai}_${appState.thangHienTai}`;
        return appState.duLieu[keyDuLieu] || [];
    }

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
    // 4. VẼ VÀ CẬP NHẬT GIAO DIỆN (CHỐNG XSS & RBAC)
    // =====================================================
    function khoiTaoMenu12Thang() {
        const khungMenu = document.getElementById("menu-12-thang");
        khungMenu.innerHTML = "";
        
        for (let t = 1; t <= 12; t++) {
            const btn = document.createElement("button");
            btn.className = `month-btn ${t === appState.thangHienTai ? 'active' : ''}`;
            const padT = String(t).padStart(2, '0');
            btn.innerHTML = `
                <span>Tháng ${t}</span>
                <span class="month-badge">${padT}</span>
            `;
            btn.addEventListener("click", async () => {
                appState.thangHienTai = t;
                await napDuLieuThang(t);
                capNhatToanBoGiaoDien();
            });
            khungMenu.appendChild(btn);
        }
    }

    function capNhatToanBoGiaoDien() {
        document.getElementById("tieu-de-thang-hien-tai").textContent = 
            `BẢNG LƯƠNG THÁNG ${appState.thangHienTai} / ${appState.namHienTai}`;

        const cacNutThang = document.querySelectorAll(".month-btn");
        cacNutThang.forEach((btn, index) => {
            if (index + 1 === appState.thangHienTai) {
                btn.classList.add("active");
            } else {
                btn.classList.remove("active");
            }
        });

        // Áp dụng phân quyền RBAC lên thanh công cụ
        apDungPhanQuyenGiaoDien();

        // Vẽ bảng dữ liệu
        veBangDuLieu();
    }

    function apDungPhanQuyenGiaoDien() {
        const isAdmin = appState.currentUser && appState.currentUser.role === "admin";

        // 1. Toolbar hành động thêm sửa
        const toolbarAdmin = document.getElementById("toolbar-admin-actions");
        const btnImport = document.getElementById("btn-wrapper-import-excel");
        const btnModalUsers = document.getElementById("btn-mo-modal-users");

        if (toolbarAdmin) toolbarAdmin.style.display = isAdmin ? "flex" : "none";
        if (btnImport) btnImport.style.display = isAdmin ? "inline-flex" : "none";
        if (btnModalUsers) btnModalUsers.style.display = isAdmin ? "inline-block" : "none";

        // 2. Badge vai trò trên Header: Chỉ Admin mới thấy chữ Admin, người dùng khác ẩn hoàn toàn
        const badgeVaiTro = document.getElementById("badge-vai-tro");
        if (badgeVaiTro) {
            if (isAdmin) {
                badgeVaiTro.textContent = "Admin";
                badgeVaiTro.className = "role-badge role-admin";
                badgeVaiTro.style.display = "inline-block";
            } else {
                badgeVaiTro.textContent = "";
                badgeVaiTro.className = "";
                badgeVaiTro.style.display = "none";
            }
        }
    }

    function veBangDuLieu() {
        const theadRow = document.getElementById("hang-tieu-de-bang");
        const tbody = document.getElementById("than-bang-du-lieu");
        const tfootRow = document.getElementById("hang-tong-ket-bang");
        const isAdmin = appState.currentUser && appState.currentUser.role === "admin";

        // 1. THEAD
        theadRow.innerHTML = "";
        appState.danhSachCot.forEach(cot => {
            const th = document.createElement("th");
            th.textContent = cot.ten;
            if (cot.kieu === "so") {
                th.className = "col-so";
                th.style.textAlign = "right";
            } else {
                th.style.textAlign = "left";
            }
            
            // Chỉ Admin mới có nút xóa cột tùy chỉnh
            if (!cot.macDinh && isAdmin) {
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

        const thTong = document.createElement("th");
        thTong.textContent = "Tổng Cộng";
        thTong.className = "col-tong";
        thTong.style.textAlign = "right";
        theadRow.appendChild(thTong);

        // Chỉ Admin mới có cột Thao tác Sửa/Xóa
        if (isAdmin) {
            const thActions = document.createElement("th");
            thActions.textContent = "Thao Tác";
            thActions.className = "col-actions";
            theadRow.appendChild(thActions);
        }

        // 2. TBODY (CHỐNG XSS BẰNG TEXTCONTENT)
        const danhSach = layDanhSachHienTai();
        const tuKhoa = appState.tuKhoaTimKiem.toLowerCase().trim();
        
        const danhSachLoc = danhSach.filter(item => {
            if (!tuKhoa) return true;
            return Object.values(item).some(val => 
                String(val).toLowerCase().includes(tuKhoa)
            );
        });

        tbody.innerHTML = "";

        let tongLuongCoBan = 0;
        let tongLuongThuong = 0;
        let tongTatCaNganSach = 0;
        let tongTungCotSo = {};
        
        appState.danhSachCot.forEach(cot => {
            if (cot.kieu === "so") tongTungCotSo[cot.id] = 0;
        });

        if (danhSachLoc.length === 0) {
            const tongSoCot = appState.danhSachCot.length + (isAdmin ? 2 : 1);
            tbody.innerHTML = `
                <tr>
                    <td colspan="${tongSoCot}" class="empty-state">
                        <div style="margin-bottom: 8px;">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
                        </div>
                        <p>Chưa có dữ liệu nào trong Tháng ${appState.thangHienTai}.</p>
                    </td>
                </tr>
            `;
        } else {
            danhSachLoc.forEach((item, index) => {
                const tr = document.createElement("tr");
                const tongDong = tinhTongDong(item);
                tongTatCaNganSach += tongDong;

                appState.danhSachCot.forEach(cot => {
                    const td = document.createElement("td");
                    const giaTri = item[cot.id] !== undefined ? item[cot.id] : "";

                    if (cot.kieu === "so") {
                        const soVal = Number(giaTri) || 0;
                        td.className = "col-so";
                        td.style.textAlign = "right";
                        td.textContent = dinhDangTien(soVal);
                        tongTungCotSo[cot.id] = (tongTungCotSo[cot.id] || 0) + soVal;

                        if (cot.id === "luong_thang") tongLuongCoBan += soVal;
                        if (cot.id === "luong_thuong") tongLuongThuong += soVal;
                    } else {
                        // CHỐNG XSS: Dùng textContent tuyệt đối an toàn
                        const strVal = String(giaTri !== undefined && giaTri !== null ? giaTri : "").trim();
                        td.textContent = strVal || "—";
                        if (!strVal) {
                            td.style.color = "var(--gray-400)";
                        }
                    }
                    tr.appendChild(td);
                });

                const tdTong = document.createElement("td");
                tdTong.className = "col-tong";
                tdTong.style.textAlign = "right";
                tdTong.textContent = dinhDangTien(tongDong);
                tr.appendChild(tdTong);

                // Nếu là Admin thì vẽ nút Sửa & Xóa
                if (isAdmin) {
                    const tdActions = document.createElement("td");
                    tdActions.className = "col-actions";
                    tdActions.innerHTML = `
                        <button class="btn-action btn-edit" title="Chỉnh sửa dòng này">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                        </button>
                        <button class="btn-action btn-delete" title="Xóa dòng này">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                        </button>
                    `;
                    tdActions.querySelector(".btn-edit").addEventListener("click", () => moModalChinhSua(item, index));
                    tdActions.querySelector(".btn-delete").addEventListener("click", () => xoaDong(item, index));
                    tr.appendChild(tdActions);
                }

                tbody.appendChild(tr);
            });
        }

        // 3. TFOOT
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
                td.style.textAlign = "right";
                td.textContent = dinhDangTien(tongTungCotSo[cot.id] || 0);
            } else {
                td.textContent = "—";
                td.style.color = "var(--gray-400)";
            }
            tfootRow.appendChild(td);
        });

        const tdTongTatCa = document.createElement("td");
        tdTongTatCa.className = "col-tong";
        tdTongTatCa.style.textAlign = "right";
        tdTongTatCa.textContent = dinhDangTien(tongTatCaNganSach);
        tfootRow.appendChild(tdTongTatCa);

        if (isAdmin) {
            const tdFootTrong = document.createElement("td");
            tfootRow.appendChild(tdFootTrong);
        }

        // 4. KPI
        document.getElementById("kpi-tong-luong").textContent = dinhDangTien(tongLuongCoBan);
        document.getElementById("kpi-tong-thuong").textContent = dinhDangTien(tongLuongThuong);
        document.getElementById("kpi-tong-chi").textContent = dinhDangTien(tongTatCaNganSach);
        document.getElementById("kpi-so-nhan-su").textContent = `${danhSach.length} người`;
    }

    // =====================================================
    // 5. QUẢN LÝ CỘT LINH HOẠT
    // =====================================================
    const modalThemCot = document.getElementById("modal-them-cot");
    const btnMoModalThemCot = document.getElementById("btn-mo-modal-them-cot");
    const btnDongModalCot = document.getElementById("btn-dong-modal-cot");
    const btnHuyThemCot = document.getElementById("btn-huy-them-cot");
    const formThemCot = document.getElementById("form-them-cot");

    if (btnMoModalThemCot) {
        btnMoModalThemCot.addEventListener("click", () => {
            formThemCot.reset();
            modalThemCot.style.display = "flex";
        });
    }

    const dongModalCotHandler = () => modalThemCot.style.display = "none";
    if (btnDongModalCot) btnDongModalCot.addEventListener("click", dongModalCotHandler);
    if (btnHuyThemCot) btnHuyThemCot.addEventListener("click", dongModalCotHandler);

    if (formThemCot) {
        formThemCot.addEventListener("submit", async function(e) {
            e.preventDefault();
            const tenCot = document.getElementById("ten-cot-moi").value.trim();
            const kieuCot = document.getElementById("kieu-cot-moi").value;
            if (!tenCot) {
                hienThiToast("Vui lòng nhập tên cột!", "error");
                return;
            }
            const btnSubmit = formThemCot.querySelector("button[type='submit']");
            if (btnSubmit) {
                btnSubmit.disabled = true;
                btnSubmit.textContent = "Đang thêm...";
            }
            const idCot = "cot_" + Date.now();

            try {
                const res = await fetchAuth("/api/cot", {
                    method: "POST",
                    body: JSON.stringify({ id: idCot, ten: tenCot, kieu: kieuCot })
                });
                if (res.ok) {
                    await taiDanhSachCot();
                    veBangDuLieu();
                    dongModalCotHandler();
                    document.getElementById("ten-cot-moi").value = "";
                    hienThiToast(`Đã thêm cột "${tenCot}" thành công!`, "success");
                } else {
                    let errMsg = "Không thể thêm cột!";
                    try {
                        const err = await res.json();
                        errMsg = err.detail || errMsg;
                    } catch (e) {}
                    hienThiToast(errMsg, "error");
                }
            } catch (err) {
                console.error("Lỗi khi thêm cột:", err);
                hienThiToast(err.message || "Lỗi khi thêm cột!", "error");
            } finally {
                if (btnSubmit) {
                    btnSubmit.disabled = false;
                    btnSubmit.textContent = "Thêm Cột";
                }
            }
        });
    }

    async function xoaCotTuyChinh(idCot, tenCot) {
        if (!confirm(`Bạn có chắc chắn muốn xóa cột "${tenCot}"?`)) return;
        try {
            const res = await fetchAuth(`/api/cot/${idCot}`, { method: "DELETE" });
            if (res.ok) {
                await taiDanhSachCot();
                veBangDuLieu();
                hienThiToast(`Đã xóa cột "${tenCot}" thành công!`, "info");
            } else {
                let errMsg = "Không thể xóa cột!";
                try {
                    const err = await res.json();
                    errMsg = err.detail || errMsg;
                } catch (e) {}
                hienThiToast(errMsg, "error");
            }
        } catch (err) {
            hienThiToast(err.message || "Lỗi khi xóa cột!", "error");
        }
    }

    // =====================================================
    // 6. THAO TÁC BẢNG LƯƠNG (CRUD)
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

    if (btnMoModalThem) {
        btnMoModalThem.addEventListener("click", () => {
            tieuDeModalNhap.textContent = "Thêm Dòng Mới";
            editRowIndexInput.value = "";
            dungFormNhapLieu({});
            modalNhapLieu.style.display = "flex";
        });
    }

    const dongModalNhapHandler = () => modalNhapLieu.style.display = "none";
    if (btnDongModalNhap) btnDongModalNhap.addEventListener("click", dongModalNhapHandler);
    if (btnHuyNhap) btnHuyNhap.addEventListener("click", dongModalNhapHandler);

    function dungFormNhapLieu(duLieuCoSan = {}) {
        khungCacONhap.innerHTML = "";

        appState.danhSachCot.forEach(cot => {
            const div = document.createElement("div");
            div.className = "form-group";

            const label = document.createElement("label");
            label.textContent = cot.ten + (cot.kieu === "so" ? " (VND):" : ":");

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
                input.placeholder = cot.ten;
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
        tieuDeModalNhap.textContent = `Chỉnh Sửa Dữ Liệu (${item.ma_nv || 'Dòng ' + (index + 1)})`;
        editRowIndexInput.value = index;
        dungFormNhapLieu(item);
        modalNhapLieu.style.display = "flex";
    }

    if (formNhapLieu) {
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

                if (!["ma_nv", "ho_ten", "luong_thang", "luong_thuong"].includes(id)) {
                    cotTuyChinhObj[id] = val;
                }
            });

            try {
                if (editIndex !== "") {
                    // Sửa dòng cũ
                    const itemCu = danhSach[Number(editIndex)];
                    const res = await fetchAuth(`/api/luong/${itemCu.id}`, {
                        method: "PUT",
                        body: JSON.stringify({
                            ma_nv: banGhiMoi.ma_nv,
                            ho_ten: banGhiMoi.ho_ten || "",
                            luong_thang: banGhiMoi.luong_thang || 0,
                            luong_thuong: banGhiMoi.luong_thuong || 0,
                            cot_tuy_chinh: cotTuyChinhObj
                        })
                    });
                    if (res.ok) {
                        hienThiToast("Đã cập nhật thông tin thành công!");
                    }
                } else {
                    // Thêm dòng mới
                    const res = await fetchAuth("/api/luong", {
                        method: "POST",
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
                        hienThiToast("Đã thêm giao dịch mới thành công!");
                    }
                }

                await napDuLieuThang(appState.thangHienTai);
                veBangDuLieu();
                dongModalNhapHandler();
            } catch (err) {
                hienThiToast("Lỗi khi lưu giao dịch!", "error");
            }
        });
    }

    async function xoaDong(item, index) {
        const tenHienThi = item.ma_nv || item.ho_ten || `Dòng ${index + 1}`;
        if (confirm(`Bạn có chắc chắn muốn xóa giao dịch (${tenHienThi}) này không?`)) {
            try {
                const res = await fetchAuth(`/api/luong/${item.id}`, { method: "DELETE" });
                if (res.ok) {
                    hienThiToast("Đã xóa giao dịch thành công!", "info");
                    await napDuLieuThang(appState.thangHienTai);
                    veBangDuLieu();
                }
            } catch (err) {
                hienThiToast("Lỗi khi xóa giao dịch!", "error");
            }
        }
    }

    // =====================================================
    // 7. XUẤT VÀ NHẬP DỮ LIỆU EXCEL
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

        const ws = XLSX.utils.aoa_to_sheet(duLieuXuat);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `Thang_${appState.thangHienTai}`);
        
        const tenFile = `Bang_Luong_Agribank_Thang_${appState.thangHienTai}_${appState.namHienTai}.xlsx`;
        XLSX.writeFile(wb, tenFile);
        hienThiToast(`Đã xuất file "${tenFile}" thành công!`);
    });

    const inputImportExcel = document.getElementById("input-import-excel");
    if (inputImportExcel) {
        inputImportExcel.addEventListener("change", function(e) {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.readAsArrayBuffer(file);
            reader.onload = async function(evt) {
                try {
                    const data = new Uint8Array(evt.target.result);
                    const workbook = XLSX.read(data, { type: "array" });
                    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    
                    if (rows.length < 2) {
                        hienThiToast("File Excel không có dữ liệu hợp lệ!", "error");
                        return;
                    }

                    let soDongThem = 0;
                    for (let i = 1; i < rows.length; i++) {
                        const row = rows[i];
                        if (!row || row.length === 0 || !row[0]) continue;

                        let ma_nv = String(row[0]);
                        let ho_ten = String(row[1] || "");
                        let luong_thang = Number(row[2]) || 0;
                        let luong_thuong = Number(row[3]) || 0;

                        await fetchAuth("/api/luong", {
                            method: "POST",
                            body: JSON.stringify({
                                nam: appState.namHienTai,
                                thang: appState.thangHienTai,
                                ma_nv: ma_nv,
                                ho_ten: ho_ten,
                                luong_thang: luong_thang,
                                luong_thuong: luong_thuong,
                                cot_tuy_chinh: {}
                            })
                        });
                        soDongThem++;
                    }

                    await napDuLieuThang(appState.thangHienTai);
                    veBangDuLieu();
                    hienThiToast(`Đã nạp thành công ${soDongThem} nhân viên từ Excel!`);
                    inputImportExcel.value = "";
                } catch (err) {
                    hienThiToast("Lỗi đọc file Excel!", "error");
                }
            };
        });
    }

    // =====================================================
    // 8. ĐĂNG NHẬP, ĐĂNG KÝ, QUÊN & ĐỔI MẬT KHẨU
    // =====================================================
    async function kiemTraCongDangKy() {
        try {
            const res = await fetch(`${API_URL}/api/system/registration-status`);
            if (res.ok) {
                const data = await res.json();
                appState.congDangKyOpen = data.is_open;
                
                const tabReg = document.getElementById("tab-btn-register");
                const lblStatus = document.getElementById("lbl-status-cong-dang-ky");
                
                if (data.is_open) {
                    if (tabReg) tabReg.style.display = "inline-block";
                    if (lblStatus) lblStatus.innerHTML = `<strong style="color: #059669;">Cổng đăng ký đang mở:</strong> Nhân viên mới có thể tự đăng ký tài khoản.`;
                } else {
                    if (tabReg) tabReg.style.display = "none";
                    if (lblStatus) lblStatus.innerHTML = `<em>Cổng đăng ký đang đóng. Hệ thống chỉ dành cho cán bộ được cấp quyền.</em>`;
                }
            }
        } catch (e) {}
    }

    function kiemTraTrangThaiDangNhap() {
        const manHinhDangNhap = document.getElementById("man-hinh-dang-nhap");
        const khungUngDung = document.getElementById("khung-ung-dung-chinh");
        const khungUserHeader = document.getElementById("khung-user-header");
        const khungChonNam = document.getElementById("khung-chon-nam");
        const tenCanBoSpan = document.getElementById("ten-can-bo-header");

        if (appState.token && appState.currentUser) {
            tenCanBoSpan.textContent = appState.currentUser.ho_ten || appState.currentUser.email;
            manHinhDangNhap.style.display = "none";
            khungUngDung.style.display = "flex";
            khungUserHeader.style.display = "flex";
            khungChonNam.style.display = "flex";
            khoiDongHeThong();
        } else {
            manHinhDangNhap.style.display = "flex";
            khungUngDung.style.display = "none";
            khungUserHeader.style.display = "none";
            khungChonNam.style.display = "none";
        }
    }

    function dangXuat(xacNhan = true) {
        if (!xacNhan || confirm("Bạn có chắc chắn muốn đăng xuất khỏi hệ thống?")) {
            sessionStorage.removeItem("agribank_token");
            sessionStorage.removeItem("agribank_user");
            appState.token = "";
            appState.currentUser = null;
            kiemTraTrangThaiDangNhap();
            kiemTraCongDangKy();
            if (xacNhan) hienThiToast("Đã đăng xuất thành công!", "info");
        }
    }

    function dangKySuKienChung() {
        // Tab Đăng nhập / Đăng ký
        const tabLogin = document.getElementById("tab-btn-login");
        const tabReg = document.getElementById("tab-btn-register");
        const formLogin = document.getElementById("form-dang-nhap");
        const formReg = document.getElementById("form-dang-ky");

        tabLogin.addEventListener("click", () => {
            tabLogin.classList.add("active");
            tabReg.classList.remove("active");
            formLogin.style.display = "block";
            formReg.style.display = "none";
        });

        tabReg.addEventListener("click", () => {
            tabReg.classList.add("active");
            tabLogin.classList.remove("active");
            formReg.style.display = "block";
            formLogin.style.display = "none";
        });

        // 1. Submit Đăng nhập
        formLogin.addEventListener("submit", async function(e) {
            e.preventDefault();
            const email = document.getElementById("login-email").value.trim();
            const password = document.getElementById("login-password").value.trim();
            const errorMsg = document.getElementById("login-error-msg");
            errorMsg.style.display = "none";

            try {
                const res = await fetch(`${API_URL}/api/auth/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, password })
                });

                const data = await res.json();
                if (res.ok) {
                    appState.token = data.access_token;
                    appState.currentUser = data.user;
                    sessionStorage.setItem("agribank_token", data.access_token);
                    sessionStorage.setItem("agribank_user", JSON.stringify(data.user));
                    
                    document.getElementById("login-password").value = "";
                    kiemTraTrangThaiDangNhap();
                    hienThiToast(`Chào mừng ${data.user.ho_ten}!`);
                } else {
                    errorMsg.textContent = data.detail || "Đăng nhập thất bại!";
                    errorMsg.style.display = "block";
                }
            } catch (err) {
                errorMsg.textContent = "Không thể kết nối tới máy chủ!";
                errorMsg.style.display = "block";
            }
        });

        // 2. Nút gửi OTP Đăng ký
        const btnGuiOtpDangKy = document.getElementById("btn-gui-otp-dang-ky");
        const regOtpHint = document.getElementById("reg-otp-hint");
        let countdownRegInterval = null;

        if (btnGuiOtpDangKy) {
            btnGuiOtpDangKy.addEventListener("click", async () => {
                const email = document.getElementById("reg-email").value.trim();
                const ho_ten = document.getElementById("reg-hoten").value.trim();
                const errMsg = document.getElementById("reg-error-msg");
                const successMsg = document.getElementById("reg-success-msg");

                if (!email) {
                    if (errMsg) {
                        errMsg.textContent = "Vui lòng nhập Email trước khi gửi mã OTP!";
                        errMsg.style.display = "block";
                    }
                    document.getElementById("reg-email").focus();
                    return;
                }

                if (errMsg) errMsg.style.display = "none";
                if (successMsg) successMsg.style.display = "none";
                btnGuiOtpDangKy.disabled = true;
                btnGuiOtpDangKy.textContent = "Đang gửi...";

                try {
                    const res = await fetch(`${API_URL}/api/auth/send-register-otp`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ email, ho_ten: ho_ten || "Cán bộ" })
                    });
                    const data = await res.json().catch(() => ({}));
                    if (res.ok) {
                        if (successMsg) {
                            successMsg.textContent = data.message || "Mã OTP đã được gửi về email!";
                            successMsg.style.display = "block";
                        }
                        if (regOtpHint) {
                            regOtpHint.textContent = `Mã OTP đã gửi tới ${email}. Vui lòng kiểm tra hộp thư!`;
                            regOtpHint.style.color = "#15803d";
                        }
                        const regOtpInput = document.getElementById("reg-otp");
                        if (regOtpInput) regOtpInput.focus();

                        let count = 60;
                        if (countdownRegInterval) clearInterval(countdownRegInterval);
                        countdownRegInterval = setInterval(() => {
                            count--;
                            if (count > 0) {
                                btnGuiOtpDangKy.textContent = `Gửi lại (${count}s)`;
                            } else {
                                clearInterval(countdownRegInterval);
                                btnGuiOtpDangKy.disabled = false;
                                btnGuiOtpDangKy.textContent = "Gửi lại mã";
                            }
                        }, 1000);
                    } else {
                        if (errMsg) {
                            errMsg.textContent = data.detail || "Không thể gửi mã OTP!";
                            errMsg.style.display = "block";
                        }
                        btnGuiOtpDangKy.disabled = false;
                        btnGuiOtpDangKy.textContent = "Gửi mã OTP";
                    }
                } catch (err) {
                    if (errMsg) {
                        errMsg.textContent = "Lỗi kết nối khi gửi mã OTP!";
                        errMsg.style.display = "block";
                    }
                    btnGuiOtpDangKy.disabled = false;
                    btnGuiOtpDangKy.textContent = "Gửi mã OTP";
                }
            });
        }

        // 3. Submit Đăng ký
        formReg.addEventListener("submit", async function(e) {
            e.preventDefault();
            const email = document.getElementById("reg-email").value.trim();
            const ho_ten = document.getElementById("reg-hoten").value.trim();
            const password = document.getElementById("reg-password").value.trim();
            const otp_code = document.getElementById("reg-otp") ? document.getElementById("reg-otp").value.trim() : "";
            const errMsg = document.getElementById("reg-error-msg");
            const successMsg = document.getElementById("reg-success-msg");

            errMsg.style.display = "none";
            successMsg.style.display = "none";

            if (!otp_code || otp_code.length !== 6) {
                errMsg.textContent = "Vui lòng bấm 'Gửi mã OTP' và nhập mã OTP 6 số từ email của bạn!";
                errMsg.style.display = "block";
                const regOtpInput = document.getElementById("reg-otp");
                if (regOtpInput) regOtpInput.focus();
                return;
            }

            try {
                const res = await fetch(`${API_URL}/api/auth/register`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, ho_ten, password, otp_code })
                });
                const data = await res.json().catch(() => ({}));

                if (res.ok) {
                    successMsg.textContent = data.message;
                    successMsg.style.display = "block";
                    formReg.reset();
                    if (countdownRegInterval) clearInterval(countdownRegInterval);
                    if (btnGuiOtpDangKy) {
                        btnGuiOtpDangKy.disabled = false;
                        btnGuiOtpDangKy.textContent = "Gửi mã OTP";
                    }
                    setTimeout(() => tabLogin.click(), 2000);
                } else {
                    errMsg.textContent = data.detail || "Đăng ký thất bại!";
                    errMsg.style.display = "block";
                }
            } catch (err) {
                errMsg.textContent = "Lỗi kết nối tới máy chủ!";
                errMsg.style.display = "block";
            }
        });

        // 3. Đăng xuất
        document.getElementById("btn-dang-xuat").addEventListener("click", () => dangXuat(true));

        // 4. Chọn năm
        document.getElementById("chon-nam").addEventListener("change", async function(e) {
            appState.namHienTai = Number(e.target.value);
            await napDuLieuThang(appState.thangHienTai);
            capNhatToanBoGiaoDien();
        });

        // 5. Tìm kiếm
        document.getElementById("o-tim-kiem").addEventListener("input", function(e) {
            appState.tuKhoaTimKiem = e.target.value;
            veBangDuLieu();
        });

        // =====================================================
        // 9. MODAL CÀI ĐẶT TÀI KHOẢN (GỒM: ĐỔI TÊN, ĐỔI MẬT KHẨU, ĐĂNG XUẤT)
        // =====================================================
        const modalCaiDat = document.getElementById("modal-cai-dat");
        const btnMoCaiDat = document.getElementById("btn-mo-modal-cai-dat");
        const btnHeaderProfile = document.getElementById("btn-header-profile");
        const btnDongCaiDat = document.getElementById("btn-dong-modal-cai-dat");

        const tabBtnTen = document.getElementById("tab-btn-cai-dat-ten");
        const tabBtnMk = document.getElementById("tab-btn-cai-dat-mk");
        const tabBtnAdmin = document.getElementById("tab-btn-cai-dat-admin");
        const khoiTen = document.getElementById("khoi-cai-dat-ten");
        const khoiMk = document.getElementById("khoi-cai-dat-mk");
        const khoiAdmin = document.getElementById("khoi-cai-dat-admin");

        const formDoiTen = document.getElementById("form-doi-ten");
        const doiTenErr = document.getElementById("doi-ten-error");
        const doiTenSuccess = document.getElementById("doi-ten-success");

        const formDoiMk = document.getElementById("form-doi-mat-khau");
        const doiMkErr = document.getElementById("doi-mk-error");
        const btnGuiOtpDoiMk = document.getElementById("btn-gui-otp-doi-mk");
        const inputOtpDoiMk = document.getElementById("mk-otp-code");

        let cooldownDoiMkOtp = 0;
        let timerDoiMkOtp = null;

        // Chuyển tab trong modal cài đặt (3 tabs: tên, mật khẩu, quyền admin)
        const chuyenTabCaiDat = (tab) => {
            if (tabBtnTen) tabBtnTen.classList.remove("active");
            if (tabBtnMk) tabBtnMk.classList.remove("active");
            if (tabBtnAdmin) tabBtnAdmin.classList.remove("active");
            if (khoiTen) khoiTen.style.display = "none";
            if (khoiMk) khoiMk.style.display = "none";
            if (khoiAdmin) khoiAdmin.style.display = "none";

            if (tab === "ten") {
                if (tabBtnTen) tabBtnTen.classList.add("active");
                if (khoiTen) khoiTen.style.display = "block";
            } else if (tab === "mk") {
                if (tabBtnMk) tabBtnMk.classList.add("active");
                if (khoiMk) khoiMk.style.display = "block";
            } else if (tab === "admin") {
                if (tabBtnAdmin) tabBtnAdmin.classList.add("active");
                if (khoiAdmin) khoiAdmin.style.display = "block";
            }
        };

        if (tabBtnTen) tabBtnTen.addEventListener("click", () => chuyenTabCaiDat("ten"));
        if (tabBtnMk) tabBtnMk.addEventListener("click", () => chuyenTabCaiDat("mk"));
        if (tabBtnAdmin) tabBtnAdmin.addEventListener("click", () => chuyenTabCaiDat("admin"));

        // Mở modal cài đặt
        const moModalCaiDatHandler = (tabMacDinh = "ten") => {
            const isAdmin = Boolean(appState.currentUser && appState.currentUser.role === "admin");

            if (appState.currentUser) {
                const tenHienTaiInput = document.getElementById("setting-ten-hien-tai");
                if (tenHienTaiInput) {
                    tenHienTaiInput.value = appState.currentUser.ho_ten || appState.currentUser.email || "";
                }
            }
            const tenMoiInput = document.getElementById("setting-ten-moi");
            if (tenMoiInput) tenMoiInput.value = "";
            if (doiTenErr) doiTenErr.style.display = "none";
            if (doiTenSuccess) doiTenSuccess.style.display = "none";

            if (formDoiMk) formDoiMk.reset();
            if (doiMkErr) doiMkErr.style.display = "none";

            // Hiển thị / ẩn tab quyền Admin (Chỉ Admin mới thấy)
            if (tabBtnAdmin) tabBtnAdmin.style.display = isAdmin ? "block" : "none";

            chuyenTabCaiDat(tabMacDinh);
            if (modalCaiDat) modalCaiDat.style.display = "flex";
        };

        if (btnMoCaiDat) btnMoCaiDat.addEventListener("click", () => moModalCaiDatHandler("ten"));
        if (btnHeaderProfile) btnHeaderProfile.addEventListener("click", () => moModalCaiDatHandler("ten"));

        // Bấm trực tiếp vào badge Admin trên Header cũng mở cài đặt quyền Admin
        const badgeVaiTro = document.getElementById("badge-vai-tro");
        if (badgeVaiTro) {
            badgeVaiTro.style.cursor = "pointer";
            badgeVaiTro.title = "Bấm để quản lý quyền Admin";
            badgeVaiTro.addEventListener("click", (e) => {
                e.stopPropagation();
                moModalCaiDatHandler("admin");
            });
        }

        // Đóng modal cài đặt
        const dongModalCaiDatHandler = () => {
            if (modalCaiDat) modalCaiDat.style.display = "none";
        };
        if (btnDongCaiDat) btnDongCaiDat.addEventListener("click", dongModalCaiDatHandler);

        // Submit Đổi tên tài khoản
        if (formDoiTen) {
            formDoiTen.addEventListener("submit", async function(e) {
                e.preventDefault();
                const tenMoi = document.getElementById("setting-ten-moi").value.trim();
                if (doiTenErr) doiTenErr.style.display = "none";
                if (doiTenSuccess) doiTenSuccess.style.display = "none";

                if (tenMoi.length < 2) {
                    doiTenErr.textContent = "Tên tài khoản phải có độ dài từ 2 ký tự trở lên!";
                    doiTenErr.style.display = "block";
                    return;
                }

                try {
                    const res = await fetchAuth("/api/auth/doi-ten", {
                        method: "PUT",
                        body: JSON.stringify({ ho_ten: tenMoi })
                    });
                    const data = await res.json();
                    if (res.ok) {
                        if (appState.currentUser) {
                            appState.currentUser.ho_ten = tenMoi;
                            sessionStorage.setItem("agribank_user", JSON.stringify(appState.currentUser));
                        }
                        const tenCanBoSpan = document.getElementById("ten-can-bo-header");
                        if (tenCanBoSpan) tenCanBoSpan.textContent = tenMoi;

                        const tenHienTaiInput = document.getElementById("setting-ten-hien-tai");
                        if (tenHienTaiInput) tenHienTaiInput.value = tenMoi;
                        document.getElementById("setting-ten-moi").value = "";

                        doiTenSuccess.textContent = "Đã cập nhật tên tài khoản thành công!";
                        doiTenSuccess.style.display = "block";
                        hienThiToast("Đổi tên tài khoản thành công!", "success");
                    } else {
                        doiTenErr.textContent = data.detail || "Không thể đổi tên tài khoản!";
                        doiTenErr.style.display = "block";
                    }
                } catch (err) {
                    doiTenErr.textContent = "Lỗi kết nối khi cập nhật tên!";
                    doiTenErr.style.display = "block";
                }
            });
        }

        // Nút Gửi mã OTP xác thực đổi mật khẩu
        if (btnGuiOtpDoiMk) {
            btnGuiOtpDoiMk.addEventListener("click", async () => {
                if (cooldownDoiMkOtp > 0) return;

                btnGuiOtpDoiMk.disabled = true;
                btnGuiOtpDoiMk.textContent = "Đang gửi...";

                try {
                    const res = await fetchAuth("/api/auth/send-change-password-otp", { method: "POST" });
                    const data = await res.json();
                    if (res.ok) {
                        hienThiToast(data.message, "success");
                        if (inputOtpDoiMk) inputOtpDoiMk.focus();

                        // Bắt đầu đếm ngược 60 giây
                        cooldownDoiMkOtp = 60;
                        btnGuiOtpDoiMk.textContent = `Gửi lại (${cooldownDoiMkOtp}s)`;
                        clearInterval(timerDoiMkOtp);
                        timerDoiMkOtp = setInterval(() => {
                            cooldownDoiMkOtp--;
                            if (cooldownDoiMkOtp <= 0) {
                                clearInterval(timerDoiMkOtp);
                                btnGuiOtpDoiMk.disabled = false;
                                btnGuiOtpDoiMk.textContent = "Gửi Mã OTP";
                            } else {
                                btnGuiOtpDoiMk.textContent = `Gửi lại (${cooldownDoiMkOtp}s)`;
                            }
                        }, 1000);
                    } else {
                        btnGuiOtpDoiMk.disabled = false;
                        btnGuiOtpDoiMk.textContent = "Gửi Mã OTP";
                        hienThiToast(data.detail || "Không thể gửi OTP!", "error");
                    }
                } catch (err) {
                    btnGuiOtpDoiMk.disabled = false;
                    btnGuiOtpDoiMk.textContent = "Gửi Mã OTP";
                    hienThiToast("Lỗi kết nối khi gửi OTP!", "error");
                }
            });
        }

        // Submit Đổi Mật Khẩu
        if (formDoiMk) {
            formDoiMk.addEventListener("submit", async function(e) {
                e.preventDefault();
                const cu = document.getElementById("mk-cu").value;
                const moi = document.getElementById("mk-moi").value;
                const confirm = document.getElementById("mk-moi-confirm").value;
                const otp = document.getElementById("mk-otp-code").value.trim();

                if (moi !== confirm) {
                    doiMkErr.textContent = "Mật khẩu mới và xác nhận mật khẩu không khớp nhau!";
                    doiMkErr.style.display = "block";
                    return;
                }

                if (!otp || otp.length !== 6) {
                    doiMkErr.textContent = "Vui lòng nhập đúng mã OTP 6 chữ số nhận từ email!";
                    doiMkErr.style.display = "block";
                    return;
                }

                try {
                    const res = await fetchAuth("/api/auth/doi-mat-khau", {
                        method: "POST",
                        body: JSON.stringify({ mat_khau_cu: cu, mat_khau_moi: moi, otp_code: otp })
                    });
                    const data = await res.json();
                    if (res.ok) {
                        dongModalCaiDatHandler();
                        hienThiToast("Đổi mật khẩu thành công! Email thông báo an ninh đã được gửi.", "success");
                    } else {
                        doiMkErr.textContent = data.detail || "Đổi mật khẩu thất bại!";
                        doiMkErr.style.display = "block";
                    }
                } catch (err) {
                    doiMkErr.textContent = "Lỗi hệ thống khi đổi mật khẩu!";
                    doiMkErr.style.display = "block";
                }
            });
        }

        // CẬP NHẬT TRẠNG THÁI CÁC NÚT TỰ HẠ CẤP KHI HỆ THỐNG CHỈ CÒN 1 ADMIN
        function capNhatCacNutHaQuyen(soAdmin) {
            const btnTuHaQuyen = document.getElementById("btn-tu-ha-quyen-admin");
            const btnTuHaQuyenTab = document.getElementById("btn-tu-ha-quyen-admin-tab");
            const soleWarningSetting = document.getElementById("sole-admin-warning-setting");

            const isSole = soAdmin <= 1;
            [btnTuHaQuyen, btnTuHaQuyenTab].forEach(btn => {
                if (btn) {
                    btn.disabled = isSole;
                    if (isSole) {
                        btn.title = "Bạn là Quản trị viên duy nhất trong hệ thống, không thể hạ cấp!";
                    } else {
                        btn.title = "Tự nguyện từ bỏ quyền Quản trị viên để trở về người dùng thông thường";
                    }
                }
            });

            if (soleWarningSetting) {
                soleWarningSetting.style.display = isSole ? "block" : "none";
            }
        }

        // =====================================================
        // XÁC THỰC OTP TỰ HẠ CẤP QUYỀN ADMIN (BẢO VỆ 2 LỚP)
        // =====================================================
        let countdownHaQuyenInterval = null;

        async function moModalXacThucHaQuyen() {
            if (appState.soLuongAdmin <= 1) {
                hienThiToast("Hệ thống bắt buộc phải có ít nhất 1 Admin! Bạn là Admin duy nhất nên không thể hạ cấp.", "error");
                return;
            }

            const modalHaQuyen = document.getElementById("modal-xac-thuc-ha-quyen");
            const formHaQuyen = document.getElementById("form-xac-thuc-ha-quyen");
            const errBox = document.getElementById("ha-quyen-error-msg");
            const sucBox = document.getElementById("ha-quyen-success-msg");
            const inputOtp = document.getElementById("otp-ha-quyen-input");

            if (formHaQuyen) formHaQuyen.reset();
            if (errBox) errBox.style.display = "none";
            if (sucBox) sucBox.style.display = "none";
            if (modalHaQuyen) modalHaQuyen.style.display = "flex";

            // Tự động kích hoạt gửi mã OTP về email
            await guiOtpHaQuyen();
            if (inputOtp) inputOtp.focus();
        }

        async function guiOtpHaQuyen() {
            const btnResend = document.getElementById("btn-gui-lai-otp-ha-quyen");
            const hint = document.getElementById("otp-ha-quyen-hint");
            const errBox = document.getElementById("ha-quyen-error-msg");
            const sucBox = document.getElementById("ha-quyen-success-msg");

            if (btnResend) {
                btnResend.disabled = true;
                btnResend.textContent = "Đang gửi...";
            }
            if (errBox) errBox.style.display = "none";

            try {
                const res = await fetchAuth("/api/users/yeu-cau-otp-ha-quyen", { method: "POST" });
                const data = await res.json().catch(() => ({}));
                if (res.ok) {
                    if (sucBox) {
                        sucBox.textContent = data.message || "Mã OTP đã được gửi đến email của bạn!";
                        sucBox.style.display = "block";
                    }
                    if (hint) {
                        hint.textContent = `Mã OTP 6 số đã được gửi tới email ${appState.currentUser ? appState.currentUser.email : ''}. Vui lòng kiểm tra hộp thư!`;
                        hint.style.color = "#15803d";
                    }
                    let count = 60;
                    if (countdownHaQuyenInterval) clearInterval(countdownHaQuyenInterval);
                    countdownHaQuyenInterval = setInterval(() => {
                        count--;
                        if (btnResend) {
                            if (count > 0) {
                                btnResend.textContent = `Gửi lại (${count}s)`;
                            } else {
                                clearInterval(countdownHaQuyenInterval);
                                btnResend.disabled = false;
                                btnResend.textContent = "Gửi lại mã";
                            }
                        }
                    }, 1000);
                } else {
                    if (errBox) {
                        errBox.textContent = data.detail || `Không thể gửi mã OTP (Mã lỗi ${res.status})!`;
                        errBox.style.display = "block";
                    }
                    if (btnResend) {
                        btnResend.disabled = false;
                        btnResend.textContent = "Gửi lại mã";
                    }
                }
            } catch (err) {
                console.error("[OTP HẠ QUYỀN LỖI]:", err);
                if (errBox) {
                    errBox.textContent = err.message === "Unauthorized" ? "Phiên làm việc hết hạn, vui lòng đăng nhập lại!" : "Lỗi kết nối khi gửi OTP!";
                    errBox.style.display = "block";
                }
                if (btnResend) {
                    btnResend.disabled = false;
                    btnResend.textContent = "Gửi lại mã";
                }
            }
        }

        const formXacThucHaQuyen = document.getElementById("form-xac-thuc-ha-quyen");
        if (formXacThucHaQuyen) {
            formXacThucHaQuyen.addEventListener("submit", async function(e) {
                e.preventDefault();
                const otpVal = document.getElementById("otp-ha-quyen-input").value.trim();
                const errBox = document.getElementById("ha-quyen-error-msg");
                const btnSubmit = document.getElementById("btn-submit-ha-quyen");

                if (!otpVal || otpVal.length !== 6) {
                    if (errBox) {
                        errBox.textContent = "Vui lòng nhập đầy đủ 6 chữ số OTP!";
                        errBox.style.display = "block";
                    }
                    return;
                }

                if (btnSubmit) {
                    btnSubmit.disabled = true;
                    btnSubmit.textContent = "Đang xác thực...";
                }
                if (errBox) errBox.style.display = "none";

                try {
                    const res = await fetchAuth("/api/users/tu-ha-quyen", {
                        method: "POST",
                        body: JSON.stringify({ otp_code: otpVal })
                    });
                    const data = await res.json();
                    if (res.ok) {
                        if (data.access_token) {
                            sessionStorage.setItem("agribank_token", data.access_token);
                            appState.token = data.access_token;
                        }
                        if (data.user) {
                            appState.currentUser = data.user;
                            sessionStorage.setItem("agribank_user", JSON.stringify(data.user));
                        } else if (appState.currentUser) {
                            appState.currentUser.role = "nhan_vien";
                            sessionStorage.setItem("agribank_user", JSON.stringify(appState.currentUser));
                        }

                        // Đóng tất cả modal
                        const modalHaQuyen = document.getElementById("modal-xac-thuc-ha-quyen");
                        if (modalHaQuyen) modalHaQuyen.style.display = "none";
                        const modalCaiDat = document.getElementById("modal-cai-dat");
                        if (modalCaiDat) modalCaiDat.style.display = "none";
                        const modalUsers = document.getElementById("modal-quan-ly-users");
                        if (modalUsers) modalUsers.style.display = "none";

                        if (countdownHaQuyenInterval) clearInterval(countdownHaQuyenInterval);

                        apDungPhanQuyenGiaoDien();
                        veBangDuLieu();
                        hienThiToast("Bạn đã tự hạ cấp về người dùng thông thường thành công!", "success");
                    } else {
                        if (errBox) {
                            errBox.textContent = data.detail || "Không thể hạ cấp!";
                            errBox.style.display = "block";
                        }
                        hienThiToast(data.detail || "Không thể hạ cấp!", "error");
                    }
                } catch (err) {
                    if (errBox) {
                        errBox.textContent = "Lỗi kết nối khi xác thực OTP!";
                        errBox.style.display = "block";
                    }
                    hienThiToast("Lỗi kết nối khi xác thực OTP!", "error");
                } finally {
                    if (btnSubmit) {
                        btnSubmit.disabled = false;
                        btnSubmit.textContent = "Xác Nhận Hạ Cấp";
                    }
                }
            });
        }

        const btnDongModalHaQuyen = document.getElementById("btn-dong-modal-ha-quyen");
        const btnHuyHaQuyen = document.getElementById("btn-huy-ha-quyen");
        const dongModalHaQuyenHandler = () => {
            const m = document.getElementById("modal-xac-thuc-ha-quyen");
            if (m) m.style.display = "none";
            if (countdownHaQuyenInterval) clearInterval(countdownHaQuyenInterval);
        };
        if (btnDongModalHaQuyen) btnDongModalHaQuyen.addEventListener("click", dongModalHaQuyenHandler);
        if (btnHuyHaQuyen) btnHuyHaQuyen.addEventListener("click", dongModalHaQuyenHandler);

        const btnGuiLaiOtpHaQuyen = document.getElementById("btn-gui-lai-otp-ha-quyen");
        if (btnGuiLaiOtpHaQuyen) btnGuiLaiOtpHaQuyen.addEventListener("click", guiOtpHaQuyen);

        // Gắn sự kiện cho các nút tự hạ cấp quyền Admin
        const btnTuHaQuyen = document.getElementById("btn-tu-ha-quyen-admin");
        if (btnTuHaQuyen) btnTuHaQuyen.addEventListener("click", moModalXacThucHaQuyen);

        const btnTuHaQuyenTab = document.getElementById("btn-tu-ha-quyen-admin-tab");
        if (btnTuHaQuyenTab) btnTuHaQuyenTab.addEventListener("click", moModalXacThucHaQuyen);


        // =====================================================
        // 10. MODAL QUÊN MẬT KHẨU (XÁC THỰC EMAIL OTP)
        // =====================================================
        const modalQuenMk = document.getElementById("modal-quen-mat-khau");
        const linkQuenMk = document.getElementById("link-quen-mat-khau");
        const btnDongQuenMk = document.getElementById("btn-dong-modal-quen-mk");
        const btnHuyOtp = document.getElementById("btn-huy-otp");
        const btnQuayLaiB1 = document.getElementById("btn-quay-lai-b1");
        
        const khoiB1 = document.getElementById("khoi-quen-mk-b1");
        const khoiB2 = document.getElementById("khoi-quen-mk-b2");
        const formGuiOtp = document.getElementById("form-gui-otp");
        const formXacNhanOtp = document.getElementById("form-xac-nhan-otp");
        const otpEmailInput = document.getElementById("otp-email-input");
        const otpB1Msg = document.getElementById("otp-b1-msg");
        const otpB2Msg = document.getElementById("otp-b2-msg");

        linkQuenMk.addEventListener("click", () => {
            khoiB1.style.display = "block";
            khoiB2.style.display = "none";
            formGuiOtp.reset();
            formXacNhanOtp.reset();
            otpB1Msg.style.display = "none";
            otpB2Msg.style.display = "none";
            modalQuenMk.style.display = "flex";
        });

        const dongModalQuenMkHandler = () => modalQuenMk.style.display = "none";
        btnDongQuenMk.addEventListener("click", dongModalQuenMkHandler);
        btnHuyOtp.addEventListener("click", dongModalQuenMkHandler);
        btnQuayLaiB1.addEventListener("click", () => {
            khoiB1.style.display = "block";
            khoiB2.style.display = "none";
        });

        // B1: Gửi OTP
        formGuiOtp.addEventListener("submit", async function(e) {
            e.preventDefault();
            const email = otpEmailInput.value.trim();
            otpB1Msg.style.display = "none";

            const btnSubmit = document.getElementById("btn-xac-nhan-gui-otp");
            btnSubmit.textContent = "Đang gửi OTP...";
            btnSubmit.disabled = true;

            try {
                const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email })
                });
                const data = await res.json();
                btnSubmit.textContent = "Gửi Mã OTP";
                btnSubmit.disabled = false;

                if (res.ok) {
                    khoiB1.style.display = "none";
                    khoiB2.style.display = "block";
                    hienThiToast("Mã OTP đã được gửi về email của bạn!");
                } else {
                    otpB1Msg.textContent = data.detail || "Không thể gửi OTP!";
                    otpB1Msg.style.display = "block";
                }
            } catch (err) {
                btnSubmit.textContent = "Gửi Mã OTP";
                btnSubmit.disabled = false;
                otpB1Msg.textContent = "Không thể kết nối tới máy chủ!";
                otpB1Msg.style.display = "block";
            }
        });

        // B2: Nhập OTP và Đặt lại mật khẩu
        formXacNhanOtp.addEventListener("submit", async function(e) {
            e.preventDefault();
            const email = otpEmailInput.value.trim();
            const otp_code = document.getElementById("otp-code-input").value.trim();
            const mat_khau_moi = document.getElementById("otp-new-password").value.trim();
            otpB2Msg.style.display = "none";

            try {
                const res = await fetch(`${API_URL}/api/auth/reset-password`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, otp_code, mat_khau_moi })
                });
                const data = await res.json();

                if (res.ok) {
                    dongModalQuenMkHandler();
                    hienThiToast("Đặt lại mật khẩu thành công! Bạn có thể đăng nhập ngay.");
                    document.getElementById("login-email").value = email;
                } else {
                    otpB2Msg.textContent = data.detail || "Mã OTP không hợp lệ!";
                    otpB2Msg.style.display = "block";
                }
            } catch (err) {
                otpB2Msg.textContent = "Lỗi hệ thống khi xác nhận OTP!";
                otpB2Msg.style.display = "block";
            }
        });

        // =====================================================
        // 11. MODAL QUẢN LÝ TÀI KHOẢN & CÔNG TẮC CỔNG (ADMIN)
        // =====================================================
        const modalUsers = document.getElementById("modal-quan-ly-users");
        const btnMoUsers = document.getElementById("btn-mo-modal-users");
        const btnDongUsers = document.getElementById("btn-dong-modal-users");
        const btnDongUsersBottom = document.getElementById("btn-dong-quan-ly-users");
        const btnToggleCong = document.getElementById("btn-toggle-cong-dang-ky");
        const badgeGate = document.getElementById("badge-trang-thai-cong");

        // Các nút & form thêm người dùng thủ công
        const btnHienFormThemUser = document.getElementById("btn-hien-form-them-user");
        const btnHuyThemUser = document.getElementById("btn-huy-them-user");
        const khungThemUser = document.getElementById("khung-them-user-thu-cong");
        const formThemUser = document.getElementById("form-them-user-thu-cong");
        const btnTaoMkNgauNhien = document.getElementById("btn-tao-mk-ngau-nhien");
        const inputNewEmail = document.getElementById("new-user-email");
        const inputNewHoTen = document.getElementById("new-user-hoten");
        const inputNewPassword = document.getElementById("new-user-password");
        const selectNewRole = document.getElementById("new-user-role");
        const inputNewOtp = document.getElementById("new-user-otp");
        const btnGuiOtpThemUser = document.getElementById("btn-gui-otp-them-user");
        const newUserOtpHint = document.getElementById("new-user-otp-hint");
        const newUserErrorMsg = document.getElementById("new-user-error-msg");
        const newUserSuccessMsg = document.getElementById("new-user-success-msg");
        let countdownThemUserInterval = null;

        if (btnMoUsers) {
            btnMoUsers.addEventListener("click", async () => {
                if (khungThemUser) khungThemUser.style.display = "none";
                await taiDanhSachUsersAdmin();
                await kiemTraCongDangKy();
                capNhatBadgeCongAdmin();
                modalUsers.style.display = "flex";
            });
        }

        const dongModalUsersHandler = () => {
            if (modalUsers) modalUsers.style.display = "none";
            if (khungThemUser) khungThemUser.style.display = "none";
        };
        if (btnDongUsers) btnDongUsers.addEventListener("click", dongModalUsersHandler);
        if (btnDongUsersBottom) btnDongUsersBottom.addEventListener("click", dongModalUsersHandler);

        // Nút ẩn/hiện form thêm thủ công
        if (btnHienFormThemUser) {
            btnHienFormThemUser.addEventListener("click", () => {
                if (!khungThemUser) return;
                const isHidden = khungThemUser.style.display === "none";
                khungThemUser.style.display = isHidden ? "block" : "none";
                if (isHidden && inputNewEmail) {
                    inputNewEmail.focus();
                    if (!inputNewPassword.value) {
                        sinhVaDienMatKhauNgauNhien();
                    }
                }
            });
        }

        if (btnHuyThemUser) {
            btnHuyThemUser.addEventListener("click", () => {
                if (khungThemUser) khungThemUser.style.display = "none";
                if (formThemUser) formThemUser.reset();
                if (countdownThemUserInterval) clearInterval(countdownThemUserInterval);
                if (btnGuiOtpThemUser) {
                    btnGuiOtpThemUser.disabled = false;
                    btnGuiOtpThemUser.textContent = "Gửi mã xác thực";
                }
                if (newUserErrorMsg) newUserErrorMsg.style.display = "none";
                if (newUserSuccessMsg) newUserSuccessMsg.style.display = "none";
                if (newUserOtpHint) {
                    newUserOtpHint.textContent = "Bắt buộc xác thực email tồn tại thực tế để đảm bảo sau này có thể nhận OTP đổi mật khẩu.";
                    newUserOtpHint.style.color = "#64748b";
                }
            });
        }

        function sinhVaDienMatKhauNgauNhien() {
            const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$%";
            let pw = "Agri@2026!";
            for (let i = 0; i < 3; i++) {
                pw += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            if (inputNewPassword) inputNewPassword.value = pw;
        }

        if (btnTaoMkNgauNhien) {
            btnTaoMkNgauNhien.addEventListener("click", sinhVaDienMatKhauNgauNhien);
        }

        // Nút Gửi mã xác thực OTP tới email của tài khoản mới
        if (btnGuiOtpThemUser) {
            btnGuiOtpThemUser.addEventListener("click", async () => {
                const email = inputNewEmail ? inputNewEmail.value.trim() : "";
                const ho_ten = inputNewHoTen ? inputNewHoTen.value.trim() : "";

                if (!email) {
                    if (newUserErrorMsg) {
                        newUserErrorMsg.textContent = "Vui lòng nhập Email trước khi gửi mã xác thực!";
                        newUserErrorMsg.style.display = "block";
                    }
                    if (inputNewEmail) inputNewEmail.focus();
                    return;
                }

                if (newUserErrorMsg) newUserErrorMsg.style.display = "none";
                if (newUserSuccessMsg) newUserSuccessMsg.style.display = "none";
                btnGuiOtpThemUser.disabled = true;
                btnGuiOtpThemUser.textContent = "Đang gửi...";

                try {
                    const res = await fetchAuth("/api/users/yeu-cau-otp-tao-tk", {
                        method: "POST",
                        body: JSON.stringify({ email, ho_ten: ho_ten || "Người dùng" })
                    });
                    const data = await res.json().catch(() => ({}));
                    if (res.ok) {
                        if (newUserSuccessMsg) {
                            newUserSuccessMsg.textContent = data.message || "Mã xác thực đã được gửi về email!";
                            newUserSuccessMsg.style.display = "block";
                        }
                        if (newUserOtpHint) {
                            newUserOtpHint.textContent = `Mã OTP đã gửi tới ${email}. Vui lòng kiểm tra hộp thư!`;
                            newUserOtpHint.style.color = "#15803d";
                        }
                        if (inputNewOtp) inputNewOtp.focus();

                        let count = 60;
                        if (countdownThemUserInterval) clearInterval(countdownThemUserInterval);
                        countdownThemUserInterval = setInterval(() => {
                            count--;
                            if (count > 0) {
                                btnGuiOtpThemUser.textContent = `Gửi lại (${count}s)`;
                            } else {
                                clearInterval(countdownThemUserInterval);
                                btnGuiOtpThemUser.disabled = false;
                                btnGuiOtpThemUser.textContent = "Gửi lại mã";
                            }
                        }, 1000);
                    } else {
                        if (newUserErrorMsg) {
                            newUserErrorMsg.textContent = data.detail || "Không thể gửi mã xác thực!";
                            newUserErrorMsg.style.display = "block";
                        }
                        btnGuiOtpThemUser.disabled = false;
                        btnGuiOtpThemUser.textContent = "Gửi mã xác thực";
                    }
                } catch (err) {
                    if (newUserErrorMsg) {
                        newUserErrorMsg.textContent = "Lỗi kết nối khi gửi mã xác thực!";
                        newUserErrorMsg.style.display = "block";
                    }
                    btnGuiOtpThemUser.disabled = false;
                    btnGuiOtpThemUser.textContent = "Gửi mã xác thực";
                }
            });
        }

        // Xử lý gửi Form tạo tài khoản thủ công (BẮT BUỘC OTP)
        if (formThemUser) {
            formThemUser.addEventListener("submit", async (e) => {
                e.preventDefault();
                if (newUserErrorMsg) newUserErrorMsg.style.display = "none";
                if (newUserSuccessMsg) newUserSuccessMsg.style.display = "none";

                const email = inputNewEmail.value.trim();
                const ho_ten = inputNewHoTen.value.trim();
                const mat_khau = inputNewPassword.value;
                const role = selectNewRole.value;
                const otp_code = inputNewOtp ? inputNewOtp.value.trim() : "";

                if (!otp_code || otp_code.length !== 6) {
                    if (newUserErrorMsg) {
                        newUserErrorMsg.textContent = "Vui lòng bấm 'Gửi mã xác thực' và nhập đủ 6 số OTP gửi về email!";
                        newUserErrorMsg.style.display = "block";
                    }
                    if (inputNewOtp) inputNewOtp.focus();
                    return;
                }

                try {
                    const res = await fetchAuth("/api/users", {
                        method: "POST",
                        body: JSON.stringify({ email, ho_ten, mat_khau, role, otp_code })
                    });
                    const data = await res.json().catch(() => ({}));
                    if (res.ok) {
                        hienThiToast(data.message, "success");
                        formThemUser.reset();
                        if (countdownThemUserInterval) clearInterval(countdownThemUserInterval);
                        if (btnGuiOtpThemUser) {
                            btnGuiOtpThemUser.disabled = false;
                            btnGuiOtpThemUser.textContent = "Gửi mã xác thực";
                        }
                        if (khungThemUser) khungThemUser.style.display = "none";
                        await taiDanhSachUsersAdmin();
                    } else {
                        if (newUserErrorMsg) {
                            newUserErrorMsg.textContent = data.detail || "Không thể tạo tài khoản!";
                            newUserErrorMsg.style.display = "block";
                        }
                    }
                } catch (err) {
                    if (newUserErrorMsg) {
                        newUserErrorMsg.textContent = "Lỗi kết nối máy chủ!";
                        newUserErrorMsg.style.display = "block";
                    }
                }
            });
        }

        function capNhatBadgeCongAdmin() {
            if (appState.congDangKyOpen) {
                badgeGate.textContent = "Đang mở";
                badgeGate.className = "status-gate-badge gate-open";
                if (btnToggleCong) btnToggleCong.textContent = "Khóa Cổng";
            } else {
                badgeGate.textContent = "Đã khóa";
                badgeGate.className = "status-gate-badge gate-closed";
                if (btnToggleCong) btnToggleCong.textContent = "Mở Cổng";
            }
        }

        if (btnToggleCong) {
            btnToggleCong.addEventListener("click", async () => {
                const trangThaiMoi = !appState.congDangKyOpen;
                try {
                    const res = await fetchAuth("/api/system/registration-status", {
                        method: "PUT",
                        body: JSON.stringify({ cho_phep: trangThaiMoi })
                    });
                    const data = await res.json();
                    if (res.ok) {
                        appState.congDangKyOpen = data.is_open;
                        capNhatBadgeCongAdmin();
                        await kiemTraCongDangKy();
                        hienThiToast(data.message);
                    }
                } catch (err) {
                    hienThiToast("Lỗi khi thay đổi trạng thái cổng!", "error");
                }
            });
        }

        async function taiDanhSachUsersAdmin() {
            const tbody = document.getElementById("than-bang-users");
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px;">Đang tải danh sách tài khoản...</td></tr>`;

            try {
                const res = await fetchAuth("/api/users");
                if (res.ok) {
                    const users = await res.json();
                    tbody.innerHTML = "";

                    if (users.length === 0) {
                        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center;">Chưa có tài khoản nào.</td></tr>`;
                        return;
                    }
                    const tongSoAdmin = users.filter(usr => usr.role === 'admin').length;

                    users.forEach((u, idx) => {
                        const tr = document.createElement("tr");

                        const tdIdx = document.createElement("td");
                        tdIdx.textContent = idx + 1;
                        tdIdx.style.textAlign = "center";
                        tr.appendChild(tdIdx);

                        // Email
                        const tdEmail = document.createElement("td");
                        tdEmail.textContent = u.email;
                        tdEmail.style.fontWeight = "600";
                        tr.appendChild(tdEmail);

                        // Họ tên
                        const tdHoTen = document.createElement("td");
                        tdHoTen.textContent = u.ho_ten;
                        tr.appendChild(tdHoTen);

                        // Vai trò
                        const tdRole = document.createElement("td");
                        if (u.role === "admin") {
                            const spanRole = document.createElement("span");
                            spanRole.className = "role-badge role-admin";
                            spanRole.textContent = "Admin";
                            tdRole.appendChild(spanRole);
                        } else {
                            tdRole.textContent = "—";
                        }
                        tr.appendChild(tdRole);

                        // Ngày tạo
                        const tdNgay = document.createElement("td");
                        tdNgay.textContent = String(u.ngay_tao || "").split("T")[0] || "-";
                        tr.appendChild(tdNgay);

                        // Cột phân quyền & thao tác
                        const tdAction = document.createElement("td");
                        tdAction.className = "col-actions";

                        const isInitialSeed = (u.email.toLowerCase() === "admin@agribank.com.vn");
                        const isSelf = Boolean(appState.currentUser && (u.id === appState.currentUser.id || u.email.toLowerCase() === (appState.currentUser.email || '').toLowerCase()));

                        if (u.role === "admin") {
                            // TRƯỜNG HỢP ADMIN:
                            if (isInitialSeed && tongSoAdmin > 1) {
                                // TÀI KHOẢN KHỞI TẠO BÀN GIAO: Cho phép Admin xóa trực tiếp không cần mã OTP
                                const btnXoaBanGiao = document.createElement("button");
                                btnXoaBanGiao.className = "btn-table-danger";
                                btnXoaBanGiao.title = "Xóa vĩnh viễn tài khoản khởi tạo bàn giao";
                                btnXoaBanGiao.textContent = "Xóa TK Bàn Giao";
                                btnXoaBanGiao.addEventListener("click", async () => {
                                    if (!confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn tài khoản bàn giao (${u.email}) không? Thao tác này không thể hoàn tác.`)) {
                                        return;
                                    }
                                    try {
                                        const res = await fetchAuth(`/api/users/${u.id}`, { method: "DELETE" });
                                        const data = await res.json().catch(() => ({}));
                                        if (res.ok) {
                                            hienThiToast(data.message || "Đã xóa tài khoản bàn giao thành công!", "success");
                                            await taiDanhSachUsersAdmin();
                                        } else {
                                            hienThiToast(data.detail || "Không thể xóa tài khoản bàn giao!", "error");
                                        }
                                    } catch (err) {
                                        hienThiToast("Lỗi kết nối khi xóa tài khoản bàn giao!", "error");
                                    }
                                });
                                tdAction.appendChild(btnXoaBanGiao);
                            } else if (isSelf) {
                                // ADMIN ĐANG ĐĂNG NHẬP: HIỆN CHỮ 'BẠN' + NÚT TỰ HẠ CẤP VỀ NHÂN VIÊN
                                const spanShield = document.createElement("span");
                                spanShield.className = "badge-protected-admin";
                                spanShield.textContent = "Bạn";
                                tdAction.appendChild(spanShield);

                                const btnHaQuyen = document.createElement("button");
                                btnHaQuyen.className = "btn-table-demote";
                                btnHaQuyen.style.marginLeft = "8px";
                                if (tongSoAdmin <= 1) {
                                    btnHaQuyen.disabled = true;
                                    btnHaQuyen.title = "Hệ thống chỉ còn 1 Admin duy nhất, không thể hạ cấp!";
                                } else {
                                    btnHaQuyen.title = "Tự hạ cấp tài khoản của bạn về người dùng thông thường";
                                    btnHaQuyen.addEventListener("click", () => moModalXacThucHaQuyen());
                                }
                                btnHaQuyen.innerHTML = `
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg>
                                    <span>Hạ quyền</span>
                                `;
                                tdAction.appendChild(btnHaQuyen);

                                if (tongSoAdmin > 1) {
                                    const btnRutLui = document.createElement("button");
                                    btnRutLui.className = "btn-table-delete";
                                    btnRutLui.title = "Xóa tài khoản của bạn";
                                    btnRutLui.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>`;
                                    btnRutLui.style.marginLeft = "6px";
                                    btnRutLui.addEventListener("click", () => moModalXacThucXoaUser(u.id, u.email));
                                    tdAction.appendChild(btnRutLui);
                                }
                            } else {
                                // ADMIN CHÍNH THỨC KHÁC: BẢO VỆ TUYỆT ĐỐI
                                const spanShield = document.createElement("span");
                                spanShield.className = "badge-protected-admin";
                                spanShield.textContent = "Quản trị viên";
                                tdAction.appendChild(spanShield);
                            }
                        } else {
                            // NHÂN VIÊN: CÓ THỂ ĐƯỢC CẤP QUYỀN ADMIN HOẶC XÓA
                            const btnThangChuc = document.createElement("button");
                            btnThangChuc.className = "btn-table-action";
                            btnThangChuc.textContent = "Cấp quyền Admin";
                            btnThangChuc.addEventListener("click", () => doiQuyenUser(u.id, "admin", u.email));
                            tdAction.appendChild(btnThangChuc);

                            const btnXoa = document.createElement("button");
                            btnXoa.className = "btn-table-delete";
                            btnXoa.title = "Xóa tài khoản";
                            btnXoa.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>`;
                            btnXoa.style.marginLeft = "8px";
                            btnXoa.addEventListener("click", () => moModalXacThucXoaUser(u.id, u.email));
                            tdAction.appendChild(btnXoa);
                        }

                        tr.appendChild(tdAction);
                        tbody.appendChild(tr);
                    });
                }
            } catch (err) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: red;">Lỗi tải danh sách người dùng!</td></tr>`;
            }
        }

        async function doiQuyenUser(userId, roleMoi, email) {
            const roleName = roleMoi === 'admin' ? 'Quản Trị Viên' : 'Nhân Viên';
            if (!confirm(`Bạn có chắc muốn thăng chức tài khoản "${email}" lên ${roleName}? Người này sẽ có toàn quyền quản trị hệ thống.`)) return;

            try {
                const res = await fetchAuth(`/api/users/${userId}/role`, {
                    method: "PUT",
                    body: JSON.stringify({ role: roleMoi })
                });
                const data = await res.json();
                if (res.ok) {
                    hienThiToast(data.message);
                    taiDanhSachUsersAdmin();
                } else {
                    hienThiToast(data.detail || "Không thể đổi quyền!", "error");
                }
            } catch (err) {
                hienThiToast("Lỗi hệ thống khi đổi quyền!", "error");
            }
        }

        // =====================================================
        // XÁC THỰC OTP XÓA TÀI KHOẢN (BẢO VỆ 2 LỚP)
        // =====================================================
        let countdownXoaUserInterval = null;

        async function moModalXacThucXoaUser(userId, email) {
            const isSelf = Boolean(appState.currentUser && (String(userId) === String(appState.currentUser.id) || email.toLowerCase() === (appState.currentUser.email || '').toLowerCase()));
            if (isSelf && appState.soLuongAdmin <= 1) {
                hienThiToast("Không thể xóa Quản trị viên duy nhất còn lại của hệ thống!", "error");
                return;
            }

            const modalXoaUser = document.getElementById("modal-xac-thuc-xoa-user");
            const formXoaUser = document.getElementById("form-xac-thuc-xoa-user");
            const errBox = document.getElementById("xoa-user-error-msg");
            const sucBox = document.getElementById("xoa-user-success-msg");
            const inputTargetId = document.getElementById("xoa-user-target-id");
            const textTargetEmail = document.getElementById("xoa-user-target-email");
            const inputOtp = document.getElementById("otp-xoa-user-input");

            if (formXoaUser) formXoaUser.reset();
            if (inputTargetId) inputTargetId.value = userId;
            if (textTargetEmail) textTargetEmail.textContent = email;
            if (errBox) errBox.style.display = "none";
            if (sucBox) sucBox.style.display = "none";
            if (modalXoaUser) modalXoaUser.style.display = "flex";

            await guiOtpXoaUser(userId);
            if (inputOtp) inputOtp.focus();
        }

        async function guiOtpXoaUser(userId) {
            const btnResend = document.getElementById("btn-gui-lai-otp-xoa-user");
            const hint = document.getElementById("otp-xoa-user-hint");
            const errBox = document.getElementById("xoa-user-error-msg");
            const sucBox = document.getElementById("xoa-user-success-msg");

            if (btnResend) {
                btnResend.disabled = true;
                btnResend.textContent = "Đang gửi...";
            }
            if (errBox) errBox.style.display = "none";

            try {
                const res = await fetchAuth(`/api/users/${userId}/yeu-cau-otp-xoa`, { method: "POST" });
                const data = await res.json().catch(() => ({}));
                if (res.ok) {
                    if (sucBox) {
                        sucBox.textContent = data.message || "Mã OTP đã được gửi đến email Quản trị viên!";
                        sucBox.style.display = "block";
                    }
                    if (hint) {
                        hint.textContent = `Mã OTP 6 số đã được gửi tới email ${appState.currentUser ? appState.currentUser.email : ''}. Vui lòng kiểm tra hộp thư!`;
                        hint.style.color = "#15803d";
                    }
                    let count = 60;
                    if (countdownXoaUserInterval) clearInterval(countdownXoaUserInterval);
                    countdownXoaUserInterval = setInterval(() => {
                        count--;
                        if (btnResend) {
                            if (count > 0) {
                                btnResend.textContent = `Gửi lại (${count}s)`;
                            } else {
                                clearInterval(countdownXoaUserInterval);
                                btnResend.disabled = false;
                                btnResend.textContent = "Gửi lại mã";
                            }
                        }
                    }, 1000);
                } else {
                    if (errBox) {
                        errBox.textContent = data.detail || `Không thể gửi mã OTP (Mã lỗi ${res.status})!`;
                        errBox.style.display = "block";
                    }
                    if (btnResend) {
                        btnResend.disabled = false;
                        btnResend.textContent = "Gửi lại mã";
                    }
                }
            } catch (err) {
                console.error("[OTP XÓA USER LỖI]:", err);
                if (errBox) {
                    errBox.textContent = err.message === "Unauthorized" ? "Phiên làm việc hết hạn, vui lòng đăng nhập lại!" : "Lỗi kết nối khi gửi OTP!";
                    errBox.style.display = "block";
                }
                if (btnResend) {
                    btnResend.disabled = false;
                    btnResend.textContent = "Gửi lại mã";
                }
            }
        }

        const formXacThucXoaUser = document.getElementById("form-xac-thuc-xoa-user");
        if (formXacThucXoaUser) {
            formXacThucXoaUser.addEventListener("submit", async function(e) {
                e.preventDefault();
                const targetId = document.getElementById("xoa-user-target-id").value;
                const targetEmail = document.getElementById("xoa-user-target-email").textContent;
                const otpVal = document.getElementById("otp-xoa-user-input").value.trim();
                const errBox = document.getElementById("xoa-user-error-msg");
                const btnSubmit = document.getElementById("btn-submit-xoa-user");

                if (!otpVal || otpVal.length !== 6) {
                    if (errBox) {
                        errBox.textContent = "Vui lòng nhập đầy đủ 6 chữ số OTP!";
                        errBox.style.display = "block";
                    }
                    return;
                }

                if (btnSubmit) {
                    btnSubmit.disabled = true;
                    btnSubmit.textContent = "Đang xóa...";
                }
                if (errBox) errBox.style.display = "none";

                try {
                    const res = await fetchAuth(`/api/users/${targetId}?otp_code=${encodeURIComponent(otpVal)}`, {
                        method: "DELETE"
                    });
                    const data = await res.json();
                    if (res.ok) {
                        const modalXoaUser = document.getElementById("modal-xac-thuc-xoa-user");
                        if (modalXoaUser) modalXoaUser.style.display = "none";
                        if (countdownXoaUserInterval) clearInterval(countdownXoaUserInterval);

                        hienThiToast(data.message || `Đã xóa tài khoản "${targetEmail}" thành công!`, "info");

                        if (appState.currentUser && String(appState.currentUser.id) === String(targetId)) {
                            hienThiToast("Bạn đã xóa tài khoản đang đăng nhập. Đang đăng xuất...", "info");
                            setTimeout(xuLyDangXuat, 1500);
                        } else {
                            await taiDanhSachUsersAdmin();
                        }
                    } else {
                        if (errBox) {
                            errBox.textContent = data.detail || "Không thể xóa tài khoản!";
                            errBox.style.display = "block";
                        }
                        hienThiToast(data.detail || "Không thể xóa tài khoản!", "error");
                    }
                } catch (err) {
                    if (errBox) {
                        errBox.textContent = "Lỗi kết nối khi gửi yêu cầu xóa!";
                        errBox.style.display = "block";
                    }
                    hienThiToast("Lỗi kết nối khi gửi yêu cầu xóa!", "error");
                } finally {
                    if (btnSubmit) {
                        btnSubmit.disabled = false;
                        btnSubmit.textContent = "Xác Nhận Xóa";
                    }
                }
            });
        }

        const btnDongModalXoaUser = document.getElementById("btn-dong-modal-xoa-user");
        const btnHuyXoaUser = document.getElementById("btn-huy-xoa-user");
        const dongModalXoaUserHandler = () => {
            const m = document.getElementById("modal-xac-thuc-xoa-user");
            if (m) m.style.display = "none";
            if (countdownXoaUserInterval) clearInterval(countdownXoaUserInterval);
        };
        if (btnDongModalXoaUser) btnDongModalXoaUser.addEventListener("click", dongModalXoaUserHandler);
        if (btnHuyXoaUser) btnHuyXoaUser.addEventListener("click", dongModalXoaUserHandler);

        const btnGuiLaiOtpXoaUser = document.getElementById("btn-gui-lai-otp-xoa-user");
        if (btnGuiLaiOtpXoaUser) {
            btnGuiLaiOtpXoaUser.addEventListener("click", () => {
                const targetId = document.getElementById("xoa-user-target-id").value;
                if (targetId) guiOtpXoaUser(targetId);
            });
        }
    }

    // =====================================================
    // 12. THÔNG BÁO TOAST POPUP
    // =====================================================
    function hienThiToast(tinNhan, loai = "success") {
        const toastContainer = document.getElementById("toast-container");
        const toast = document.createElement("div");
        toast.className = `toast toast-${loai}`;

        toast.innerHTML = `<span class="toast-dot toast-dot-${loai}"></span> <span>${tinNhan}</span>`;
        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = "0";
            toast.style.transform = "translateX(100%)";
            toast.style.transition = "all 0.3s ease";
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

});