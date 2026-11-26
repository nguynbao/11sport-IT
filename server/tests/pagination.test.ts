import { describe, expect, it } from 'vitest';
import { paginate, parsePagination, withPagination } from '../src/shared/pagination';

describe('server/src/shared/pagination', () => {
  const sample = Array.from({ length: 45 }, (_, i) => i + 1);

  it('disables pagination when neither page nor pageSize is provided', () => {
    const res = withPagination(sample, {}, { custom: 'ok' });
    expect(res.data).toHaveLength(45);
    expect(res.meta).toEqual({ total: 45, custom: 'ok' });
  });

  it('parses and clamps page and pageSize boundaries', () => {
    expect(parsePagination({ page: '2', pageSize: '15' })).toEqual({
      enabled: true,
      page: 2,
      pageSize: 15,
    });
    expect(parsePagination({ page: '-5', pageSize: '9999' })).toEqual({
      enabled: true,
      page: 1,
      pageSize: 200,
    });
    expect(parsePagination({ page: '3', pageSize: '0' })).toEqual({
      enabled: true,
      page: 3,
      pageSize: 1,
    });
  });

  it('clamps out-of-range page to last page and returns correct meta', () => {
    const res = paginate(sample, { page: 99, pageSize: 20 });
    expect(res.data).toEqual([41, 42, 43, 44, 45]);
    expect(res.pagination).toEqual({
      page: 3,
      pageSize: 20,
      total: 45,
      totalPages: 3,
      hasNext: false,
      hasPrev: true,
    });
  });

  it('handles empty collections gracefully', () => {
    const res = paginate([], { page: 2, pageSize: 20 });
    expect(res.data).toEqual([]);
    expect(res.pagination).toEqual({
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    });
  });

  it('applies sortBy and sortOrder before slicing pages', () => {
    const rows = [
      { _id: '1', name: 'B', price: 200 },
      { _id: '2', name: 'A', price: 300 },
      { _id: '3', name: 'C', price: 100 },
    ];
    const res = withPagination(rows, {
      page: '1',
      pageSize: '2',
      sortBy: 'price',
      sortOrder: 'desc',
    });
    expect(res.data?.map((r) => r._id)).toEqual(['2', '1']);
    expect(res.meta?.pagination?.total).toBe(3);
  });
});
