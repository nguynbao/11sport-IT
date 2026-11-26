import { useEffect } from "react";

const MOBILE_QUERY = "(max-width: 767px)";
const TABLE_SELECTOR = "table[data-cards]";

function cellText(cell: HTMLTableCellElement): string {
  return (cell.textContent || "").replace(/\s+/g, " ").trim();
}

/**
 * Dựng nhãn cho từng cột từ <thead> (hỗ trợ colSpan / rowSpan nhiều tầng).
 * Cột con của nhóm sẽ có dạng "Nhóm · Cột".
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

/** Gắn `data-label` cho các <td> trong <tbody>/<tfoot> để CSS hiển thị dạng card trên mobile. */
export function applyTableLabels(table: HTMLTableElement): void {
  const labels = buildColumnLabels(table);
  if (labels.length === 0) return;

  const sections: HTMLTableSectionElement[] = [
    ...Array.from(table.tBodies),
    ...(table.tFoot ? [table.tFoot] : []),
  ];

  sections.forEach((section) => {
    Array.from(section.rows).forEach((row) => {
      let col = 0;
      Array.from(row.cells).forEach((cell) => {
        const colSpan = cell.colSpan || 1;
        if (colSpan === 1) {
          const label = labels[col];
          if (label && cell.getAttribute("data-label") !== label) {
            cell.setAttribute("data-label", label);
          }
        }
        col += colSpan;
      });
    });
  });
}

/**
 * Trên màn hình mobile (< 768px), tự gắn nhãn cột cho mọi `<table data-cards>`
 * (kể cả bảng render động / bảng lồng trong dòng chi tiết). Desktop không tốn tài nguyên.
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
