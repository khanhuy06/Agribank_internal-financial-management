document.addEventListener("DOMContentLoaded", function() {
    
    // ==========================================
    // 1. TÌM CHÌA KHÓA & CHUẨN BỊ KÉT SẮT
    // ==========================================
    const urlParams = new URLSearchParams(window.location.search);
    let thangHienTai = urlParams.get('m') || "1"; 
    // Tạo tên ngăn kéo riêng cho từng tháng (VD: du_lieu_thang_1, du_lieu_thang_2)
    let tenNganKeo = "du_lieu_thang_" + thangHienTai; 

    // Các thành phần giao diện
    const nutThem = document.getElementById("nut-them-dong");
    const matKinh = document.getElementById("tam-kinh-mo"); 
    const nutTat = document.getElementById("nut-x");
    const nutLuu = document.getElementById("nut-luu");
    const benDo = document.getElementById("ben-do-du-lieu");
    const khuon = document.querySelector("#khuon-duc-dong-moi tr");

    // Bật tắt hộp thoại nhập liệu
    if (nutThem && matKinh) nutThem.addEventListener("click", () => matKinh.style.display = "flex");
    if (nutTat && matKinh) nutTat.addEventListener("click", () => matKinh.style.display = "none");

    // ==========================================
    // 2. CÁC HÀM "PHÉP THUẬT" LƯU TRỮ VÀ SẮP XẾP
    // ==========================================
    
    // Hàm cất dữ liệu vào két sắt LocalStorage
    function luuVaoKetSat() {
        let danhSachGiaoDich = [];
        let cacDong = benDo.querySelectorAll("tr");
        
        // Gom số liệu từ bảng lại thành 1 mảng (Giống dùng Struct trong C)
        cacDong.forEach(function(dong) {
            danhSachGiaoDich.push({
                id: dong.querySelector(".cot-id").textContent,
                luong: dong.querySelector(".cot-luong").textContent,
                thuong: dong.querySelector(".cot-thuong").textContent,
                tong: dong.querySelector(".cot-tong").textContent
            });
        });
        
        // Đóng gói mảng thành chuỗi JSON và cất vào đúng ngăn kéo
        localStorage.setItem(tenNganKeo, JSON.stringify(danhSachGiaoDich));
    }

    // Hàm lấy dữ liệu từ két bơm ra bảng
    function layTuKetSat() {
        let duLieuCu = localStorage.getItem(tenNganKeo);
        if (duLieuCu) {
            let danhSachGiaoDich = JSON.parse(duLieuCu); // Dịch từ JSON về lại Mảng
            
            danhSachGiaoDich.forEach(function(giaoDich) {
                const banSao = khuon.cloneNode(true);
                banSao.querySelector(".cot-id").textContent = giaoDich.id;
                banSao.querySelector(".cot-luong").textContent = giaoDich.luong;
                banSao.querySelector(".cot-thuong").textContent = giaoDich.thuong;
                banSao.querySelector(".cot-tong").textContent = giaoDich.tong;
                
                // Gắn lại cảm biến sửa số cho các dòng cũ
                banSao.addEventListener("input", function() {
                    let luongMoi = banSao.querySelector(".cot-luong").textContent;
                    let thuongMoi = banSao.querySelector(".cot-thuong").textContent;
                    banSao.querySelector(".cot-tong").textContent = Number(luongMoi) + Number(thuongMoi);
                    sapXepBang(); // Sửa ID thì tự xếp lại
                    luuVaoKetSat(); // BẤT CỨ KHI NÀO CÓ THAY ĐỔI LÀ PHẢI LƯU KÉT!
                });

                // Gắn lại nút xóa cho các dòng cũ
                let nutXoa = banSao.querySelector(".nut-xoa");
                nutXoa.addEventListener("click", function() {
                    if (confirm("Chắc chắn muốn xóa giao dịch ID " + giaoDich.id + " không?")) {
                        banSao.remove();
                        luuVaoKetSat(); // XÓA XONG CŨNG PHẢI LƯU KÉT!
                    }
                });

                benDo.appendChild(banSao);
            });
        }
    }

    function sapXepBang() {
        let cacDong = Array.from(benDo.querySelectorAll("tr"));
        cacDong.sort(function(dongA, dongB) {
            return Number(dongA.querySelector(".cot-id").textContent) - Number(dongB.querySelector(".cot-id").textContent);
        });
        benDo.innerHTML = "";
        cacDong.forEach(dong => benDo.appendChild(dong));
        
        luuVaoKetSat(); // SẮP XẾP XONG CŨNG LƯU KÉT!
    }

    // ==========================================
    // 3. KHỞI ĐỘNG VÀ XỬ LÝ NÚT LƯU MỚI
    // ==========================================
    
    // VỪA MỞ TRANG WEB LÀ GỌI HÀM LẤY DỮ LIỆU TỪ KÉT RA NGAY!
    layTuKetSat();

    if (nutLuu) {
        const inputId = document.getElementById("nhap-id");
        const inputLuong = document.getElementById("nhap-luong");
        const inputThuong = document.getElementById("nhap-thuong");

        nutLuu.addEventListener("click", function() {
            let id = inputId.value;
            let luong = inputLuong.value;
            let thuong = inputThuong.value;
            
            if (id.trim() === "") { alert("Ê! Ít nhất cũng phải nhập cái ID chứ!"); return; }
            if (luong.trim() === "") luong = "0";
            if (thuong.trim() === "") thuong = "0";

            const banSao = khuon.cloneNode(true);
            banSao.querySelector(".cot-id").textContent = id;
            banSao.querySelector(".cot-luong").textContent = luong;
            banSao.querySelector(".cot-thuong").textContent = thuong;
            banSao.querySelector(".cot-tong").textContent = Number(luong) + Number(thuong);

            banSao.addEventListener("input", function() {
                let luongMoi = banSao.querySelector(".cot-luong").textContent;
                let thuongMoi = banSao.querySelector(".cot-thuong").textContent;
                banSao.querySelector(".cot-tong").textContent = Number(luongMoi) + Number(thuongMoi);
                sapXepBang();
                luuVaoKetSat();
            });

            banSao.querySelector(".nut-xoa").addEventListener("click", function() {
                if (confirm("Chắc chắn muốn xóa giao dịch ID " + banSao.querySelector(".cot-id").textContent + " không?")) {
                    banSao.remove();
                    luuVaoKetSat();
                }
            });

            benDo.appendChild(banSao);
            sapXepBang(); // Hàm sắp xếp đã tự gọi luuVaoKetSat() bên trong rồi!

            matKinh.style.display = "none";
            inputId.value = "";
            inputLuong.value = "";
            inputThuong.value = "";
        });
    }

// ==========================================
    // TÍNH NĂNG MỚI: ĐỌC FILE EXCEL
    // ==========================================
    const nutNhapExcel = document.getElementById("nhap-excel");
    
    if (nutNhapExcel) {
        nutNhapExcel.addEventListener("change", function(e) {
            let file = e.target.files[0];
            if (!file) return;

            let reader = new FileReader();
            
            // Đọc file dưới dạng nhị phân
            reader.readAsArrayBuffer(file);
            
            reader.onload = function(suKien) {
                let data = new Uint8Array(suKien.target.result);
                // Dùng thư viện XLSX để giải mã file
                let workbook = XLSX.read(data, {type: 'array'});
                
                // Mở sheet đầu tiên trong file Excel
                let tenSheetDauTien = workbook.SheetNames[0];
                let sheet = workbook.Sheets[tenSheetDauTien];
                
                // Chuyển toàn bộ dữ liệu trong sheet thành một Mảng (Array)
                let duLieuExcel = XLSX.utils.sheet_to_json(sheet, {header: 1});

                // Giả định dòng 1 (index 0) là chữ tiêu đề, dòng 2 (index 1) là số liệu
                if (duLieuExcel.length > 1) {
                    let dongSoLieu = duLieuExcel[1]; // Lấy dòng số liệu đầu tiên
                    
                    // Bắn số liệu vào các ô input trên màn hình
                    document.getElementById("nhap-id").value = dongSoLieu[0] || "";
                    document.getElementById("nhap-luong").value = dongSoLieu[1] || "";
                    document.getElementById("nhap-thuong").value = dongSoLieu[2] || "";
                    
                    alert("Đã bốc thành công dữ liệu từ file Excel!");
                } else {
                    alert("File Excel này trống trơn hoặc không đúng định dạng!");
                }
            };
        });
    }

});