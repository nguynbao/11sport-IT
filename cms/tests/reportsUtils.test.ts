import { describe, it, expect } from 'vitest';
import { parseLocalDateBound, extractClientOrderDebtMeta } from '@/features/reports/utils';
import type { Order } from '@/shared/types';

describe('features/reports/utils', () => {
  it('parses local date bounds accurately at start and end of day', () => {
    const start = parseLocalDateBound('2026-11-26', false);
    const end = parseLocalDateBound('2026-11-26', true);
    expect(start).not.toBeNull();
    expect(end).not.toBeNull();
    expect(start!.getFullYear()).toBe(2026);
    expect(start!.getMonth()).toBe(10);
    expect(start!.getDate()).toBe(26);
    expect(start!.getHours()).toBe(0);
    expect(end!.getHours()).toBe(23);
    expect(end!.getMinutes()).toBe(59);
    expect(parseLocalDateBound('', false)).toBeNull();
  });

  it('computes order debt metadata including payments and return adjustments', () => {
    const order = {
      _id: 'o1',
      orderCode: 'HD-001',
      totalAmount: 1000000,
      debtAmount: 200000,
      initialDebtAmount: 600000,
      debtPayments: [{ amount: 300000 }],
      debtAdjustments: [{ amount: 100000 }],
      paymentMethod: 'CASH',
      items: [],
      createdAt: '2026-11-25T10:00:00Z',
    } as unknown as Order;

    const meta = extractClientOrderDebtMeta(order, 50000);
    expect(meta.initialDebtAmount).toBe(600000);
    expect(meta.cashAtPurchase).toBe(400000);
    expect(meta.collectedDebtAmount).toBe(300000);
    expect(meta.reducedByReturnAmount).toBe(100000);
    expect(meta.paidAmount).toBe(650000);
    expect(meta.debtStatus).toBe('PARTIAL');
  });
});
