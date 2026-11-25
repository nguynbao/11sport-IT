export function downloadAdminSampleCsv() {
    const sampleRows = [
      ["Mã SP", "Tên sản phẩm", "Hãng", "Màu sắc", "Size", "ĐVT", "Số lượng", "Giá vốn", "Giá niêm yết", "Ghi chú"],
      ["GASIA221401", "Giày Asia 221401", "Asia", "Trắng Xanh", "41", "Đôi", "10", "180000", "290000", "Lô mới"],
      ["GASIA221401", "Giày Asia 221401", "Asia", "Trắng Xanh", "42", "Đôi", "8", "180000", "290000", "Lô mới"],
      ["AKAMITO150824", "Áo đấu Kamito Pro", "Kamito", "Đỏ", "L", "Cái", "12", "150000", "290000", ""],
      ["GNN309412", "Giày Bata Thượng Đình", "NN", "Trắng", "40", "Đôi", "15", "95000", "160000", "Không hãng (NN)"],
    ];
    const csvContent =
      "\uFEFF" +
      sampleRows
        .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Mau_Nhap_Kho_11Sport.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
