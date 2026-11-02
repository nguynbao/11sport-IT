import { Router, Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/errors';
import {
  listSystemPrinters,
  printBarcodeLabelsDirect,
  DirectPrintPayload,
} from '../utils/windowsPrinter';

export const printersRouter = Router();

/**
 * GET /api/v1/printers
 * Quét danh sách máy in đang kết nối trên máy trạm/server Windows
 */
printersRouter.get(
  '/printers',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await listSystemPrinters();
      res.json({
        data: result,
        meta: {},
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/printers/print-labels
 * Gửi lệnh in tem mã vạch Code128 trực tiếp xuống máy in nhiệt (ví dụ: Xprinter XP-350BM)
 */
printersRouter.post(
  '/printers/print-labels',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = (req.body || {}) as Partial<DirectPrintPayload>;
      const printerName = String(body.printerName || '').trim();
      if (!printerName) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Vui lòng chọn máy in để in tem mã vạch', {
          printerName: 'Chưa chọn máy in',
        });
      }

      const syncOnly = Boolean(body.syncOnly);
      if (!syncOnly && (!Array.isArray(body.items) || body.items.length === 0)) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Danh sách tem cần in không được để trống', {
          items: 'Rỗng',
        });
      }

      const result = await printBarcodeLabelsDirect({
        printerName,
        syncOnly,
        preset: {
          id: body.preset?.id,
          widthMm: Number(body.preset?.widthMm) || 50,
          heightMm: Number(body.preset?.heightMm) || 30,
          columns: body.preset?.columns === 2 ? 2 : 1,
          pageWidthMm: Number(body.preset?.pageWidthMm) || 50,
          pageHeightMm: Number(body.preset?.pageHeightMm) || 30,
        },
        options: {
          showShopName: body.options?.showShopName !== false,
          showProductName: Boolean(body.options?.showProductName),
          showPrice: body.options?.showPrice !== false,
        },
        items: (body.items || []).map((it) => ({
          code: String(it.code || ''),
          name: String(it.name || ''),
          sellingPrice: Number(it.sellingPrice) || 0,
          quantity: Number(it.quantity) || 0,
        })),
      });

      res.json({
        data: result,
        meta: {},
      });
    } catch (err: any) {
      if (err instanceof ApiError) {
        return next(err);
      }
      return next(
        new ApiError(
          400,
          'PRINTER_ERROR',
          err?.message || 'Không thể gửi lệnh in tới máy in nhiệt.'
        )
      );
    }
  }
);
