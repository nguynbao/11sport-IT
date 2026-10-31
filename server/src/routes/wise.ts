import { Router } from 'express';
import { ApiError } from '../utils/errors';

export const wiseRouter = Router();

export interface WiseCurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  flag: string;
  decimals: number;
}

const SUPPORTED_CURRENCIES: WiseCurrencyInfo[] = [
  { code: 'VND', name: 'Đồng Việt Nam', symbol: '₫', flag: '🇻🇳', decimals: 0 },
  { code: 'USD', name: 'Đô la Mỹ (US Dollar)', symbol: '$', flag: '🇺🇸', decimals: 2 },
  { code: 'PHP', name: 'Peso Philippines', symbol: '₱', flag: '🇵🇭', decimals: 2 },
  { code: 'EUR', name: 'Đồng Euro', symbol: '€', flag: '🇪🇺', decimals: 2 },
  { code: 'GBP', name: 'Bảng Anh (British Pound)', symbol: '£', flag: '🇬🇧', decimals: 2 },
  { code: 'AUD', name: 'Đô la Úc (Australian Dollar)', symbol: 'A$', flag: '🇦🇺', decimals: 2 },
  { code: 'SGD', name: 'Đô la Singapore', symbol: 'S$', flag: '🇸🇬', decimals: 2 },
  { code: 'CAD', name: 'Đô la Canada', symbol: 'C$', flag: '🇨🇦', decimals: 2 },
  { code: 'JPY', name: 'Yên Nhật (Japanese Yen)', symbol: '¥', flag: '🇯🇵', decimals: 0 },
  { code: 'KRW', name: 'Won Hàn Quốc', symbol: '₩', flag: '🇰🇷', decimals: 0 },
  { code: 'THB', name: 'Baht Thái Lan', symbol: '฿', flag: '🇹🇭', decimals: 2 },
  { code: 'CHF', name: 'Franc Thụy Sĩ', symbol: 'CHF', flag: '🇨🇭', decimals: 2 },
  { code: 'CNY', name: 'Nhân dân tệ (Yuan)', symbol: '¥', flag: '🇨🇳', decimals: 2 },
  { code: 'HKD', name: 'Đô la Hồng Kông', symbol: 'HK$', flag: '🇭🇰', decimals: 2 },
  { code: 'MYR', name: 'Ringgit Malaysia', symbol: 'RM', flag: '🇲🇾', decimals: 2 },
  { code: 'TWD', name: 'Đài tệ (New Taiwan Dollar)', symbol: 'NT$', flag: '🇹🇼', decimals: 0 },
];

function getWiseConfig() {
  const token = (process.env.WISE_API_TOKEN || '').trim();
  const baseUrl = (process.env.WISE_API_BASE_URL || 'https://api.wise.com')
    .trim()
    .replace(/\/+$/, '');
  const profileId = (process.env.WISE_PROFILE_ID || '').trim();
  const mode: 'LIVE_AUTHENTICATED' | 'LIVE_PUBLIC' = token
    ? 'LIVE_AUTHENTICATED'
    : 'LIVE_PUBLIC';
  return { token, baseUrl, profileId, mode };
}

function roundCurrency(amount: number, currency: string): number {
  const info = SUPPORTED_CURRENCIES.find((c) => c.code === currency);
  const decimals = info ? info.decimals : currency === 'VND' ? 0 : 2;
  const factor = Math.pow(10, decimals);
  return Math.round((Number(amount) || 0) * factor) / factor;
}

async function fetchWiseQuoteRaw(payload: {
  sourceCurrency: string;
  targetCurrency: string;
  sourceAmount?: number | null;
  targetAmount?: number | null;
}): Promise<any> {
  const { token, baseUrl, profileId } = getWiseConfig();
  const url =
    token && profileId
      ? `${baseUrl}/v3/profiles/${profileId}/quotes`
      : `${baseUrl}/v3/quotes`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      const err: any = new Error(
        `Wise API HTTP ${response.status}: ${errText.slice(0, 200)}`
      );
      err.status = response.status;
      throw err;
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

// GET /api/v1/wise/currencies
wiseRouter.get('/wise/currencies', (_req, res) => {
  const { mode, baseUrl, profileId } = getWiseConfig();
  res.json({
    data: {
      currencies: SUPPORTED_CURRENCIES,
      mode,
      baseUrl,
      hasProfileId: Boolean(profileId),
    },
    meta: {},
  });
});

// POST /api/v1/wise/quote
wiseRouter.post('/wise/quote', async (req, res, next) => {
  try {
    const sourceCurrency = String(req.body?.sourceCurrency || 'USD')
      .trim()
      .toUpperCase();
    const targetCurrency = String(req.body?.targetCurrency || 'VND')
      .trim()
      .toUpperCase();

    const rawSourceAmount =
      req.body?.sourceAmount !== undefined && req.body?.sourceAmount !== null
        ? Number(req.body.sourceAmount)
        : 100;

    if (Number.isNaN(rawSourceAmount) || rawSourceAmount <= 0) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'Vui lòng nhập số tiền cần quy đổi lớn hơn 0.'
      );
    }

    if (sourceCurrency === targetCurrency) {
      const amt = roundCurrency(rawSourceAmount, sourceCurrency);
      return res.json({
        data: {
          sourceCurrency,
          targetCurrency,
          sourceAmount: amt,
          targetAmount: amt,
          grossTargetAmount: amt,
          rate: 1,
          inverseRate: 1,
          rateDisplay: `1 ${sourceCurrency} = 1 ${targetCurrency}`,
          rateTimestamp: new Date().toISOString(),
          mode: getWiseConfig().mode,
        },
        meta: {},
      });
    }

    const { mode } = getWiseConfig();

    // Chiều thuận (khi sourceCurrency !== 'VND')
    if (sourceCurrency !== 'VND') {
      try {
        const rawQuote = await fetchWiseQuoteRaw({
          sourceCurrency,
          targetCurrency,
          sourceAmount: rawSourceAmount,
          targetAmount: null,
        });
        const rate = Number(rawQuote.rate || 0);
        if (rate > 0) {
          const inverseRate = 1 / rate;
          const grossTargetAmount = roundCurrency(
            rawSourceAmount * rate,
            targetCurrency
          );
          return res.json({
            data: {
              quoteId: rawQuote.id || null,
              sourceCurrency,
              targetCurrency,
              sourceAmount: roundCurrency(rawSourceAmount, sourceCurrency),
              targetAmount: grossTargetAmount,
              grossTargetAmount,
              rate,
              inverseRate,
              rateDisplay:
                rate >= 1
                  ? `1 ${sourceCurrency} = ${rate.toLocaleString('en-US', {
                      maximumFractionDigits: 4,
                    })} ${targetCurrency}`
                  : `1 ${targetCurrency} = ${inverseRate.toLocaleString('en-US', {
                      maximumFractionDigits: 4,
                    })} ${sourceCurrency}`,
              rateTimestamp:
                rawQuote.rateTimestamp ||
                rawQuote.createdTime ||
                new Date().toISOString(),
              mode,
            },
            meta: {},
          });
        }
      } catch {
        // Nếu cặp chiều thuận không mở trực tiếp trên Wise (422), lấy tỷ giá từ chiều ngược bên dưới
      }
    }

    // Chiều ngược (khi sourceCurrency === 'VND' hoặc cần lấy tỷ giá đối ứng từ Wise)
    const reverseQuote = await fetchWiseQuoteRaw({
      sourceCurrency: targetCurrency,
      targetCurrency: sourceCurrency,
      sourceAmount: 100,
      targetAmount: null,
    });
    const reverseRate = Number(reverseQuote.rate || 0);
    if (!reverseRate || reverseRate <= 0) {
      throw new ApiError(
        502,
        'WISE_RATE_ERROR',
        'Không thể lấy tỷ giá trực tiếp từ Wise API.'
      );
    }

    const rate = 1 / reverseRate;
    const grossTargetAmount = roundCurrency(
      rawSourceAmount * rate,
      targetCurrency
    );

    return res.json({
      data: {
        quoteId: reverseQuote.id || null,
        sourceCurrency,
        targetCurrency,
        sourceAmount: roundCurrency(rawSourceAmount, sourceCurrency),
        targetAmount: grossTargetAmount,
        grossTargetAmount,
        rate,
        inverseRate: reverseRate,
        rateDisplay:
          reverseRate >= 1
            ? `1 ${targetCurrency} = ${reverseRate.toLocaleString('en-US', {
                maximumFractionDigits: 4,
              })} ${sourceCurrency}`
            : `1 ${sourceCurrency} = ${rate.toLocaleString('en-US', {
                maximumFractionDigits: 4,
              })} ${targetCurrency}`,
        rateTimestamp:
          reverseQuote.rateTimestamp ||
          reverseQuote.createdTime ||
          new Date().toISOString(),
        mode,
      },
      meta: {},
    });
  } catch (err) {
    next(err);
  }
});
