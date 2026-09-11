// =========================================================
// HỆ THỐNG QUẢN LÝ TÀI CHÍNH AGRIBANK (CHI NHÁNH HOÀN LÃO)
// JAVASCRIPT ĐIỀU HÀNH GIAO DIỆN SPA & BẢNG LƯƠNG ĐỘNG
// =========================================================

document.addEventListener("DOMContentLoaded", function() {
    
    // =====================================================
    // 1. KHỞI TẠO TRẠNG THÁI ỨNG DỤNG (APP STATE)
    // =====================================================
    let appState = {
        thangHienTai: 1,
        namHienTai: 2026,
        tuKhoaTimKiem: "",
        
        // Cấu hình danh sách cột (Mặc định + Cột tùy chỉnh do người dùng thêm)
        danhSachCot: [
            { id: "ma_nv", ten: "Mã NV / ID", kieu: "chu", macDinh: true },
            { id: "ho_ten", ten: "Họ và Tên", kieu: "chu", macDinh: true },
            { id: "luong_thang", ten: "Lương Tháng", kieu: "so", macDinh: true },
            { id: "luong_thuong", ten: "Lương Thưởng", kieu: "so", macDinh: true }
        ],
        
        // Bộ nhớ dữ liệu theo tháng: key có dạng "du_lieu_2026_1"
        duLieu: {}
    };

    // =====================================================
    // 2. KHỞI CHẠY VÀ NẠP DỮ LIỆU BAN ĐẦU
    // =====================================================
    khoiPhucDuLieuTuBoNho();
    khoiTaoMenu12Thang();
    dangKySuKien();
    capNhatToanBoGiaoDien();

    // =====================================================
    // 3. CÁC HÀM LƯU TRỮ VÀ KHÔI PHỤC (LOCAL STORAGE / CACHE)
    // =====================================================
    function luuVaoBoNho() {
        const keyDuLieu = `agribank_data_${appState.namHienTai}_${appState.thangHienTai}`;
        const keyCot = `agribank_columns_${appState.namHienTai}`;
        
        localStorage.setItem(keyCot, JSON.stringify(appState.danhSachCot));
        localStorage.setItem(keyDuLieu, JSON.stringify(appState.duLieu[keyDuLieu] || []));
    }

    function khoiPhucDuLieuTuBoNho() {
        // Nạp cấu hình cột đã lưu (nếu có)
        const keyCot = `agribank_columns_${appState.namHienTai}`;
        const cotDaLuu = localStorage.getItem(keyCot);
        if (cotDaLuu) {
            try {
                appState.danhSachCot = JSON.parse(cotDaLuu);
            } catch (e) {
                console.error("Lỗi nạp cấu hình cột:", e);
            }
        }

        // Nạp dữ liệu tháng hiện tại
        nạpDuLieuThang(appState.thangHienTai);
    }

    function nạpDuLieuThang(thang) {
        const keyDuLieu = `agribank_data_${appState.namHienTai}_${thang}`;
        const duLieuLuu = localStorage.getItem(keyDuLieu);
        
        if (duLieuLuu) {
            try {
                appState.duLieu[keyDuLieu] = JSON.parse(duLieuLuu);
            } catch (e) {
                appState.duLieu[keyDuLieu] = [];
            }
        } else {
            // Nếu là tháng 1 chưa có gì, tạo mẫu 2 dòng ban đầu cho sinh động
            if (thang === 1 && !localStorage.getItem("agribank_khoi_tao_mau")) {
                appState.duLieu[keyDuLieu] = [
                    { ma_nv: "AG001", ho_ten: "Nguyễn Văn An", luong_thang: 18500000, luong_thuong: 3500000 },
                    { ma_nv: "AG002", ho_ten: "Trần Thị Mai", luong_thang: 16000000, luong_thuong: 2500000 }
                ];
                localStorage.setItem("agribank_khoi_tao_mau", "true");
                luuVaoBoNho();
            } else {
                appState.duLieu[keyDuLieu] = [];
            }
        }
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
            btn.addEventListener("click", () => {
                appState.thangHienTai = t;
                nạpDuLieuThang(t);
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
                tdActions.querySelector(".btn-delete").addEventListener("click", () => xoaDong(index, item.ma_nv || item.ho_ten));

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
    // 6. XỬ LÝ MODAL THÊM CỘT TÙY CHỈNH (SỐ HOẶC CHỮ)
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

    formThemCot.addEventListener("submit", function(e) {
        e.preventDefault();
        const tenCot = document.getElementById("ten-cot-moi").value.trim();
        const kieuCot = document.getElementById("kieu-cot-moi").value;

        if (!tenCot) {
            hienThiToast("Vui lòng nhập tên cột!", "error");
            return;
        }

        // Tạo id duy nhất cho cột mới (vd: cot_1741512345)
        const idCot = "cot_" + Date.now();
        
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

    function xoaCotTuyChinh(idCot, tenCot) {
        if (!confirm(`Bạn có chắc chắn muốn xóa cột "${tenCot}"? Dữ liệu của cột này sẽ bị ẩn.`)) return;

        appState.danhSachCot = appState.danhSachCot.filter(c => c.id !== idCot);
        luuVaoBoNho();
        veBangDuLieu();
        hienThiToast(`Đã xóa cột "${tenCot}" thành công!`, "info");
    }

    // =====================================================
    // 7. XỬ LÝ MODAL THÊM & SỬA DÒNG DỮ LIỆU
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

    formNhapLieu.addEventListener("submit", function(e) {
        e.preventDefault();
        const danhSach = layDanhSachHienTai();
        const editIndex = editRowIndexInput.value;

        let banGhiMoi = {};
        const inputs = khungCacONhap.querySelectorAll("input");
        inputs.forEach(input => {
            const id = input.name;
            const kieu = input.dataset.kieu;
            if (kieu === "so") {
                banGhiMoi[id] = Number(input.value) || 0;
            } else {
                banGhiMoi[id] = input.value.trim();
            }
        });

        if (editIndex !== "") {
            // Chỉnh sửa dòng cũ
            danhSach[Number(editIndex)] = banGhiMoi;
            hienThiToast("Đã cập nhật thông tin thành công!");
        } else {
            // Thêm mới
            danhSach.push(banGhiMoi);
            hienThiToast("Đã thêm giao dịch mới thành công!");
        }

        ganDanhSachHienTai(danhSach);
        veBangDuLieu();
        dongModalNhapHandler();
    });

    function xoaDong(index, tenHienThi) {
        if (confirm(`Bạn có chắc chắn muốn xóa giao dịch (${tenHienThi}) này không?`)) {
            let danhSach = layDanhSachHienTai();
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
    
    // Xuất file Excel bảng lương tháng hiện tại
    document.getElementById("btn-xuat-excel").addEventListener("click", function() {
        const danhSach = layDanhSachHienTai();
        if (danhSach.length === 0) {
            hienThiToast("Không có dữ liệu trong tháng này để xuất Excel!", "error");
            return;
        }

        // Tạo mảng 2 chiều cho bảng tính
        let duLieuXuat = [];
        
        // 1. Dòng tiêu đề cột
        let tieuDe = appState.danhSachCot.map(c => c.ten);
        tieuDe.push("Tổng Cộng");
        duLieuXuat.push(tieuDe);

        // 2. Các dòng dữ liệu
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

        // 3. Dòng tổng kết
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

        // Dùng SheetJS tạo Workbook và tải file
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
        
        reader.onload = function(evt) {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, { type: "array" });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                
                // Đọc ra mảng JSON theo dòng (header: 1 là trả về mảng 2 chiều)
                const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                if (rows.length < 2) {
                    hienThiToast("File Excel không có dữ liệu hợp lệ!", "error");
                    return;
                }

                // Giả định dòng 0 là Header, từ dòng 1 trở đi là số liệu
                let danhSachMoi = layDanhSachHienTai().slice();
                let soDongThem = 0;

                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i];
                    if (!row || row.length === 0 || !row[0]) continue; // Bỏ qua dòng trống
                    
                    let banGhi = {
                        ma_nv: String(row[0] || `AG_${Date.now()}`),
                        ho_ten: String(row[1] || ""),
                        luong_thang: Number(row[2]) || 0,
                        luong_thuong: Number(row[3]) || 0
                    };

                    // Nếu có thêm các cột tiếp theo, nạp tiếp vào các cột tùy chỉnh
                    for (let cIdx = 4; cIdx < row.length; cIdx++) {
                        const cotTuyChinhIndex = cIdx - 4;
                        if (appState.danhSachCot[4 + cotTuyChinhIndex]) {
                            const cot = appState.danhSachCot[4 + cotTuyChinhIndex];
                            banGhi[cot.id] = cot.kieu === 'so' ? (Number(row[cIdx]) || 0) : String(row[cIdx] || "");
                        }
                    }

                    danhSachMoi.push(banGhi);
                    soDongThem++;
                }

                ganDanhSachHienTai(danhSachMoi);
                veBangDuLieu();
                hienThiToast(`Đã nạp thành công ${soDongThem} nhân viên từ file Excel!`);
                inputImportExcel.value = ""; // Reset input
            } catch (err) {
                console.error(err);
                hienThiToast("Lỗi khi đọc file Excel: " + err.message, "error");
            }
        };
    });

    // =====================================================
    // 10. CHỌN NĂM TÀI CHÍNH & TOAST NOTIFICATION
    // =====================================================
    function dangKySuKien() {
        const chonNam = document.getElementById("chon-nam");
        chonNam.addEventListener("change", function(e) {
            appState.namHienTai = Number(e.target.value);
            khoiPhucDuLieuTuBoNho();
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