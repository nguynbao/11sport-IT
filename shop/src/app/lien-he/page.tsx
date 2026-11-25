import type { Metadata } from "next";
import {
  buildBreadcrumbJsonLd,
  buildLocalBusinessJsonLd,
  buildMetadata,
} from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";
import { QuickConsultForm } from "@/components/blog/QuickConsultForm";
import { ContactBranchesClient } from "@/components/contact/ContactBranchesClient";
import { fetchSiteSettings } from "@/lib/storefront";

export const metadata: Metadata = buildMetadata({
  title: "Hệ Thống 3 Chi Nhánh Showroom & Liên Hệ",
  description:
    "Địa chỉ hệ thống 3 showroom Quận 10, Phú Nhuận (TP.HCM) và Ngọc Hà (Hà Nội). Trải nghiệm cầm thử vợt Joola, Selkirk, Kamito chính hãng.",
  path: "/lien-he",
});

export default async function ContactPage() {
  const settings = await fetchSiteSettings();
  const siteName = settings?.siteName || "11Sport";
  const defaultHotline = settings?.hotline || "0909 888 128";
  const showrooms = settings?.showrooms ?? [];

  const breadcrumbs = [
    { name: "Trang chủ", path: "/" },
    { name: "Liên hệ", path: "/lien-he" },
  ];

  const localBusinessJsonLds = showrooms.map((branch) => ({
    ...buildLocalBusinessJsonLd({
      name: branch.name || siteName,
      streetAddress: branch.address || "",
      addressLocality: "",
      addressRegion: "Việt Nam",
      telephone: branch.phone || defaultHotline,
    }),
  }));

  return (
    <div className="max-w-container mx-auto px-3.5 sm:px-4 lg:px-5 py-8 lg:py-10 space-y-10">
      <JsonLd data={[buildBreadcrumbJsonLd(breadcrumbs), ...localBusinessJsonLds]} />

      <ContactBranchesClient
        siteName={siteName}
        showrooms={showrooms}
      />

      <QuickConsultForm
        variant="horizontal"
        title="ĐĂNG KÝ TƯ VẤN"
        sourceUrl="/lien-he"
      />
    </div>
  );
}
