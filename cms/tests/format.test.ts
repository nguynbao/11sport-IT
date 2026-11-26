import { describe, it, expect } from 'vitest';
import {
  formatVND,
  formatNumberDots,
  parseNumberDots,
  cleanPhoneDigits,
  formatPhone,
  contractTypeLabel,
  formatVariantLabel,
} from '@/shared/utils/format';

describe('shared/utils/format', () => {
  it('formats and parses dot-separated numbers and VND', () => {
    expect(formatNumberDots(1250000)).toBe('1.250.000');
    expect(formatNumberDots(null)).toBe('0');
    expect(parseNumberDots('1.250.000 đ')).toBe(1250000);
    expect(parseNumberDots('')).toBe(0);
    expect(formatVND(500000)).toBe('500.000 VND');
    expect(formatVND(undefined)).toBe('0 VND');
  });

  it('normalizes and formats Vietnamese phone numbers', () => {
    expect(cleanPhoneDigits('0905-123 456')).toBe('0905123456');
    expect(formatPhone('0905123456')).toBe('0905 123 456');
    expect(formatPhone('01234567890')).toBe('0123 456 7890');
    expect(formatPhone('')).toBe('');
  });

  it('maps contract types and variant labels', () => {
    expect(contractTypeLabel('FULLTIME')).toBe('Chính thức');
    expect(contractTypeLabel('PROBATION')).toBe('Thử việc');
    expect(contractTypeLabel('INTERN')).toBe('Thực tập');
    expect(contractTypeLabel('UNKNOWN')).toBe('Chưa cập nhật');
    expect(formatVariantLabel('Đỏ', 'L')).toBe('Đỏ - Size L');
    expect(formatVariantLabel('', '40')).toBe('Size 40');
    expect(formatVariantLabel('', '')).toBe('');
  });
});
