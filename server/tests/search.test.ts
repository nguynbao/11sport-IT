import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { connectDatabase, clearDatabase, disconnectDatabase } from '../src/config/db';
import { seedDatabaseIfNeeded } from '../src/config/seed';
import {
  normalizeVietnamese,
  compactAlphaNum,
  normalizePhoneDigits,
  scoreSearchMatch,
  filterAndRankBySearch,
} from '../src/utils/search';

const app = createApp();

describe('v2.4: Smart Search Engine (Bỏ dấu tiếng Việt, Đa từ rời rạc, Mã viết liền, Viết tắt, Sai chính tả nhẹ & Xếp hạng độ khớp)', () => {
  let aoCatId = '';
  let giayCatId = '';
  let poloRedId = '';

  beforeAll(async () => {
    process.env.FORCE_MEMORY_DB = 'true';
    await connectDatabase();
    await clearDatabase();
    await seedDatabaseIfNeeded();

    const catAo = await request(app)
      .post('/api/v1/categories')
      .set('x-user-id', 'admin')
      .send({ code: 'AO', name: 'Áo thể thao' });
    aoCatId = catAo.body.data._id;

    const catGiay = await request(app)
      .post('/api/v1/categories')
      .set('x-user-id', 'admin')
      .send({ code: 'GIAY', name: 'Giày chạy bộ' });
    giayCatId = catGiay.body.data._id;

    const p1 = await request(app)
      .post('/api/v1/products')
      .set('x-user-id', 'admin')
      .send({
        name: 'Áo Polo Thể thao Unisex V1 (Áo Polo Thể thao Unisex V1 KMAP262510 Đỏ size L)',
        categoryId: aoCatId,
        unit: 'Cái',
        costPrice: 180000,
        sellingPrice: 350000,
        quantity: 10,
        targetWarehouse: 'FLOOR_1',
      });
    poloRedId = p1.body.data._id;

    await request(app)
      .post('/api/v1/products')
      .set('x-user-id', 'admin')
      .send({
        name: 'Áo Polo Thể thao Unisex V1 (Áo Polo Thể thao Unisex V1 KMAP262510 Xanh Đen size XL)',
        categoryId: aoCatId,
        unit: 'Cái',
        costPrice: 180000,
        sellingPrice: 350000,
        quantity: 8,
        targetWarehouse: 'FLOOR_1',
      });

    await request(app)
      .post('/api/v1/products')
      .set('x-user-id', 'admin')
      .send({
        name: 'Giày Cầu Lông Yonex Pro (Giày Cầu Lông Yonex Pro GCL88 Trắng size 42)',
        categoryId: giayCatId,
        unit: 'Đôi',
        costPrice: 800000,
        sellingPrice: 1450000,
        quantity: 5,
        targetWarehouse: 'FLOOR_1',
      });

    // Tạo đơn hàng mẫu để test tìm kiếm đơn hàng & khách hàng
    await request(app)
      .post('/api/v1/orders')
      .set('x-user-id', 'sales1')
      .send({
        customerName: 'Nguyễn Đặng Hoàng Phúc',
        customerPhone: '0945123456',
        paymentMethod: 'BANKING',
        items: [{ productId: poloRedId, quantity: 2 }],
      });
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it('Unit test: normalizeVietnamese, compactAlphaNum, normalizePhoneDigits & scoreSearchMatch', () => {
    expect(normalizeVietnamese('Áo Đấu Đội Tuyển_Việt-Nam (Đỏ)')).toBe(
      'ao dau doi tuyen viet nam do'
    );
    expect(compactAlphaNum('AO_POLO_KMAP-262510')).toBe('aopolokmap262510');
    expect(normalizePhoneDigits('+84 945 123 456')).toBe('0945123456');

    const ranked = filterAndRankBySearch(
      [
        { code: 'GIAY_YONEX_42', name: 'Giày Cầu Lông Yonex size 42' },
        { code: 'AO_POLO_DO_L', name: 'Áo Polo Thể Thao Đỏ size L' },
        { code: 'AO_POLO_XANH_XL', name: 'Áo Polo Thể Thao Xanh size XL' },
      ],
      'ao polo do l',
      (item) => [
        { text: item.code, weight: 1.5 },
        { text: item.name, weight: 1.3 },
      ]
    );
    expect(ranked.length).toBe(1);
    expect(ranked[0].code).toBe('AO_POLO_DO_L');

    // Chữ cái viết tắt (acronym): "aptt" khớp "Áo Polo Thể Thao"
    expect(scoreSearchMatch('aptt', ['Áo Polo Thể Thao'])).toBeGreaterThan(0);

    // Sai chính tả nhẹ 1 ký tự ("yonx" hoặc "yonez" -> "yonex")
    expect(scoreSearchMatch('yonez 42', ['Giày Cầu Lông Yonex size 42'])).toBeGreaterThan(0);
  });

  it('API GET /products: Tìm kiếm không dấu, đa từ rời rạc, mã viết liền và theo tên danh mục', async () => {
    // 1. Tìm đa từ không dấu rời rạc: "ao polo do l"
    const res1 = await request(app)
      .get('/api/v1/products?search=' + encodeURIComponent('ao polo do l'))
      .set('x-user-id', 'admin');
    expect(res1.status).toBe(200);
    expect(res1.body.data.length).toBe(1);
    expect(res1.body.data[0]._id).toBe(poloRedId);

    // 2. Tìm mã phụ viết liền + màu không dấu: "kmap262510 xanh"
    const res2 = await request(app)
      .get('/api/v1/products?search=' + encodeURIComponent('kmap262510 xanh'))
      .set('x-user-id', 'admin');
    expect(res2.status).toBe(200);
    expect(res2.body.data.length).toBe(1);
    expect(res2.body.data[0].code).toContain('XANH_DEN');

    // 3. Tìm theo tên danh mục không dấu + size: "giay chay bo 42"
    const res3 = await request(app)
      .get('/api/v1/products?search=' + encodeURIComponent('giay chay bo 42'))
      .set('x-user-id', 'admin');
    expect(res3.status).toBe(200);
    expect(res3.body.data.length).toBe(1);
    expect(res3.body.data[0].code).toContain('GCL88');
  });

  it('API GET /customers, /customers/lookup & /orders: Tìm khách không dấu, SĐT +84 và mã đơn viết liền', async () => {
    // 1. Tìm khách hàng bằng tên không dấu rời rạc: "nguyen phuc"
    const custRes = await request(app)
      .get('/api/v1/customers?search=' + encodeURIComponent('nguyen phuc'))
      .set('x-user-id', 'sales1');
    expect(custRes.status).toBe(200);
    expect(custRes.body.data.length).toBe(1);
    expect(custRes.body.data[0].phone).toBe('0945123456');

    // 2. Tra cứu SĐT với định dạng +84 có khoảng trắng: "+84 945 123 456"
    const lookupRes = await request(app)
      .get('/api/v1/customers/lookup?phone=' + encodeURIComponent('+84 945 123 456'))
      .set('x-user-id', 'sales1');
    expect(lookupRes.status).toBe(200);
    expect(lookupRes.body.data.found).toBe(true);
    expect(lookupRes.body.data.orders.length).toBe(1);

    // 3. Tìm đơn hàng bằng mã viết liền "hd0001" (khớp "HD-0001") hoặc sản phẩm trong đơn "polo do"
    const ordByCompactCode = await request(app)
      .get('/api/v1/orders?search=' + encodeURIComponent('hd0001'))
      .set('x-user-id', 'admin');
    expect(ordByCompactCode.status).toBe(200);
    expect(ordByCompactCode.body.data.length).toBe(1);
    expect(ordByCompactCode.body.data[0].orderCode).toBe('HD-0001');

    const ordByItem = await request(app)
      .get('/api/v1/orders?search=' + encodeURIComponent('dang phuc polo do'))
      .set('x-user-id', 'admin');
    expect(ordByItem.status).toBe(200);
    expect(ordByItem.body.data.length).toBe(1);
  });
});
