import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "11Sport POS & Kho Vận — Hệ thống Quản lý Bán hàng & Kiểm kho",
  description:
    "Hệ thống POS bán hàng tại quầy, xuất hóa đơn PDF K80/A4, kiểm hàng Camera OCR và quản lý kho 11Sport.",
  icons: {
    icon: [
      { url: "/logo-11sport-icon.svg", type: "image/svg+xml" },
      { url: "/logo-11sport.svg", type: "image/svg+xml" },
    ],
    shortcut: "/logo-11sport-icon.svg",
    apple: "/logo-11sport-icon.svg",
  },
};

// Viewport cho thiết bị di động (Next 14 tách khỏi metadata)
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className="min-h-screen antialiased font-sans overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
