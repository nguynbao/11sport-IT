import { useEffect } from "react";

const MOBILE_QUERY = "(max-width: 767px)";
const TABLE_SELECTOR = "table[data-cards]";
const OPEN_ROW_DETAIL_EVENT = "cms-open-row-detail";

function cellText(cell: HTMLTableCellElement): string {
  return (cell.textContent || "").replace(/\s+/g, " ").trim();
}

function textWithoutButtons(el: Element): string {
  const clone = el.cloneNode(true) as Element;
  clone.querySelectorAll("button").forEach((b) => b.remove());
  return (clone.textContent || "").replace(/\s+/g, " ").trim();
}

function extractVariantPills(cell: HTMLTableCellElement): string[] {
  return Array.from(cell.querySelectorAll('button[title^="Mã con:"]'))
    .map((b) => (b.textContent || "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function extractFullCellText(cell: HTMLTableCellElement): string {
  const lines: string[] = [];

  const pushLine = (txt: string) => {
    const clean = txt.replace(/\s+/g, " ").trim();
    if (!clean) return;
    if (lines[lines.length - 1] !== clean) {
      lines.push(clean);
    }
  };

  const walk = (el: Element) => {
    if (el.tagName === "BUTTON") return;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      if (el.value) pushLine(el.value);
      return;
    }
    if (el instanceof HTMLSelectElement) {
      const opt = el.options[el.selectedIndex];
      if (opt?.text) pushLine(opt.text);
      return;
    }
    // Giữ title ngắn (vd: địa chỉ đầy đủ bị truncate), bỏ qua tooltip hướng dẫn
    const title = el.getAttribute("title");
    if (
      title &&
      title.trim() &&
      title.length <= 120 &&
      !/(bấm|nhấn|chọn|sửa|xóa|in tem|cấu hình)/i.test(title) &&
      el.classList.contains("truncate")
    ) {
      pushLine(title);
      return;
    }

    const childEls = Array.from(el.children).filter((c) => c.tagName !== "BUTTON");
    if (childEls.length === 0) {
      pushLine(textWithoutButtons(el));
      return;
    }

    // Nếu là div/p block con trực tiếp, thu thập từng dòng riêng cho thoáng
    const hasBlockChildren = childEls.some((c) =>
      ["DIV", "P", "LI", "TR"].includes(c.tagName)
    );
    if (hasBlockChildren) {
      childEls.forEach(walk);
    } else {
      const inlineParts: string[] = [];
      childEls.forEach((c) => {
        if (c instanceof HTMLInputElement && c.value) inlineParts.push(c.value);
        else if (c instanceof HTMLSelectElement) {
          const opt = c.options[c.selectedIndex];
          if (opt?.text) inlineParts.push(opt.text);
        } else {
          const t = textWithoutButtons(c);
          if (t) inlineParts.push(t);
        }
      });
      if (inlineParts.length > 0) {
        pushLine(inlineParts.join(" · "));
      }
    }
  };

  if (cell.children.length === 0) {
    return textWithoutButtons(cell);
  }
  Array.from(cell.children).forEach(walk);
  return lines.join("\n").trim() || textWithoutButtons(cell);
}

/**
 * Dựng nhãn cho từng cột từ <thead> (hỗ trợ colSpan / rowSpan nhiều tầng).
 */
export function buildColumnLabels(table: HTMLTableElement): string[] {
  const labels: string[] = [];
  const groups: string[] = [];
  const occupied: boolean[][] = [];
  const rows = Array.from(table.tHead?.rows ?? []);

  rows.forEach((row, r) => {
    let col = 0;
    Array.from(row.cells).forEach((cell) => {
      while (occupied[r]?.[col]) col++;
      const colSpan = cell.colSpan || 1;
      const rowSpan = cell.rowSpan || 1;
      const text = cellText(cell);

      for (let dr = 0; dr < rowSpan; dr++) {
        occupied[r + dr] = occupied[r + dr] || [];
        for (let dc = 0; dc < colSpan; dc++) occupied[r + dr][col + dc] = true;
      }

      if (colSpan > 1) {
        for (let dc = 0; dc < colSpan; dc++) groups[col + dc] = text;
      } else {
        const group = groups[col];
        labels[col] = group && group !== text ? `${group} · ${text}` : text;
      }
      col += colSpan;
    });
  });

  groups.forEach((g, i) => {
    if (!labels[i] && g) labels[i] = g;
  });
  return labels;
}

/** Gắn `data-label` và nút "Xem đầy đủ" (mở popup chi tiết trên mobile) cho từng dòng card. */
export function applyTableLabels(table: HTMLTableElement): void {
  const labels = buildColumnLabels(table);
  if (labels.length === 0) return;

  const sections: HTMLTableSectionElement[] = [
    ...Array.from(table.tBodies),
    ...(table.tFoot ? [table.tFoot] : []),
  ];

  sections.forEach((section) => {
    const isBody = section.tagName === "TBODY";
    Array.from(section.rows).forEach((row) => {
      let col = 0;
      let hasColSpan = false;
      Array.from(row.cells).forEach((cell) => {
        if (cell.classList.contains("cms-mobile-detail-cell")) return;
        const colSpan = cell.colSpan || 1;
        if (colSpan > 1) hasColSpan = true;
        if (colSpan === 1) {
          const label = labels[col];
          if (label && cell.getAttribute("data-label") !== label) {
            cell.setAttribute("data-label", label);
          }
        }
        col += colSpan;
      });

      if (
        isBody &&
        !hasColSpan &&
        !table.hasAttribute("data-no-detail") &&
        row.cells.length >= 4 &&
        !row.querySelector(".cms-mobile-detail-cell")
      ) {
        const actionCell = document.createElement("td");
        actionCell.className = "cms-mobile-detail-cell";
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "cms-mobile-detail-btn";
        btn.textContent = "Xem đầy đủ nội dung";
        btn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          const fields: { label: string; text: string; isVariantList?: boolean }[] = [];
          Array.from(row.cells).forEach((c) => {
            if (c.classList.contains("cms-mobile-detail-cell")) return;
            const label = c.getAttribute("data-label") || "";
            if (!label || /thao tác/i.test(label)) return;
            const text = extractFullCellText(c);
            if (text) fields.push({ label, text });
            const variants = extractVariantPills(c);
            if (variants.length > 0) {
              fields.push({
                label: "Phân loại / Màu sắc",
                text: variants.join("\n"),
                isVariantList: true,
              });
            }
          });
          const firstLine = (fields[0]?.text || "").split("\n")[0]?.trim();
          const title = firstLine
            ? `${fields[0].label}: ${firstLine.slice(0, 48)}`
            : "Chi tiết";
          window.dispatchEvent(
            new CustomEvent(OPEN_ROW_DETAIL_EVENT, { detail: { title, fields } })
          );
        });
        actionCell.appendChild(btn);
        row.appendChild(actionCell);
      }
    });
  });
}

/**
 * Trên màn hình mobile (< 768px), tự gắn nhãn cột và nút xem chi tiết popup cho mọi `<table data-cards>`.
 */
export function useMobileTableLabels(): void {
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const mq = window.matchMedia(MOBILE_QUERY);
    let raf = 0;
    let observer: MutationObserver | null = null;

    const run = () => {
      raf = 0;
      document.querySelectorAll<HTMLTableElement>(TABLE_SELECTOR).forEach(applyTableLabels);
    };
    const schedule = () => {
      if (!raf) raf = window.requestAnimationFrame(run);
    };
    const start = () => {
      if (observer) return;
      observer = new MutationObserver(schedule);
      observer.observe(document.body, { childList: true, subtree: true });
      schedule();
    };
    const stop = () => {
      observer?.disconnect();
      observer = null;
      document.querySelectorAll(".cms-mobile-detail-cell").forEach((el) => el.remove());
    };
    const sync = () => (mq.matches ? start() : stop());

    sync();
    mq.addEventListener("change", sync);
    return () => {
      mq.removeEventListener("change", sync);
      stop();
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);
}
