"use client";

import { useMemo, useState } from "react";
import { ChevronDown, List } from "lucide-react";
import {
  extractHeadingsFromHtml,
  type TocHeading,
} from "@/lib/articleHtml";

export type { TocHeading };

interface ArticleTocProps {
  headings?: TocHeading[];
  contentHtml?: string;
}

export function ArticleToc({ headings, contentHtml }: ArticleTocProps) {
  const [open, setOpen] = useState(true);

  const numberedItems = useMemo(() => {
    const raw =
      headings && headings.length > 0
        ? headings
        : contentHtml
        ? extractHeadingsFromHtml(contentHtml)
        : [];
    let h2Index = 0;
    let h3Index = 0;
    return raw.map((item) => {
      if (item.level <= 2) {
        h2Index += 1;
        h3Index = 0;
        return { ...item, num: `${h2Index}` };
      }
      if (h2Index === 0) h2Index = 1;
      h3Index += 1;
      return { ...item, num: `${h2Index}.${h3Index}` };
    });
  }, [headings, contentHtml]);

  if (!numberedItems.length) return null;

  return (
    <nav
      aria-label="Mục lục bài viết"
      className="border border-[#333333] rounded-none overflow-hidden bg-[#e8f5e9]"
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-white border-b border-[#333333]/25 text-left font-bold text-[15px] text-[#0a0a0a]"
      >
        <span className="inline-flex items-center gap-2">
          <List className="w-4 h-4 text-[#0a0a0a]" aria-hidden="true" />
          <span>Mục lục bài viết</span>
        </span>
        <ChevronDown
          className={`w-4 h-4 text-[#333333] transition-transform ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <ul className="px-4 py-3 space-y-1.5 bg-[#e8f5e9]">
          {numberedItems.map((h) => (
            <li key={h.id} className={h.level >= 3 ? "pl-5" : ""}>
              <a
                href={`#${h.id}`}
                className="inline-flex items-baseline gap-2 text-[13.5px] text-[#204b3e] hover:text-[#14352b] leading-snug"
              >
                <span className="font-semibold tabular-nums shrink-0 no-underline">
                  {h.num}
                </span>
                <span className="underline underline-offset-2 font-medium">
                  {h.text}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}
