import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "11Sport POS & Kho Vận — Hệ thống Quản lý Bán hàng & Kiểm kho",
  description:
    "Hệ thống POS bán hàng tại quầy, xuất hóa đơn PDF K80/A4, kiểm hàng Camera OCR và quản lý kho 11Sport.",
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
