export interface TocHeading {
  id: string;
  text: string;
  level: 2 | 3;
}

export function extractHeadingsFromHtml(html: string): TocHeading[] {
  const result: TocHeading[] = [];
  const matches = Array.from(
    html.matchAll(/<h([23])[^>]*>([\s\S]*?)<\/h\1>/gi)
  );
  matches.forEach((m, idx) => {
    const level = m[1] === "3" ? 3 : 2;
    const text = (m[2] || "").replace(/<[^>]+>/g, "").trim();
    if (text) {
      result.push({
        id: `sec-${idx + 1}`,
        text,
        level,
      });
    }
  });
  return result;
}

/**
 * Pure server-safe utility: injects matching `id="sec-1"`, `id="sec-2"` attributes
 * into `<h2>`/`<h3>` tags in article HTML so clicking TOC links scrolls accurately.
 */
export function injectHeadingIds(html: string): string {
  let idx = 0;
  return html.replace(
    /<h([23])([^>]*)>([\s\S]*?)<\/h\1>/gi,
    (_full, level, attrs, inner) => {
      idx += 1;
      const cleanAttrs = String(attrs || "").replace(
        /\sid=["'][^"']*["']/gi,
        ""
      );
      return `<h${level} id="sec-${idx}"${cleanAttrs}>${inner}</h${level}>`;
    }
  );
}
