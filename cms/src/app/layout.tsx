import type { Metadata } from "next";
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
  title: "11Sport CMS — Hệ thống Quản trị",
  description:
    "Trang quản trị CMS 11Sport",
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
    <html lang="vi" className={`${inter.variable} `} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('11sport-theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}",
          }}
        />
      </head>
      <body className="min-h-screen antialiased font-sans font-medium text-base">
        {children}
        <VersionChecker />
      </body>
    </html>
  );
}
