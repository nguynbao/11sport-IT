import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import request from 'supertest';

process.env.FORCE_MEMORY_DB = 'true';

import { createApp } from '../src/app';
import { connectDatabase, clearDatabase, productRepo } from '../src/config/db';
import { seedDatabaseIfNeeded } from '../src/config/seed';
import { ocrScanTag, getGeminiModels } from '../src/utils/ocr';
import {
  resolveKeepAliveIntervalMs,
  resolveKeepAliveHealthUrl,
} from '../src/utils/keepAlive';

const app = createApp();
const originalFetch = global.fetch;

describe('OCR Tag Speed (<= 5s), Barcode Fast-Path & Keep-Alive (v1.5)', () => {
  beforeAll(async () => {
    await connectDatabase();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_TAG_TIMEOUT_MS;
    delete process.env.GEMINI_TAG_HEDGE_MS;
    vi.restoreAllMocks();
  });

  it('ưu tiên gemini-3.1-flash-lite đầu tiên cho chế độ TAG ngay cả khi GEMINI_MODEL=gemini-3.5-flash', () => {
    process.env.GEMINI_MODEL = 'gemini-3.5-flash';
    const tagModels = getGeminiModels('TAG');
    expect(tagModels[0]).toBe('gemini-3.1-flash-lite');
    expect(tagModels).toContain('gemini-3.5-flash');
  });

  it('hedging: khi model chính phản hồi chậm quá ngưỡng hedge, tự gọi song song model dự phòng và trả về trước hạn chót', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.GEMINI_TAG_HEDGE_MS = '120';
    process.env.GEMINI_TAG_TIMEOUT_MS = '1500';

    const calledModels: { model: string; body: any }[] = [];

    global.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      const m = String(url).match(/models\/([^:]+):generateContent/);
      const model = m ? m[1] : 'unknown';
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      calledModels.push({ model, body });

      if (model === 'gemini-3.1-flash-lite') {
        // Model 1 bị treo 2000ms (lâu hơn cả hedge 120ms)
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const err: any = new Error('Aborted');
            err.name = 'AbortError';
            reject(err);
          });
        });
      }

      // Model 2 (gemini-3.5-flash) trả kết quả nhanh sau 60ms
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            ok: true,
            status: 200,
            json: async () => ({
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        text: JSON.stringify({
                          productName: 'ESS-Chân Váy Thể Thao chữ A-Trắng-L',
                          productCode: 'PKP018SKWW26WH-L',
                          barcode: '8935364316042',
                          quantity: null,
                        }),
                      },
                    ],
                  },
                },
              ],
            }),
          } as any);
        }, 60);
      });
    }) as any;

    const started = Date.now();
    const res = await ocrScanTag(Buffer.from('fake-jpeg').toString('base64'), 'image/jpeg');
    const elapsed = Date.now() - started;

    expect(elapsed).toBeLessThan(800);
    expect(res.model).toBe('gemini-3.5-flash');
    expect(res.productCode).toBe('PKP018SKWW26WH_L');
    expect(res.barcode).toBe('8935364316042');
    expect(calledModels.map((c) => c.model)).toEqual([
      'gemini-3.1-flash-lite',
      'gemini-3.5-flash',
    ]);
    // Kiểm tra đã cấu hình tắt/giảm thinking và giới hạn maxOutputTokens
    expect(calledModels[0].body.generationConfig.maxOutputTokens).toBe(200);
    expect(calledModels[0].body.generationConfig.thinkingConfig).toEqual({
      thinkingLevel: 'minimal',
    });
  });

  it('hạn chót cứng (hard timeout): cắt kết nối và trả 504 OCR_TIMEOUT khi mọi model đều quá hạn', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.GEMINI_TAG_HEDGE_MS = '80';
    process.env.GEMINI_TAG_TIMEOUT_MS = '300';

    global.fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const err: any = new Error('Aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    }) as any;

    const started = Date.now();
    await expect(
      ocrScanTag(Buffer.from('fake-jpeg').toString('base64'), 'image/jpeg')
    ).rejects.toMatchObject({
      statusCode: 504,
      code: 'OCR_TIMEOUT',
    });
    const elapsed = Date.now() - started;
    expect(elapsed).toBeLessThan(700);
  });

  it('POST /imports/:id/scan-tag: chiếc 1 quét OCR + học barcode, chiếc 2 khớp tức thì qua barcode (ocrMs = 0) và lưu barcode lên Product khi hoàn thành', async () => {
    await clearDatabase();
    await seedDatabaseIfNeeded();

    process.env.GEMINI_API_KEY = 'test-key';
    let geminiCalls = 0;

    global.fetch = vi.fn().mockImplementation(async () => {
      geminiCalls++;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      productName: 'Quần short nam 2 lớp lót đen - màu xanh lá - XL',
                      productCode: 'PSH008MSW25GR-XL',
                      barcode: '8935364308672',
                      quantity: null,
                    }),
                  },
                ],
              },
            },
          ],
        }),
      } as any;
    }) as any;

    // Tạo phiếu nhập ở trạng thái CHECKING với 2 chiếc quần short PSH008MSW25GR-XL và 1 áo polo MOVE
    const createRes = await request(app)
      .post('/api/v1/imports')
      .send({
        status: 'CHECKING',
        note: 'Test scan-tag 1 request + barcode learning',
        items: [
          {
            productName: 'Quần short nam 2 lớp lót đen - màu xanh lá - XL (PSH008MSW25GR-XL)',
            unit: 'Cái',
            expectedQuantity: 2,
            costPrice: 260000,
          },
          {
            productName: 'MOVE-Áo Polo phối viền cổ-Hồng-S (8935364317145)',
            unit: 'Cái',
            expectedQuantity: 1,
            costPrice: 290000,
          },
        ],
      });
    expect(createRes.status).toBe(201);
    const receiptId = createRes.body.data._id;

    // Lần 1: Chụp ảnh chiếc quần short thứ 1 -> gọi Gemini OCR, học được barcode 8935364308672
    const scan1 = await request(app)
      .post(`/api/v1/imports/${receiptId}/scan-tag`)
      .send({
        fileBase64: Buffer.from('tag-photo-1').toString('base64'),
        mimeType: 'image/jpeg',
      });
    expect(scan1.status).toBe(200);
    expect(scan1.headers['server-timing']).toContain('total;dur=');
    expect(scan1.body.data.matched).toBe(true);
    expect(scan1.body.data.source).toBe('ocr');
    expect(scan1.body.data.barcode).toBe('8935364308672');
    expect(scan1.body.data.scannedQuantity).toBe(1);
    expect(scan1.body.data.isFull).toBe(false);
    expect(scan1.body.data.matchedItem.barcode).toBe('8935364308672');
    expect(geminiCalls).toBe(1);

    // Lần 2: Chụp chiếc quần short thứ 2 có kèm barcode 8935364308672 -> khớp tức thì qua barcode, KHÔNG gọi Gemini!
    const scan2 = await request(app)
      .post(`/api/v1/imports/${receiptId}/scan-tag`)
      .send({
        barcode: '8935364308672',
        fileBase64: Buffer.from('tag-photo-2').toString('base64'),
        mimeType: 'image/jpeg',
      });
    expect(scan2.status).toBe(200);
    expect(scan2.body.data.matched).toBe(true);
    expect(scan2.body.data.source).toBe('barcode');
    expect(scan2.body.data.timing.ocrMs).toBe(0);
    expect(scan2.body.data.scannedQuantity).toBe(2);
    expect(scan2.body.data.isFull).toBe(true);
    expect(scan2.body.data.matchedItem.isConfirmed).toBe(true);
    expect(geminiCalls).toBe(1); // Không gọi thêm OCR!

    // Hoàn thành phiếu nhập -> kiểm tra Product.barcode đã được lưu
    const completeRes = await request(app)
      .post(`/api/v1/imports/${receiptId}/complete`)
      .send({});
    expect(completeRes.status).toBe(200);

    const product = await productRepo.findOne({ code: 'PSH008MSW25GR_XL' });
    expect(product).toBeTruthy();
    expect(product?.barcode).toBe('8935364308672');
    expect(product?.stock).toBe(2);
  });

  it('keepAlive: giới hạn chu kỳ trong khoảng 5-10 phút và chuẩn hóa URL /api/v1/health', () => {
    expect(resolveKeepAliveIntervalMs(undefined)).toBe(8 * 60 * 1000);
    expect(resolveKeepAliveIntervalMs(2)).toBe(5 * 60 * 1000);
    expect(resolveKeepAliveIntervalMs(25)).toBe(10 * 60 * 1000);
    expect(resolveKeepAliveIntervalMs(7)).toBe(7 * 60 * 1000);

    process.env.KEEP_ALIVE_URL = 'https://one1sport-it.onrender.com/';
    expect(resolveKeepAliveHealthUrl()).toBe('https://one1sport-it.onrender.com/api/v1/health');
    delete process.env.KEEP_ALIVE_URL;
  });
});
