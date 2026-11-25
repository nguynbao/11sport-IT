"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface SeoDescriptionBoxProps {
  html?: string;
  title?: string;
}

/**
 * Collapsible Borderless Term Description Box 1:1 with live mipik.vn (.term-description.is-collapsed + .product-section-toggle):
 * - Clean white background, zero outer card/border
 * - 340px collapsed max height with soft bottom gradient fade
 * - Centered solid #224E40 rectangular toggle button (`Xem thêm` / `Thu gọn`)
 */
export function SeoDescriptionBox({ html, title }: SeoDescriptionBoxProps) {
  const [expanded, setExpanded] = useState(false);

  if (!html) return null;

  return (
    <section
      aria-label={title || "Thông tin chi tiết"}
      className="bg-white pt-4 pb-6"
    >
      <div
        className={`relative overflow-hidden transition-all ${
          expanded ? "max-h-none" : "max-h-[340px]"
        }`}
      >
        <div
          className="prose prose-slate max-w-none text-sm sm:text-base text-ink-secondary leading-relaxed"
          dangerouslySetInnerHTML={{ __html: html }}
        />
        {!expanded && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-white via-white/85 to-transparent"
          />
        )}
      </div>

      <div className="mt-4 flex justify-center">
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="inline-flex items-center gap-1.5 h-[34px] px-4 rounded-none bg-store-forest hover:bg-[#1a7357] text-white text-sm font-medium transition-colors"
        >
          <span>{expanded ? "Thu gọn" : "Xem thêm"}</span>
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
          )}
        </button>
      </div>
    </section>
  );
}
