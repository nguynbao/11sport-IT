import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "11Sport CMS — Hệ thống Quản trị Kho, Danh mục, Đơn hàng & Nhân sự",
  description:
    "Trang quản trị CMS 11Sport: Quản lý tồn kho kế toán đầu kỳ/cuối kỳ, cập nhật giá bán, quản lý Category, Đơn hàng & Nhân viên.",
  icons: {
    icon: [
      { url: "/logo-11sport-icon.svg", type: "image/svg+xml" },
      { url: "/logo-11sport.svg", type: "image/svg+xml" },
    ],
    shortcut: "/logo-11sport-icon.svg",
    apple: "/logo-11sport-icon.svg",
  },
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
