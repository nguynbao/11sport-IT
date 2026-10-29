import { ApiError } from './errors';
import { generateProductCode, normalizeToUpperCode } from './productCode';

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
  barcode: string;
  codes: string[];
  quantity: number | null;
  rawText: string;
  engine: 'gemini' | 'tesseract';
  model?: string;
  durationMs?: number;
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

const TAG_PROMPT = `Đọc nhãn/tag quần áo thể thao trong ảnh và trả JSON:
- "productName": dòng tên sản phẩm + màu + size trên tag (VD: "MOVE-Áo Polo phối viền cổ-Hồng-S"), giữ nguyên tiếng Việt có dấu.
- "productCode": mã SKU chữ+số dưới giá tiền (VD: "PKP018SKWW26WH-L"), không có thì "".
- "barcode": dãy số dưới mã vạch (VD: "8935364317145"), không có thì "".
- "quantity": số lượng nếu tag có ghi, không thì null.`;

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
    barcode: { type: 'STRING' },
    quantity: { type: 'INTEGER', nullable: true },
  },
  required: ['productName', 'productCode', 'barcode'],
};

// TAG ưu tiên model phản hồi nhanh nhất (flash-lite ~1.2–2.2s) để tổng thời gian <= 5s
const DEFAULT_TAG_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-2.5-flash'];
// TABLE ưu tiên độ chính xác đọc bảng nhiều dòng
const DEFAULT_TABLE_MODELS = ['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'];

const getTableTimeoutMs = () => Number(process.env.GEMINI_TIMEOUT_MS) || 20000;
const getTagTimeoutMs = () => Number(process.env.GEMINI_TAG_TIMEOUT_MS) || 4800;
const getTagHedgeDelayMs = () => Number(process.env.GEMINI_TAG_HEDGE_MS) || 2200;

/** Danh sách model theo chế độ quét. */
export function getGeminiModels(mode: OcrMode = 'TABLE'): string[] {
  const modeEnv = mode === 'TAG' ? process.env.GEMINI_TAG_MODELS : process.env.GEMINI_TABLE_MODELS;
  const defaults = mode === 'TAG' ? DEFAULT_TAG_MODELS : DEFAULT_TABLE_MODELS;
  const list =
    mode === 'TAG'
      ? [
          ...(modeEnv ? modeEnv.split(',') : []),
          ...defaults,
          process.env.GEMINI_MODEL,
          ...(process.env.GEMINI_FALLBACK_MODELS || '').split(','),
        ]
      : [
          ...(modeEnv ? modeEnv.split(',') : []),
          process.env.GEMINI_MODEL,
          ...(process.env.GEMINI_FALLBACK_MODELS || '').split(','),
          ...defaults,
        ];
  return Array.from(
    new Set(list.map((m) => (m || '').trim().replace(/^models\//, '')).filter(Boolean))
  );
}

/**
 * Tắt/giảm suy luận (thinking) để hạ độ trễ phản hồi:
 * - Gemini 2.5: dùng thinkingBudget = 0
 * - Gemini 3.x: dùng thinkingLevel = "minimal"
 * Không bao giờ gửi cả hai trường trong cùng 1 request.
 */
function buildThinkingConfig(model: string): Record<string, any> | undefined {
  if (/^gemini-2\.5/i.test(model)) {
    return { thinkingBudget: 0 };
  }
  if (/^gemini-3/i.test(model)) {
    return { thinkingLevel: 'minimal' };
  }
  return undefined;
}

async function callGeminiModel(
  model: string,
  mode: OcrMode,
  data: string,
  mime: string,
  timeoutMs: number,
  parentSignal?: AbortSignal,
  disableThinking = false
): Promise<any> {
  const apiKey = process.env.GEMINI_API_KEY as string;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const controller = new AbortController();
  const onParentAbort = () => controller.abort();
  if (parentSignal) {
    if (parentSignal.aborted) controller.abort();
    else parentSignal.addEventListener('abort', onParentAbort, { once: true });
  }
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const thinkingConfig = disableThinking ? undefined : buildThinkingConfig(model);
  const generationConfig: Record<string, any> = {
    temperature: 0,
    responseMimeType: 'application/json',
    responseSchema: mode === 'TABLE' ? TABLE_SCHEMA : TAG_SCHEMA,
    ...(mode === 'TAG' ? { maxOutputTokens: 200 } : {}),
    ...(thinkingConfig ? { thinkingConfig } : {}),
  };

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
        generationConfig,
      }),
    });

    const json: any = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const msg = json?.error?.message || `HTTP ${resp.status}`;
      // Nếu model không chấp nhận thinkingConfig -> thử lại ngay không kèm thinkingConfig
      if (!disableThinking && thinkingConfig && resp.status === 400 && /thinking/i.test(msg)) {
        return await callGeminiModel(model, mode, data, mime, timeoutMs, parentSignal, true);
      }
      const err = new ApiError(502, 'OCR_ENGINE_ERROR', `Dịch vụ OCR (Gemini) lỗi: ${msg}`);
      (err as any).retryable =
        resp.status === 404 ||
        resp.status === 429 ||
        resp.status >= 500 ||
        /no longer available|not found|not supported|deprecated|overloaded/i.test(msg);
      throw err;
    }
    const text: string =
      json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';
    try {
      return JSON.parse(text);
    } catch {
      const err = new ApiError(502, 'OCR_ENGINE_ERROR', 'Không phân tích được kết quả OCR. Vui lòng chụp lại rõ hơn.');
      (err as any).retryable = true;
      throw err;
    }
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    if (err?.name === 'AbortError') {
      const e = new ApiError(504, 'OCR_TIMEOUT', 'Quét OCR quá thời gian chờ. Vui lòng chụp lại rõ hơn.');
      (e as any).retryable = true;
      throw e;
    }
    const e = new ApiError(502, 'OCR_ENGINE_ERROR', `Không gọi được dịch vụ OCR: ${err?.message || err}`);
    (e as any).retryable = true;
    throw e;
  } finally {
    clearTimeout(timer);
    if (parentSignal) parentSignal.removeEventListener('abort', onParentAbort);
  }
}

async function callGeminiTable(data: string, mime: string): Promise<any> {
  const models = getGeminiModels('TABLE');
  const timeoutMs = getTableTimeoutMs();
  let lastErr: any;
  for (const model of models) {
    try {
      return await callGeminiModel(model, 'TABLE', data, mime, timeoutMs);
    } catch (err: any) {
      lastErr = err;
      if (!err?.retryable) throw err;
      console.warn(`[OCR:TABLE] Model "${model}" lỗi/chậm (${err?.message}), thử model tiếp theo...`);
    }
  }
  throw lastErr;
}

/**
 * Gọi Gemini cho TAG với:
 * 1) Model nhanh nhất chạy ngay (gemini-3.1-flash-lite).
 * 2) Hedging: nếu sau TAG_HEDGE_DELAY_MS (~2.2s) chưa xong, gọi song song model dự phòng (gemini-3.5-flash) — ai trả về trước thắng.
 * 3) Hạn chót cứng TAG_TIMEOUT_MS (~4.8s): quá hạn trả 504 OCR_TIMEOUT để đảm bảo phản hồi <= 5s.
 */
async function callGeminiTag(data: string, mime: string): Promise<{ out: any; model: string }> {
  const models = getGeminiModels('TAG');
  const totalTimeoutMs = getTagTimeoutMs();
  const hedgeDelayMs = getTagHedgeDelayMs();

  const masterController = new AbortController();
  let timedOut = false;
  const masterTimer = setTimeout(() => {
    timedOut = true;
    masterController.abort();
  }, totalTimeoutMs);

  let nextIdx = 0;
  let inFlight = 0;
  let settled = false;
  let lastErr: any;
  let hedgeTimer: ReturnType<typeof setTimeout> | null = null;

  return new Promise<{ out: any; model: string }>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(masterTimer);
      if (hedgeTimer) clearTimeout(hedgeTimer);
      masterController.abort();
    };

    const launchNext = () => {
      if (settled || masterController.signal.aborted || nextIdx >= models.length) return;
      const model = models[nextIdx++];
      inFlight++;

      callGeminiModel(model, 'TAG', data, mime, totalTimeoutMs, masterController.signal)
        .then((out) => {
          inFlight--;
          if (settled) return;
          settled = true;
          cleanup();
          resolve({ out, model });
        })
        .catch((err) => {
          inFlight--;
          lastErr = err;
          if (settled) return;

          if (timedOut || masterController.signal.aborted) {
            settled = true;
            cleanup();
            reject(
              new ApiError(
                504,
                'OCR_TIMEOUT',
                'Đọc tag quá 5 giây, vui lòng giữ yên và chụp lại rõ hơn.'
              )
            );
            return;
          }

          if (!err?.retryable) {
            settled = true;
            cleanup();
            reject(err);
            return;
          }

          if (nextIdx < models.length) {
            launchNext();
          } else if (inFlight === 0) {
            settled = true;
            cleanup();
            reject(lastErr);
          }
        });
    };

    // Khởi chạy model chính
    launchNext();

    // Nếu sau hedgeDelayMs vẫn chưa có kết quả, chạy song song model thứ 2
    if (models.length > 1) {
      hedgeTimer = setTimeout(() => {
        if (!settled && !masterController.signal.aborted && nextIdx < models.length) {
          launchNext();
        }
      }, hedgeDelayMs);
    }
  });
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

/** Chuẩn hóa chuỗi mã vạch (chỉ giữ chữ số/chữ cái in hoa, tối thiểu 6 ký tự). */
export function sanitizeBarcode(raw: unknown): string {
  const cleaned = String(raw || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/[^0-9A-Za-z-_]/g, '');
  return cleaned.length >= 6 ? cleaned : '';
}

function buildTagCodes(productCode: string, productName: string, barcode: string): string[] {
  const set = new Set<string>();
  for (const src of [productCode, productName, barcode]) {
    if (!src) continue;
    const c1 = generateProductCode(src);
    const c2 = normalizeToUpperCode(src);
    if (c1) set.add(c1);
    if (c2) set.add(c2);
  }
  return Array.from(set);
}

/* ------------------------------ Public API ------------------------------ */

export async function ocrScanTable(data: string, mime: string): Promise<OcrTableResult> {
  if (process.env.GEMINI_API_KEY) {
    const out = await callGeminiTable(data, mime);
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
  const startedAt = Date.now();
  if (process.env.GEMINI_API_KEY) {
    const { out, model } = await callGeminiTag(data, mime);
    const productName = String(out?.productName || '').trim();
    const rawCode = String(out?.productCode || '').trim();
    const barcode = sanitizeBarcode(out?.barcode);
    const productCode = rawCode ? generateProductCode(rawCode) : generateProductCode(productName);
    const q = Number(out?.quantity);
    const rawText = String(out?.rawText || [productName, rawCode, barcode].filter(Boolean).join(' | '));
    return {
      productName,
      productCode,
      barcode,
      codes: buildTagCodes(rawCode || productCode, productName, barcode),
      quantity: Number.isFinite(q) && q > 0 ? Math.round(q) : null,
      rawText,
      engine: 'gemini',
      model,
      durationMs: Date.now() - startedAt,
    };
  }

  if (mime === 'application/pdf') {
    throw new ApiError(422, 'OCR_UNSUPPORTED', 'Quét PDF cần cấu hình GEMINI_API_KEY trên server.');
  }
  const rawText = await runTesseract(data);
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 3);
  const firstLine = lines[0] || '';
  const eanMatch = rawText.match(/\b(\d{8,14})\b/);
  const barcode = eanMatch ? eanMatch[1] : '';
  const productCode = generateProductCode(firstLine);
  return {
    productName: firstLine,
    productCode,
    barcode,
    codes: buildTagCodes(productCode, firstLine, barcode),
    quantity: null,
    rawText,
    engine: 'tesseract',
    durationMs: Date.now() - startedAt,
  };
}
