import type { Brand, Category } from "@/shared/types";
import { buildSheet, downloadExcel, excelFileName, ExcelColumn } from "@/shared/lib/excel";

/* ------------------------------- Danh mục ------------------------------- */

export function exportCategories(categories: Category[]) {
  const cols: ExcelColumn<Category>[] = [
    { header: "STT", value: (_, i) => i + 1, format: "int", width: 6 },
    { header: "Mã Category", value: (c) => c.code },
    { header: "Mã Cate (SKU)", value: (c) => c.skuCode || "", width: 12 },
    { header: "Tên Category", value: (c) => c.name, width: 35 },
    { header: "Số sản phẩm", value: (c) => Number(c.productCount) || 0, format: "int", total: true },
    { header: "Trạng thái", value: (c) => (c.status === "ACTIVE" ? "Đang sử dụng" : "Ngừng sử dụng") },
  ];
  downloadExcel(excelFileName("DanhMuc"), [
    buildSheet("Category", cols, categories, { title: "DANH SÁCH CATEGORY" }),
  ]);
}

export function exportBrands(brands: Brand[], categoryMap?: Map<string, Category>) {
  const cols: ExcelColumn<Brand>[] = [
    { header: "STT", value: (_, i) => i + 1, format: "int", width: 6 },
    { header: "Mã Brand", value: (b) => b.code, width: 12 },
    { header: "Tên Thương hiệu", value: (b) => b.name, width: 28 },
    { header: "Tên gọi khác (Aliases)", value: (b) => (b.aliases || []).join(", "), width: 28 },
    {
      header: "Danh mục áp dụng",
      value: (b) =>
        b.isSystem
          ? "Mọi danh mục (Hệ thống)"
          : (b.categoryIds || [])
              .map((id) => categoryMap?.get(String(id))?.name || String(id))
              .join(", "),
      width: 40,
    },
    { header: "Số sản phẩm", value: (b) => Number(b.productCount) || 0, format: "int", total: true },
    { header: "Trạng thái", value: (b) => (b.status === "ACTIVE" ? "Đang sử dụng" : "Ngừng sử dụng") },
  ];
  downloadExcel(excelFileName("ThuongHieu"), [
    buildSheet("Brand", cols, brands, { title: "DANH SÁCH THƯƠNG HIỆU (BRAND)" }),
  ]);
}

