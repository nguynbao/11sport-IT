import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "11Sport CMS — Hệ thống Quản trị Kho, Danh mục, Đơn hàng & Nhân sự",
  description:
    "Trang quản trị CMS 11Sport: Quản lý tồn kho kế toán đầu kỳ/cuối kỳ, cập nhật giá bán, quản lý Category, Đơn hàng & Nhân viên.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className="min-h-screen antialiased font-sans">{children}</body>
    </html>
  );
}
