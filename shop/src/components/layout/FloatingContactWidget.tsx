"use client";

import { useEffect, useState } from "react";
import { Check, ChevronUp, Copy, X } from "lucide-react";
import type { SiteSettingsData } from "@/lib/storefront";

/**
 * Right Floating Contact Dock 1:1 with live mipik.vn:
 * 1. Pulsing red Hotline circle (#e60808)
 * 2. Pulsing blue Facebook Messenger circle (#1877f2)
 * 3. Pulsing blue Zalo circle (#0068ff) opening quick branch consultant modal
 * 4. Circular Back-to-top button appearing when scrolled > 320px
 */
export function FloatingContactWidget({
  settings,
}: {
  settings?: SiteSettingsData | null;
}) {
  const [showTop, setShowTop] = useState(false);
  const [zaloModalOpen, setZaloModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const hotline = settings?.hotline || "+84767.707.128";
  const hotlineDigits = hotline.replace(/\D/g, "") || "84767707128";
  const messengerUrl =
    settings?.messengerUrl || "https://m.me/11sport.pickleball";

  const branches =
    settings?.showrooms && settings.showrooms.length > 0
      ? settings.showrooms
      : [
          {
            name: "Chi nhánh Quận 10 (TP.HCM)",
            address: "95 Trần Thiện Chánh, Phường 12, Quận 10",
            phone: "0789 404 331",
          },
          {
            name: "Chi nhánh Phú Nhuận (TP.HCM)",
            address: "100 Hoa Lan, Phường 2, Quận Phú Nhuận",
            phone: "0789 404 231",
          },
          {
            name: "Chi nhánh Ngọc Hà (Hà Nội)",
            address: "466 Đường Bưởi, Ngọc Hà, Quận Ba Đình",
            phone: "0913 729 135",
          },
        ];

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 320);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleCopyConsult = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(
        "Xin chào 11Sport, tôi cần tư vấn chọn vợt Pickleball phù hợp!"
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      <div className="fixed right-3.5 bottom-6 z-30 flex flex-col items-center gap-4">
        {/* 1. Pulsing Red Hotline Phone */}
        <a
          href={`tel:${hotlineDigits}`}
          aria-label={`Gọi Hotline ${hotline}`}
          className="relative mipik-pulse-red w-11 h-11 rounded-full bg-[#e60808] text-white shadow-drawer flex items-center justify-center hover:scale-105 transition-transform"
        >
          <svg
            viewBox="0 0 24 24"
            className="w-5 h-5 fill-current relative z-10"
            aria-hidden="true"
          >
            <path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.61 21 3 13.39 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.46.57 3.58a1 1 0 0 1-.25 1.01l-2.2 2.2z" />
          </svg>
        </a>

        {/* 2. Pulsing Blue Messenger */}
        <a
          href={messengerUrl}
          target="_blank"
          rel="noreferrer"
          aria-label="Chat Facebook Messenger"
          className="relative mipik-pulse-blue w-10 h-10 rounded-full bg-[#1877f2] text-white shadow-drawer flex items-center justify-center hover:scale-105 transition-transform"
        >
          <svg
            viewBox="0 0 24 24"
            className="w-5 h-5 fill-current relative z-10"
            aria-hidden="true"
          >
            <path d="M12 2C6.48 2 2 6.14 2 11.24c0 2.9 1.45 5.49 3.72 7.18V22l3.4-1.87c.91.25 1.88.39 2.88.39 5.52 0 10-4.14 10-9.24S17.52 2 12 2zm1 12.44-2.55-2.72-4.97 2.72 5.47-5.8 2.61 2.72 4.91-2.72-5.47 5.8z" />
          </svg>
        </a>

        {/* 3. Pulsing Blue Zalo */}
        <button
          type="button"
          onClick={() => setZaloModalOpen(true)}
          aria-label="Chọn cửa hàng tư vấn Zalo"
          className="relative mipik-pulse-blue mipik-zalo-zoom w-10 h-10 rounded-full bg-[#0068ff] text-white shadow-drawer flex items-center justify-center hover:scale-105 transition-transform"
        >
          <span className="px-1.5 py-0.5 rounded bg-white text-[#0068ff] text-[10px] font-black leading-none tracking-tighter relative z-10">
            Zalo
          </span>
        </button>

        {/* 4. Back to Top */}
        {showTop && (
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            aria-label="Lên đầu trang"
            className="w-[38px] h-[38px] rounded-full border border-[#9ca3af] bg-white/95 text-[#4b5563] shadow-sm flex items-center justify-center hover:border-store-forest hover:text-store-forest transition-colors"
          >
            <ChevronUp className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Store/Overlay/ZaloConsultantModal */}
      {zaloModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Chọn cửa hàng tư vấn"
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setZaloModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white border border-store-border-sage shadow-drawer p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-store-border-sage pb-3">
              <div>
                <h2 className="text-lg font-extrabold text-store-forest">
                  Chọn cửa hàng tư vấn Zalo
                </h2>
                <p className="text-xs text-ink-muted mt-0.5">
                  Kỹ thuật viên trực tuyến 08:30 – 21:30 tại 3 chi nhánh 11Sport
                </p>
              </div>
              <button
                type="button"
                onClick={() => setZaloModalOpen(false)}
                aria-label="Đóng hộp thoại Zalo"
                className="w-9 h-9 rounded-full border border-store-border-sage flex items-center justify-center text-ink-secondary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              {branches.map((b, idx) => {
                const digits = (b.phone || hotline).replace(/\D/g, "");
                return (
                  <a
                    key={idx}
                    href={`https://zalo.me/${digits}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-store-surface-sage border border-store-border-sage hover:border-store-forest transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-ink-primary">
                        {b.name}
                      </p>
                      <p className="text-xs text-ink-secondary truncate">
                        {b.address}
                      </p>
                    </div>
                    <span className="px-3 py-1.5 rounded-full bg-store-social-blue text-white text-xs font-bold shrink-0">
                      Chat Zalo
                    </span>
                  </a>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleCopyConsult}
              className="w-full h-10 rounded-full border border-store-border-sage bg-white text-xs font-bold text-ink-secondary hover:border-store-forest hover:text-store-forest inline-flex items-center justify-center gap-1.5"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-store-forest" />
                  <span>Đã sao chép lời nhắn tư vấn!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Sao chép yêu cầu tư vấn nhanh</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
