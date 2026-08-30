document.addEventListener("DOMContentLoaded", function() {
    
    
    const urlParams = new URLSearchParams(window.location.search);
    let thangHienTai = urlParams.get('m') || "1"; 
  
    let tenNganKeo = "du_lieu_thang_" + thangHienTai; 

   
    const nutThem = document.getElementById("nut-them-dong");
    const matKinh = document.getElementById("tam-kinh-mo"); 
    const nutTat = document.getElementById("nut-x");
    const nutLuu = document.getElementById("nut-luu");
    const benDo = document.getElementById("ben-do-du-lieu");
    const khuon = document.querySelector("#khuon-duc-dong-moi tr");

   
    if (nutThem && matKinh) nutThem.addEventListener("click", () => matKinh.style.display = "flex");
    if (nutTat && matKinh) nutTat.addEventListener("click", () => matKinh.style.display = "none");

   
    function luuVaoKetSat() {
        let danhSachGiaoDich = [];
        let cacDong = benDo.querySelectorAll("tr");
        
      
        cacDong.forEach(function(dong) {
            danhSachGiaoDich.push({
                id: dong.querySelector(".cot-id").textContent,
                luong: dong.querySelector(".cot-luong").textContent,
                thuong: dong.querySelector(".cot-thuong").textContent,
                tong: dong.querySelector(".cot-tong").textContent
            });
        });
        
      
        localStorage.setItem(tenNganKeo, JSON.stringify(danhSachGiaoDich));
    }

   
    function layTuKetSat() {
        let duLieuCu = localStorage.getItem(tenNganKeo);
        if (duLieuCu) {
            let danhSachGiaoDich = JSON.parse(duLieuCu);
            
            danhSachGiaoDich.forEach(function(giaoDich) {
                const banSao = khuon.cloneNode(true);
                banSao.querySelector(".cot-id").textContent = giaoDich.id;
                banSao.querySelector(".cot-luong").textContent = giaoDich.luong;
                banSao.querySelector(".cot-thuong").textContent = giaoDich.thuong;
                banSao.querySelector(".cot-tong").textContent = giaoDich.tong;
                
                
                banSao.addEventListener("input", function() {
                    let luongMoi = banSao.querySelector(".cot-luong").textContent;
                    let thuongMoi = banSao.querySelector(".cot-thuong").textContent;
                    banSao.querySelector(".cot-tong").textContent = Number(luongMoi) + Number(thuongMoi);
                    sapXepBang(); 
                    luuVaoKetSat(); 
                });

                
                let nutXoa = banSao.querySelector(".nut-xoa");
                nutXoa.addEventListener("click", function() {
                    if (confirm("Chắc chắn muốn xóa giao dịch ID " + giaoDich.id + " không?")) {
                        banSao.remove();
                        luuVaoKetSat(); 
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
        
        luuVaoKetSat(); 
    }

    
    layTuKetSat();

    if (nutLuu) {
        const inputId = document.getElementById("nhap-id");
        const inputLuong = document.getElementById("nhap-luong");
        const inputThuong = document.getElementById("nhap-thuong");

        nutLuu.addEventListener("click", function() {
            let id = inputId.value;
            let luong = inputLuong.value;
            let thuong = inputThuong.value;
            
            if (id.trim() === "") { alert("Lỗi nhập dữ liệu, xin vui lòng thêm ID nhân sự!"); return; }
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
            sapXepBang(); 

            matKinh.style.display = "none";
            inputId.value = "";
            inputLuong.value = "";
            inputThuong.value = "";
        });
    }


    const nutNhapExcel = document.getElementById("nhap-excel");
    
    if (nutNhapExcel) {
        nutNhapExcel.addEventListener("change", function(e) {
            let file = e.target.files[0];
            if (!file) return;

            let reader = new FileReader();
            
            
            reader.readAsArrayBuffer(file);
            
            reader.onload = function(suKien) {
                let data = new Uint8Array(suKien.target.result);
                
                let workbook = XLSX.read(data, {type: 'array'});
                
               
                let tenSheetDauTien = workbook.SheetNames[0];
                let sheet = workbook.Sheets[tenSheetDauTien];
                
                
                let duLieuExcel = XLSX.utils.sheet_to_json(sheet, {header: 1});

                
                if (duLieuExcel.length > 1) {
                    let dongSoLieu = duLieuExcel[1]; 
                    
                    
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
