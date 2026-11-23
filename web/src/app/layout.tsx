import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import VersionChecker from "@/components/VersionChecker";

const inter = Inter({
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "11Sport POS & Kho Vận — Hệ thống Quản lý Bán hàng & Kiểm kho",
  description:
    "Hệ thống POS bán hàng tại quầy, xuất hóa đơn PDF K80, kiểm hàng Camera OCR và quản lý kho 11Sport.",
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
  themeColor: "#212121",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className={`${inter.variable} `} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('11sport-theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}",
          }}
        />
      </head>
      <body className="min-h-screen antialiased font-sans font-medium text-base overflow-x-hidden">
        {children}
        <VersionChecker />
      </body>
    </html>
  );
}
