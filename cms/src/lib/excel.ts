/**
 * Xuất file Excel (.xlsx) thuần trình duyệt, không cần thư viện ngoài.
 * - Tạo SpreadsheetML (Office Open XML) + đóng gói ZIP (STORE, kèm CRC32).
 * - Hỗ trợ nhiều sheet, tiêu đề, dòng header (in đậm, cố định, có bộ lọc), định dạng tiền/số/ngày, dòng tổng.
 */

export type CellValue = string | number | Date | boolean | null | undefined;
export type ColumnFormat = "text" | "int" | "money" | "datetime" | "date";

export interface ExcelColumn<T> {
  header: string;
  value: (row: T, index: number) => CellValue;
  format?: ColumnFormat;
  width?: number;
  /** Cộng tổng cột này ở dòng "TỔNG CỘNG" */
  total?: boolean;
}

export interface ExcelSheet {
  name: string;
  title?: string;
  subtitle?: string;
  headers: string[];
  formats: ColumnFormat[];
  widths: number[];
  rows: CellValue[][];
  totalRow?: CellValue[];
}

export function buildSheet<T>(
  name: string,
  columns: ExcelColumn<T>[],
  data: T[],
  opts: { title?: string; subtitle?: string } = {}
): ExcelSheet {
  const rows = data.map((row, i) => columns.map((c) => c.value(row, i)));
  const hasTotal = columns.some((c) => c.total);
  const totalRow = hasTotal
    ? columns.map((c, ci) => {
        if (ci === 0) return "TỔNG CỘNG";
        if (!c.total) return null;
        return rows.reduce((s, r) => s + (typeof r[ci] === "number" ? (r[ci] as number) : 0), 0);
      })
    : undefined;

  const widths = columns.map((c, ci) => {
    if (c.width) return c.width;
    const longest = Math.max(
      c.header.length,
      ...rows.slice(0, 300).map((r) => {
        const v = r[ci];
        if (v instanceof Date) return 17;
        if (typeof v === "number") return String(Math.round(v)).length + 4;
        return String(v ?? "").length;
      })
    );
    return Math.min(60, Math.max(8, longest + 2));
  });

  return {
    name,
    title: opts.title,
    subtitle: opts.subtitle ?? `Xuất lúc ${new Date().toLocaleString("vi-VN")} — 11Sport CMS`,
    headers: columns.map((c) => c.header),
    formats: columns.map((c) => c.format || "text"),
    widths,
    rows,
    totalRow,
  };
}

/* ------------------------------- XML helpers ------------------------------ */

const escapeXml = (s: string) =>
  s
    // loại ký tự điều khiển không hợp lệ trong XML
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const colLetter = (n: number) => {
  let s = "";
  n += 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

const toExcelDate = (d: Date) => (d.getTime() - d.getTimezoneOffset() * 60000) / 86400000 + 25569;

// Chỉ số style trong styles.xml (cellXfs)
const S = { normal: 0, header: 1, money: 2, int: 3, datetime: 4, title: 5, subtitle: 6, totalText: 7, totalMoney: 8, totalInt: 9, date: 10 };

function styleFor(format: ColumnFormat, isTotal: boolean): number {
  if (isTotal) return format === "money" ? S.totalMoney : format === "int" ? S.totalInt : S.totalText;
  switch (format) {
    case "money":
      return S.money;
    case "int":
      return S.int;
    case "datetime":
      return S.datetime;
    case "date":
      return S.date;
    default:
      return S.normal;
  }
}

function cellXml(ref: string, value: CellValue, style: number): string {
  if (value === null || value === undefined || value === "") {
    return style ? `<c r="${ref}" s="${style}"/>` : "";
  }
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return "";
    return `<c r="${ref}" s="${style}"><v>${toExcelDate(value)}</v></c>`;
  }
  if (typeof value === "number") {
    if (!isFinite(value)) return "";
    return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
  }
  if (typeof value === "boolean") {
    return `<c r="${ref}" s="${style}" t="inlineStr"><is><t>${value ? "Có" : "Không"}</t></is></c>`;
  }
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(
    String(value)
  )}</t></is></c>`;
}

function sheetXml(sheet: ExcelSheet): string {
  const out: string[] = [];
  const lastCol = colLetter(Math.max(0, sheet.headers.length - 1));
  let r = 1;
  const merges: string[] = [];

  if (sheet.title) {
    out.push(`<row r="${r}" ht="22" customHeight="1">${cellXml(`A${r}`, sheet.title, S.title)}</row>`);
    merges.push(`A${r}:${lastCol}${r}`);
    r++;
  }
  if (sheet.subtitle) {
    out.push(`<row r="${r}">${cellXml(`A${r}`, sheet.subtitle, S.subtitle)}</row>`);
    merges.push(`A${r}:${lastCol}${r}`);
    r++;
  }
  if (sheet.title || sheet.subtitle) r++; // dòng trống

  const headerRow = r;
  out.push(
    `<row r="${r}" ht="20" customHeight="1">${sheet.headers
      .map((h, ci) => cellXml(`${colLetter(ci)}${r}`, h, S.header))
      .join("")}</row>`
  );
  r++;

  for (const row of sheet.rows) {
    out.push(
      `<row r="${r}">${row
        .map((v, ci) => cellXml(`${colLetter(ci)}${r}`, v, styleFor(sheet.formats[ci], false)))
        .join("")}</row>`
    );
    r++;
  }
  const lastDataRow = r - 1;

  if (sheet.totalRow) {
    out.push(
      `<row r="${r}">${sheet.totalRow
        .map((v, ci) => cellXml(`${colLetter(ci)}${r}`, v ?? "", styleFor(sheet.formats[ci], true)))
        .join("")}</row>`
    );
  }

  const cols = sheet.widths
    .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
    .join("");

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${headerRow}" topLeftCell="A${
      headerRow + 1
    }" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    `<sheetFormatPr defaultRowHeight="15"/>` +
    (cols ? `<cols>${cols}</cols>` : "") +
    `<sheetData>${out.join("")}</sheetData>` +
    (sheet.rows.length > 0
      ? `<autoFilter ref="A${headerRow}:${lastCol}${lastDataRow}"/>`
      : "") +
    (merges.length
      ? `<mergeCells count="${merges.length}">${merges.map((m) => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>`
      : "") +
    `<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>` +
    `</worksheet>`
  );
}

const STYLES_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<numFmts count="3">` +
  `<numFmt numFmtId="164" formatCode="#,##0&quot; ₫&quot;"/>` +
  `<numFmt numFmtId="165" formatCode="dd/mm/yyyy hh:mm"/>` +
  `<numFmt numFmtId="166" formatCode="dd/mm/yyyy"/>` +
  `</numFmts>` +
  `<fonts count="5">` +
  `<font><sz val="11"/><name val="Calibri"/></font>` +
  `<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>` +
  `<font><b/><sz val="14"/><color rgb="FF0F172A"/><name val="Calibri"/></font>` +
  `<font><i/><sz val="10"/><color rgb="FF64748B"/><name val="Calibri"/></font>` +
  `<font><b/><sz val="11"/><name val="Calibri"/></font>` +
  `</fonts>` +
  `<fills count="4">` +
  `<fill><patternFill patternType="none"/></fill>` +
  `<fill><patternFill patternType="gray125"/></fill>` +
  `<fill><patternFill patternType="solid"><fgColor rgb="FF0F172A"/><bgColor indexed="64"/></patternFill></fill>` +
  `<fill><patternFill patternType="solid"><fgColor rgb="FFD1FAE5"/><bgColor indexed="64"/></patternFill></fill>` +
  `</fills>` +
  `<borders count="2">` +
  `<border><left/><right/><top/><bottom/><diagonal/></border>` +
  `<border><left style="thin"><color rgb="FFCBD5E1"/></left><right style="thin"><color rgb="FFCBD5E1"/></right><top style="thin"><color rgb="FFCBD5E1"/></top><bottom style="thin"><color rgb="FFCBD5E1"/></bottom><diagonal/></border>` +
  `</borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="11">` +
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>` + // 0 normal
  `<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>` + // 1 header
  `<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>` + // 2 money
  `<xf numFmtId="3" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>` + // 3 int
  `<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left"/></xf>` + // 4 datetime
  `<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>` + // 5 title
  `<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>` + // 6 subtitle
  `<xf numFmtId="0" fontId="4" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>` + // 7 total text
  `<xf numFmtId="164" fontId="4" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>` + // 8 total money
  `<xf numFmtId="3" fontId="4" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>` + // 9 total int
  `<xf numFmtId="166" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left"/></xf>` + // 10 date
  `</cellXfs>` +
  `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
  `</styleSheet>`;

const safeSheetName = (name: string, used: Set<string>) => {
  let base = name.replace(/[\[\]:*?/\\]/g, " ").trim().slice(0, 31) || "Sheet";
  let n = base;
  let i = 2;
  while (used.has(n.toLowerCase())) {
    const suffix = ` (${i++})`;
    n = base.slice(0, 31 - suffix.length) + suffix;
  }
  used.add(n.toLowerCase());
  return n;
};

/* --------------------------------- ZIP --------------------------------- */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zipStore(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder();
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const crc = crc32(f.data);
    const size = f.data.length;

    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // UTF-8
    lv.setUint16(8, 0, true); // STORE
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nameBytes, 30);
    locals.push(local, f.data);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centrals.push(central);

    offset += local.length + size;
  }

  const centralSize = centrals.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const all = [...locals, ...centrals, end];
  const total = all.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let p = 0;
  for (const a of all) {
    out.set(a, p);
    p += a.length;
  }
  return out;
}

/* ------------------------------- Public API ------------------------------- */

export function createXlsx(sheets: ExcelSheet[]): Uint8Array {
  const enc = new TextEncoder();
  const used = new Set<string>();
  const names = sheets.map((s) => safeSheetName(s.name, used));

  const files: { name: string; data: Uint8Array }[] = [
    {
      name: "[Content_Types].xml",
      data: enc.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
          `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
          `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
          `<Default Extension="xml" ContentType="application/xml"/>` +
          `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
          `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
          sheets
            .map(
              (_, i) =>
                `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
            )
            .join("") +
          `</Types>`
      ),
    },
    {
      name: "_rels/.rels",
      data: enc.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
          `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
          `</Relationships>`
      ),
    },
    {
      name: "xl/workbook.xml",
      data: enc.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
          `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
          `<sheets>${names
            .map((n, i) => `<sheet name="${escapeXml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
            .join("")}</sheets>` +
          `<definedNames>${sheets
            .map((s, i) => {
              if (s.rows.length === 0) return "";
              const headerRow = (s.title ? 1 : 0) + (s.subtitle ? 1 : 0) + (s.title || s.subtitle ? 1 : 0) + 1;
              const lastCol = colLetter(Math.max(0, s.headers.length - 1));
              return `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${names[i].replace(
                /'/g,
                "''"
              )}'!$A$${headerRow}:$${lastCol}$${headerRow + s.rows.length}</definedName>`;
            })
            .join("")}</definedNames>` +
          `</workbook>`
      ),
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: enc.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
          `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          sheets
            .map(
              (_, i) =>
                `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${
                  i + 1
                }.xml"/>`
            )
            .join("") +
          `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
          `</Relationships>`
      ),
    },
    { name: "xl/styles.xml", data: enc.encode(STYLES_XML) },
    ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: enc.encode(sheetXml(s)) })),
  ];

  return zipStore(files);
}

/** Tạo tên file dạng `<prefix>_YYYYMMDD_HHmm.xlsx` */
export function excelFileName(prefix: string): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${prefix}_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(
    d.getMinutes()
  )}.xlsx`;
}

export function downloadExcel(fileName: string, sheets: ExcelSheet[]): void {
  const bytes = createXlsx(sheets);
  const blob = new Blob([bytes.buffer as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Chuyển chuỗi ngày ISO sang Date (an toàn) cho ô Excel */
export const toDate = (s?: string | Date | null): Date | null => {
  if (!s) return null;
  const d = s instanceof Date ? s : new Date(s);
  return isNaN(d.getTime()) ? null : d;
};
