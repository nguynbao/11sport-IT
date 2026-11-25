import type { Metadata } from "next";
import { headers } from "next/headers";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { MiniCartDrawer } from "@/components/layout/MiniCartDrawer";
import { FloatingContactWidget } from "@/components/layout/FloatingContactWidget";
import { JsonLd } from "@/components/seo/JsonLd";
import { fetchMenu, fetchSiteSettings } from "@/lib/storefront";
import {
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
  DEFAULT_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
} from "@/lib/seo";

const inter = Inter({
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Hệ Thống Vợt & Phụ Kiện Pickleball Chính Hãng`,
    template: `%s | ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  alternates: {
    canonical: SITE_URL,
    languages: {
      vi: SITE_URL,
      en: `${SITE_URL}/en`,
      "x-default": SITE_URL,
    },
  },
  openGraph: {
    title: `${SITE_NAME} — Hệ Thống Vợt & Phụ Kiện Pickleball Chính Hãng`,
    description: DEFAULT_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "vi_VN",
    type: "website",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const reqHeaders = headers();
  const locale = reqHeaders.get("x-locale") === "en" ? "en" : "vi";
  const [settings, menuItems] = await Promise.all([
    fetchSiteSettings(),
    fetchMenu(),
  ]);

  return (
    <html
      lang={locale}
      className={`${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen flex flex-col bg-surface-page text-ink-primary font-sans antialiased">
        <JsonLd data={[buildOrganizationJsonLd(), buildWebSiteJsonLd()]} />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-store-forest focus:text-white focus:font-semibold"
        >
          {locale === "en"
            ? "Skip to main content"
            : "Chuyển đến nội dung chính"}
        </a>

        <Header settings={settings} menuItems={menuItems} />
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <Footer settings={settings} />

        <MiniCartDrawer />
        <FloatingContactWidget settings={settings} />
      </body>
    </html>
  );
}
