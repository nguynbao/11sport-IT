import { Request, Response, NextFunction } from 'express';
import { getSystemPrintersList, executeDirectLabelPrint } from '../services/printers.service';

export async function getPrintersHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getSystemPrintersList();
    res.json({ success: true, data: result, meta: {} });
  } catch (err) {
    next(err);
  }
}

export async function printLabelsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { result, message } = await executeDirectLabelPrint(req.body || {});
    res.json({ success: true, data: result, message, meta: {} });
  } catch (err) {
    next(err);
  }
}
