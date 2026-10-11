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
                        td.textContent = dinhDangTien(soVal);
                        tongTungCotSo[cot.id] = (tongTungCotSo[cot.id] || 0) + soVal;

                        if (cot.id === "luong_thang") tongLuongCoBan += soVal;
                        if (cot.id === "luong_thuong") tongLuongThuong += soVal;
                    } else {
                        // CHỐNG XSS: Dùng textContent tuyệt đối an toàn
                        td.textContent = String(giaTri);
                    }
                    tr.appendChild(td);
                });

                const tdTong = document.createElement("td");
                tdTong.className = "col-tong";
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
                    hienThiToast(`Đã thêm cột "${tenCot}" thành công!`);
                } else {
                    const err = await res.json();
                    hienThiToast(err.detail || "Không thể thêm cột!", "error");
                }
            } catch (err) {
                hienThiToast("Lỗi khi thêm cột!", "error");
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
            }
        } catch (err) {
            hienThiToast("Lỗi khi xóa cột!", "error");
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

        // 2. Submit Đăng ký
        formReg.addEventListener("submit", async function(e) {
            e.preventDefault();
            const email = document.getElementById("reg-email").value.trim();
            const ho_ten = document.getElementById("reg-hoten").value.trim();
            const password = document.getElementById("reg-password").value.trim();
            const errMsg = document.getElementById("reg-error-msg");
            const successMsg = document.getElementById("reg-success-msg");

            errMsg.style.display = "none";
            successMsg.style.display = "none";

            try {
                const res = await fetch(`${API_URL}/api/auth/register`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, ho_ten, password })
                });
                const data = await res.json();

                if (res.ok) {
                    successMsg.textContent = data.message;
                    successMsg.style.display = "block";
                    formReg.reset();
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
        // 9. MODAL ĐỔI MẬT KHẨU CÁ NHÂN
        // =====================================================
        // 9. MODAL ĐỔI MẬT KHẨU CÁ NHÂN (XÁC THỰC EMAIL OTP)
        // =====================================================
        const modalDoiMk = document.getElementById("modal-doi-mat-khau");
        const btnMoDoiMk = document.getElementById("btn-mo-modal-doi-mk");
        const btnDongDoiMk = document.getElementById("btn-dong-modal-doi-mk");
        const btnHuyDoiMk = document.getElementById("btn-huy-doi-mk");
        const formDoiMk = document.getElementById("form-doi-mat-khau");
        const doiMkErr = document.getElementById("doi-mk-error");
        const btnGuiOtpDoiMk = document.getElementById("btn-gui-otp-doi-mk");
        const textOtpStatus = document.getElementById("text-otp-status");
        const inputOtpDoiMk = document.getElementById("mk-otp-code");

        let cooldownDoiMkOtp = 0;
        let timerDoiMkOtp = null;

        if (btnMoDoiMk) {
            btnMoDoiMk.addEventListener("click", () => {
                if (formDoiMk) formDoiMk.reset();
                if (doiMkErr) doiMkErr.style.display = "none";
                if (textOtpStatus) {
                    textOtpStatus.textContent = "Bấm 'Gửi Mã OTP' để nhận mã xác thực qua hòm thư Email đăng ký.";
                    textOtpStatus.style.color = "#64748b";
                }
                modalDoiMk.style.display = "flex";
            });
        }

        const dongModalDoiMkHandler = () => {
            if (modalDoiMk) modalDoiMk.style.display = "none";
            if (doiMkErr) doiMkErr.style.display = "none";
        };
        if (btnDongDoiMk) btnDongDoiMk.addEventListener("click", dongModalDoiMkHandler);
        if (btnHuyDoiMk) btnHuyDoiMk.addEventListener("click", dongModalDoiMkHandler);

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
                        if (textOtpStatus) {
                            textOtpStatus.textContent = data.message;
                            textOtpStatus.style.color = "#059669";
                        }
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
                        if (textOtpStatus) {
                            textOtpStatus.textContent = data.detail || "Gửi OTP thất bại.";
                            textOtpStatus.style.color = "#dc2626";
                        }
                    }
                } catch (err) {
                    btnGuiOtpDoiMk.disabled = false;
                    btnGuiOtpDoiMk.textContent = "Gửi Mã OTP";
                    hienThiToast("Lỗi kết nối khi gửi OTP!", "error");
                }
            });
        }

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
                        dongModalDoiMkHandler();
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
        const newUserErrorMsg = document.getElementById("new-user-error-msg");

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
                if (newUserErrorMsg) newUserErrorMsg.style.display = "none";
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

        // Xử lý gửi Form tạo tài khoản thủ công
        if (formThemUser) {
            formThemUser.addEventListener("submit", async (e) => {
                e.preventDefault();
                if (newUserErrorMsg) newUserErrorMsg.style.display = "none";

                const email = inputNewEmail.value.trim();
                const ho_ten = inputNewHoTen.value.trim();
                const mat_khau = inputNewPassword.value;
                const role = selectNewRole.value;

                try {
                    const res = await fetchAuth("/api/users", {
                        method: "POST",
                        body: JSON.stringify({ email, ho_ten, mat_khau, role })
                    });
                    const data = await res.json();
                    if (res.ok) {
                        hienThiToast(data.message, "success");
                        formThemUser.reset();
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
                        const isSelf = (appState.currentUser && u.id === appState.currentUser.id);

                        if (u.role === "admin") {
                            // TRƯỜNG HỢP ADMIN:
                            if (isInitialSeed && tongSoAdmin > 1) {
                                // TÀI KHOẢN KHỞI TẠO BÀN GIAO: Cho phép xóa khi đã có Admin khác
                                const btnXoaBanGiao = document.createElement("button");
                                btnXoaBanGiao.className = "btn-table-danger";
                                btnXoaBanGiao.title = "Xóa tài khoản khởi tạo bàn giao";
                                btnXoaBanGiao.textContent = "Xóa TK Bàn Giao";
                                btnXoaBanGiao.addEventListener("click", () => xoaUser(u.id, u.email));
                                tdAction.appendChild(btnXoaBanGiao);
                            } else if (isSelf && tongSoAdmin > 1) {
                                // ADMIN TỰ XÓA MÌNH (RÚT LUI AN TOÀN NẾU ĐÃ CÓ ADMIN KHÁC)
                                const spanShield = document.createElement("span");
                                spanShield.className = "badge-protected-admin";
                                spanShield.textContent = "Bạn";
                                tdAction.appendChild(spanShield);

                                const btnRutLui = document.createElement("button");
                                btnRutLui.className = "btn-table-delete";
                                btnRutLui.title = "Xóa tài khoản của bạn";
                                btnRutLui.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>`;
                                btnRutLui.style.marginLeft = "8px";
                                btnRutLui.addEventListener("click", () => xoaUser(u.id, u.email));
                                tdAction.appendChild(btnRutLui);
                            } else {
                                // ADMIN CHÍNH THỨC: BẢO VỆ TUYỆT ĐỐI
                                const spanShield = document.createElement("span");
                                spanShield.className = "badge-protected-admin";
                                spanShield.textContent = isSelf ? "Bạn" : "Quản trị viên";
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
                            btnXoa.addEventListener("click", () => xoaUser(u.id, u.email));
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

        async function xoaUser(userId, email) {
            const isBoot = (email.toLowerCase() === "admin@agribank.com.vn");
            const msg = isBoot 
                ? `XÁC NHẬN HOÀN TẤT BÀN GIAO:\nBạn có chắc muốn XÓA VĨNH VIỄN tài khoản khởi tạo mặc định "${email}"?\n(Sau khi xóa, chỉ các tài khoản Quản trị viên cá nhân do bạn quản lý mới có quyền vào hệ thống).`
                : `Bạn có chắc muốn XÓA VĨNH VIỄN tài khoản "${email}"? Người này sẽ không thể đăng nhập được nữa.`;

            if (!confirm(msg)) return;

            try {
                const res = await fetchAuth(`/api/users/${userId}`, { method: "DELETE" });
                const data = await res.json();
                if (res.ok) {
                    hienThiToast(data.message, "info");
                    if (appState.currentUser && appState.currentUser.id === userId) {
                        hienThiToast("Bạn đã xóa tài khoản đang đăng nhập. Đang đăng xuất...", "info");
                        setTimeout(xuLyDangXuat, 1500);
                    } else {
                        taiDanhSachUsersAdmin();
                    }
                } else {
                    hienThiToast(data.detail || "Không thể xóa tài khoản!", "error");
                }
            } catch (err) {
                hienThiToast("Lỗi hệ thống khi xóa tài khoản!", "error");
            }
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