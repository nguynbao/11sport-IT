import { ApiError } from './errors';
import { generateProductCode } from './productCode';

export type OcrMode = 'TABLE' | 'TAG';

export interface OcrTableRow {
  productName: string;
  unit: string;
  expectedQuantity: number;
  note: string;
}

export interface OcrTableResult {
  rows: OcrTableRow[];
  rawText: string;
  engine: 'gemini' | 'tesseract';
}

export interface OcrTagResult {
  productCode: string;
  productName: string;
  quantity: number | null;
  rawText: string;
  engine: 'gemini' | 'tesseract';
}

const MAX_BASE64_LENGTH = 8 * 1024 * 1024; // ~8MB chuỗi base64
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export function validateOcrInput(fileBase64: unknown, mimeType: unknown): { data: string; mime: string } {
  if (typeof fileBase64 !== 'string' || !fileBase64.trim()) {
    throw new ApiError(400, 'OCR_INVALID_FILE', 'Thiếu dữ liệu ảnh/file cần quét.');
  }
  // Cho phép client gửi kèm tiền tố data:...;base64,
  let data = fileBase64.trim();
  let mime = typeof mimeType === 'string' ? mimeType.toLowerCase() : '';
  const prefix = data.match(/^data:([^;]+);base64,/);
  if (prefix) {
    mime = mime || prefix[1].toLowerCase();
    data = data.slice(prefix[0].length);
  }
  if (!ALLOWED_MIME.includes(mime)) {
    throw new ApiError(400, 'OCR_INVALID_FILE', 'Định dạng không hỗ trợ. Chỉ nhận ảnh JPG/PNG/WEBP hoặc PDF.');
  }
  if (data.length > MAX_BASE64_LENGTH) {
    throw new ApiError(413, 'OCR_FILE_TOO_LARGE', 'File quá lớn (tối đa ~6MB). Vui lòng chụp lại hoặc giảm dung lượng.');
  }
  return { data, mime };
}

/* ------------------------------ Gemini Vision ------------------------------ */

const TABLE_PROMPT = `Bạn là hệ thống OCR cho phiếu giao hàng / phiếu nhập kho của cửa hàng đồ thể thao.
Hãy đọc bảng hàng hóa trong ảnh và trả về JSON đúng schema.
Quy tắc:
- Mỗi dòng hàng = 1 phần tử trong "rows". Bỏ qua dòng tiêu đề, dòng tổng cộng, chữ ký.
- "productName": giữ NGUYÊN VĂN tên hàng tiếng Việt có dấu, bao gồm cả phần trong ngoặc đơn (...) nếu có.
- "unit": đơn vị tính (Cái, Đôi, Quả, Hộp...). Nếu không thấy thì để "Cái".
- "expectedQuantity": số nguyên số lượng. Nếu không đọc được thì để 1.
- "note": ghi chú của dòng nếu có, không có thì "".
- "rawText": toàn bộ văn bản đọc được.
Không bịa thêm dòng không có trong ảnh.`;

const TAG_PROMPT = `Bạn là hệ thống OCR đọc nhãn/tag sản phẩm thể thao (áo, quần, giày, phụ kiện).
Đọc ảnh và trả về JSON:
- "productName": tên sản phẩm in trên tag (giữ nguyên tiếng Việt có dấu), kèm mã mẫu/màu/size nếu có.
- "productCode": mã hàng/SKU/mã mẫu in trên tag nếu có, không có thì "".
- "quantity": số lượng nếu tag có ghi, không thì null.
- "rawText": toàn bộ văn bản đọc được.`;

const TABLE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    rows: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          productName: { type: 'STRING' },
          unit: { type: 'STRING' },
          expectedQuantity: { type: 'INTEGER' },
          note: { type: 'STRING' },
        },
        required: ['productName', 'unit', 'expectedQuantity', 'note'],
      },
    },
    rawText: { type: 'STRING' },
  },
  required: ['rows', 'rawText'],
};

const TAG_SCHEMA = {
  type: 'OBJECT',
  properties: {
    productName: { type: 'STRING' },
    productCode: { type: 'STRING' },
    quantity: { type: 'INTEGER', nullable: true },
    rawText: { type: 'STRING' },
  },
  required: ['productName', 'productCode', 'rawText'],
};

async function callGemini(mode: OcrMode, data: string, mime: string): Promise<any> {
  const apiKey = process.env.GEMINI_API_KEY as string;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: mode === 'TABLE' ? TABLE_PROMPT : TAG_PROMPT },
              { inline_data: { mime_type: mime, data } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
          responseSchema: mode === 'TABLE' ? TABLE_SCHEMA : TAG_SCHEMA,
        },
      }),
    });

    const json: any = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const msg = json?.error?.message || `HTTP ${resp.status}`;
      throw new ApiError(502, 'OCR_ENGINE_ERROR', `Dịch vụ OCR (Gemini) lỗi: ${msg}`);
    }
    const text: string =
      json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';
    try {
      return JSON.parse(text);
    } catch {
      throw new ApiError(502, 'OCR_ENGINE_ERROR', 'Không phân tích được kết quả OCR. Vui lòng chụp lại rõ hơn.');
    }
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    if (err?.name === 'AbortError') {
      throw new ApiError(502, 'OCR_ENGINE_ERROR', 'Quét OCR quá thời gian chờ. Vui lòng thử lại.');
    }
    throw new ApiError(502, 'OCR_ENGINE_ERROR', `Không gọi được dịch vụ OCR: ${err?.message || err}`);
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------ Tesseract fallback ------------------------------ */

async function runTesseract(data: string): Promise<string> {
  // Lazy-load để không tốn RAM khi đã có Gemini
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Tesseract = require('tesseract.js');
  const buffer = Buffer.from(data, 'base64');
  try {
    const result = await Tesseract.recognize(buffer, 'vie+eng');
    return String(result?.data?.text || '');
  } catch (err: any) {
    throw new ApiError(502, 'OCR_ENGINE_ERROR', `Tesseract OCR lỗi: ${err?.message || err}`);
  }
}

/** Tách văn bản OCR thô thành các dòng hàng (dùng chung cho Tesseract và ocr-preview). */
export function parseTextToRows(rawText: string): OcrTableRow[] {
  const lines = String(rawText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 3);

  const headerRe = /^(stt|m[aã] h[aà]ng|t[eê]n h[aà]ng|đvt|dvt|s[oố] l[uư][oợ]ng|ghi ch[uú]|t[oổ]ng)/i;

  const rows: OcrTableRow[] = [];
  for (const line of lines) {
    if (headerRe.test(line)) continue;
    const parts = line.split(/\s*[|\t;]\s*/).filter(Boolean);
    if (parts.length >= 2) {
      const startIdx = /^\d+$/.test(parts[0]) ? 1 : 0;
      const name = parts[startIdx] || '';
      if (!name) continue;
      const qty = parseInt(parts[startIdx + 2] || '', 10);
      rows.push({
        productName: name,
        unit: parts[startIdx + 1] || 'Cái',
        expectedQuantity: Number.isFinite(qty) && qty > 0 ? qty : 1,
        note: parts[startIdx + 3] || '',
      });
      continue;
    }
    // Dòng không có dấu phân cách: "1 Áo Polo ... Cái 20"
    const m = line.match(/^(?:\d+[.)]?\s+)?(.+?)\s+(Cái|Đôi|Quả|Hộp|Bộ|Chiếc|Cuộn|Túi|Thùng)\s+(\d+)\s*(.*)$/i);
    if (m) {
      rows.push({
        productName: m[1].trim(),
        unit: m[2],
        expectedQuantity: parseInt(m[3], 10) || 1,
        note: (m[4] || '').trim(),
      });
    } else {
      rows.push({ productName: line.replace(/^\d+[.)]?\s+/, ''), unit: 'Cái', expectedQuantity: 1, note: '' });
    }
  }
  return rows;
}

/* ------------------------------ Public API ------------------------------ */

export async function ocrScanTable(data: string, mime: string): Promise<OcrTableResult> {
  if (process.env.GEMINI_API_KEY) {
    const out = await callGemini('TABLE', data, mime);
    const rows: OcrTableRow[] = (Array.isArray(out?.rows) ? out.rows : [])
      .map((r: any) => ({
        productName: String(r?.productName || '').trim(),
        unit: String(r?.unit || 'Cái').trim() || 'Cái',
        expectedQuantity: Math.max(1, Math.round(Number(r?.expectedQuantity) || 1)),
        note: String(r?.note || '').trim(),
      }))
      .filter((r: OcrTableRow) => r.productName);
    return { rows, rawText: String(out?.rawText || ''), engine: 'gemini' };
  }

  if (mime === 'application/pdf') {
    throw new ApiError(
      422,
      'OCR_UNSUPPORTED',
      'Quét PDF cần cấu hình GEMINI_API_KEY trên server. Vui lòng tải ảnh (JPG/PNG) thay thế.'
    );
  }
  const rawText = await runTesseract(data);
  return { rows: parseTextToRows(rawText), rawText, engine: 'tesseract' };
}

export async function ocrScanTag(data: string, mime: string): Promise<OcrTagResult> {
  if (process.env.GEMINI_API_KEY) {
    const out = await callGemini('TAG', data, mime);
    const productName = String(out?.productName || '').trim();
    const rawCode = String(out?.productCode || '').trim();
    const q = Number(out?.quantity);
    return {
      productName,
      productCode: rawCode ? generateProductCode(rawCode) : generateProductCode(productName),
      quantity: Number.isFinite(q) && q > 0 ? Math.round(q) : null,
      rawText: String(out?.rawText || ''),
      engine: 'gemini',
    };
  }

  if (mime === 'application/pdf') {
    throw new ApiError(422, 'OCR_UNSUPPORTED', 'Quét PDF cần cấu hình GEMINI_API_KEY trên server.');
  }
  const rawText = await runTesseract(data);
  const firstLine =
    rawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.length >= 3) || '';
  return {
    productName: firstLine,
    productCode: generateProductCode(firstLine),
    quantity: null,
    rawText,
    engine: 'tesseract',
  };
}
