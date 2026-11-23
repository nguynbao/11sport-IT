import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { connectDatabase, clearDatabase, disconnectDatabase } from '../src/config/db';
import { seedDatabaseIfNeeded } from '../src/config/seed';
import {
  suggestBrandCode,
  suggestColorCode,
  suggestVersionCode,
  buildRootCode,
  buildVariantSku,
  toCompactBarcode128,
} from '../src/utils/productCode';

const app = createApp();

/**
 * v5.0 — Chuẩn hoá mã sản phẩm CATEGORY + BRAND + VERSION + MÀU + SIZE
 * docs/requirements/ma-san-pham-brand-version-v1.md (AC1–AC4)
 */
describe('v5.0 Mã sản phẩm Cate + Brand + Version (AC1–AC4)', () => {
  let giayId = '';
  let votId = '';
  let asicsId = '';
  let nnId = '';
  let productId = '';

  beforeAll(async () => {
    process.env.FORCE_MEMORY_DB = 'true';
    await connectDatabase();
    await clearDatabase();
    await seedDatabaseIfNeeded();
    const g = await request(app).post('/api/v1/categories').send({ code: 'GIAY', name: 'Giày', skuCode: 'G' });
    expect(g.status).toBe(201);
    expect(g.body.data.skuCode).toBe('G');
    giayId = g.body.data._id;
    const v = await request(app).post('/api/v1/categories').send({ code: 'VOT', name: 'Vợt' });
    expect(v.body.data.skuCode).toBe('V');
    votId = v.body.data._id;
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it('Gợi ý mã ngắn: Asics -> ASC, Solution Speed FF4 -> SSFF4, Đỏ -> DO, Xanh Dương -> XD', () => {
    expect(suggestBrandCode('Asics')).toBe('ASC');
    expect(suggestBrandCode('Wika')).toBe('WIKA');
    expect(suggestBrandCode('Kamito')).toBe('KMT');
    expect(suggestVersionCode('Solution Speed FF4')).toBe('SSFF4');
    expect(suggestVersionCode('Fusion')).toBe('FUSION');
    expect(suggestVersionCode('Pickleball ACE')).not.toBe(suggestVersionCode('Pickleball Alpha'));
    expect(suggestColorCode('Đỏ')).toBe('DO');
    expect(suggestColorCode('Xanh Dương')).toBe('XD');
    expect(suggestColorCode('Đỏ', new Set(['DO']))).not.toBe('DO');
    expect(buildRootCode('G', 'ASC', 'SSFF4')).toBe('GASCSSFF4');
    expect(buildVariantSku('GASCSSFF4', 'DO', '40')).toBe('GASCSSFF4DO40');
    expect(buildVariantSku('GASCSSFF4', '', '')).toBe('GASCSSFF4');
    // Mã mới không bị cắt khi chuẩn hoá in tem Code128
    expect(toCompactBarcode128('TKMTTTTUV1DEN3XL')).toBe('TKMTTTTUV1DEN3XL');
  });

  it('AC1: CRUD Brand, lọc theo Category (kèm NN), không xoá được Brand có sản phẩm', async () => {
    const forbidden = await request(app)
      .post('/api/v1/brands')
      .set('x-user-id', 'sales1')
      .send({ name: 'Asics', categoryIds: [giayId] });
    expect(forbidden.status).toBe(403);

    const missingCat = await request(app).post('/api/v1/brands').send({ name: 'Asics', categoryIds: [] });
    expect(missingCat.status).toBe(400);

    const created = await request(app)
      .post('/api/v1/brands')
      .send({ name: 'Asics', code: 'ASC', categoryIds: [giayId], aliases: ['Asic'] });
    expect(created.status).toBe(201);
    expect(created.body.data.code).toBe('ASC');
    asicsId = created.body.data._id;

    const dupCode = await request(app).post('/api/v1/brands').send({ name: 'Asia', code: 'ASC', categoryIds: [giayId] });
    expect(dupCode.status).toBe(400);
    expect(dupCode.body.code).toBe('DUPLICATE_BRAND_CODE');

    const badCode = await request(app).post('/api/v1/brands').send({ name: 'X', code: 'TOOLONG', categoryIds: [giayId] });
    expect(badCode.body.code).toBe('INVALID_BRAND_CODE');

    const temp = await request(app).post('/api/v1/brands').send({ name: 'Joola', categoryIds: [votId] });
    expect(temp.status).toBe(201);
    expect(temp.body.data.code).toBe('JL');

    const byGiay = await request(app).get(`/api/v1/brands?categoryId=${giayId}`);
    const giayCodes = byGiay.body.data.map((b: any) => b.code);
    expect(giayCodes).toContain('ASC');
    expect(giayCodes).toContain('NN');
    expect(giayCodes).not.toContain('JL');
    nnId = byGiay.body.data.find((b: any) => b.code === 'NN')._id;

    const byVot = await request(app).get(`/api/v1/brands?categoryId=${votId}`);
    expect(byVot.body.data.map((b: any) => b.code)).toEqual(expect.arrayContaining(['JL', 'NN']));
    expect(byVot.body.data.map((b: any) => b.code)).not.toContain('ASC');

    const renamed = await request(app).patch(`/api/v1/brands/${temp.body.data._id}`).send({ name: 'JOOLA' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.data.name).toBe('JOOLA');

    const delNn = await request(app).delete(`/api/v1/brands/${nnId}`);
    expect(delNn.body.code).toBe('BRAND_SYSTEM_LOCKED');

    const delTemp = await request(app).delete(`/api/v1/brands/${temp.body.data._id}`);
    expect(delTemp.status).toBe(200);
  });

  it('AC2: Giày / Asics / "Solution Speed FF4" (SSFF4) + Đỏ/40 -> GASCSSFF4, GASCSSFF4DO40', async () => {
    const notInCat = await request(app)
      .post('/api/v1/products/preview-code')
      .send({ categoryId: votId, brandId: asicsId, versionName: 'Solution Speed FF4' });
    expect(notInCat.status).toBe(400);
    expect(notInCat.body.code).toBe('BRAND_NOT_IN_CATEGORY');

    const preview = await request(app)
      .post('/api/v1/products/preview-code')
      .send({
        categoryId: giayId,
        brandId: asicsId,
        versionName: 'Solution Speed FF4',
        variants: [{ color: 'Đỏ', size: '40' }],
      });
    expect(preview.status).toBe(200);
    expect(preview.body.data.code).toBe('GASCSSFF4');
    expect(preview.body.data.suggestedVersionCode).toBe('SSFF4');
    expect(preview.body.data.variants[0].variantCode).toBe('GASCSSFF4DO40');
    expect(preview.body.data.duplicate).toBeNull();

    const res = await request(app)
      .post('/api/v1/products')
      .send({
        categoryId: giayId,
        brandId: asicsId,
        versionName: 'Solution Speed FF4',
        versionCode: 'SSFF4',
        unit: 'Đôi',
        sellingPrice: 1300000,
        costPrice: 900000,
        variants: [
          { color: 'Đỏ', size: '40', sellingPrice: 1200000, stockFloor1: 5 },
          { color: 'Xanh', size: '40', sellingPrice: 1350000, stockFloor1: 4 },
          { color: 'Trắng', size: '41', stockFloor1: 3 },
        ],
      });
    expect(res.status).toBe(201);
    productId = res.body.data._id;
    expect(res.body.data.code).toBe('GASCSSFF4');
    expect(res.body.data.brandCode).toBe('ASC');
    expect(res.body.data.brandName).toBe('Asics');
    expect(res.body.data.brand).toBe('Asics');
    expect(res.body.data.versionCode).toBe('SSFF4');
    expect(res.body.data.name).toBe('Asics Solution Speed FF4');
    const red = res.body.data.variants.find((v: any) => v.color === 'Đỏ');
    expect(red.variantCode).toBe('GASCSSFF4DO40');
    expect(red.barcode).toBe('GASCSSFF4DO40');
    expect(red.colorCode).toBe('DO');
    expect(res.body.data.stock).toBe(12);

    // GET /products (có chạy auto-migrate mã cũ) KHÔNG được ép mã mới về mã cũ
    const list = await request(app).get('/api/v1/products');
    const fetched = list.body.data.find((p: any) => p._id === productId);
    expect(fetched.code).toBe('GASCSSFF4');
    expect(fetched.variants.find((v: any) => v.color === 'Đỏ').variantCode).toBe('GASCSSFF4DO40');
    expect(fetched.variants.find((v: any) => v.color === 'Trắng').effectiveSellingPrice).toBe(1300000);

    // Brand đã có sản phẩm -> không xoá được (R11), không đổi được mã
    const del = await request(app).delete(`/api/v1/brands/${asicsId}`);
    expect(del.status).toBe(409);
    expect(del.body.code).toBe('BRAND_HAS_PRODUCTS');
    const changeCode = await request(app).patch(`/api/v1/brands/${asicsId}`).send({ code: 'ASI' });
    expect(changeCode.body.code).toBe('BRAND_CODE_IMMUTABLE');
    const changeSku = await request(app).patch(`/api/v1/categories/${giayId}`).send({ skuCode: 'GI' });
    expect(changeSku.body.code).toBe('CATEGORY_SKU_CODE_IMMUTABLE');
  });

  it('AC3: Tạo lại cùng Category + Brand + Version -> PRODUCT_DUPLICATE, không sinh mã cũ', async () => {
    const before = (await request(app).get('/api/v1/products')).body.data.length;
    const dup = await request(app)
      .post('/api/v1/products')
      .send({
        categoryId: giayId,
        brandId: asicsId,
        versionName: 'Solution Speed FF4 (bản mới)',
        versionCode: 'SSFF4',
        variants: [{ color: 'Đen', size: '42' }],
      });
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe('PRODUCT_DUPLICATE');
    expect(dup.body.fields.existingProductId).toBe(productId);
    expect(dup.body.fields.existingProductCode).toBe('GASCSSFF4');

    const preview = await request(app)
      .post('/api/v1/products/preview-code')
      .send({ categoryId: giayId, brandId: asicsId, versionName: 'Solution Speed FF4' });
    expect(preview.body.data.duplicate._id).toBe(productId);

    const after = (await request(app).get('/api/v1/products')).body.data;
    expect(after.length).toBe(before);
    expect(after.some((p: any) => /^GASICS\d{6}$/.test(p.code) || /^G[A-Z]+\d{6}$/.test(p.code))).toBe(false);

    // Mã Version toàn số tạo ra định dạng mã cũ -> từ chối
    const legacyLike = await request(app)
      .post('/api/v1/products')
      .send({ categoryId: giayId, brandId: nnId, versionName: '123456', versionCode: '123456' });
    expect(legacyLike.body.code).toBe('INVALID_VERSION_CODE');

    // Luồng cũ (không brandId) trùng mã: không tự gộp nữa khi không gửi upsertIfExists
    const legacy1 = await request(app)
      .post('/api/v1/products')
      .send({ name: 'Giày Test Legacy 778899', categoryId: giayId, color: 'Đỏ', size: '40' });
    expect(legacy1.status).toBe(201);
    const legacy2 = await request(app)
      .post('/api/v1/products')
      .send({ name: 'Giày Test Legacy 778899', categoryId: giayId, color: 'Xanh', size: '41' });
    expect(legacy2.status).toBe(409);
    expect(legacy2.body.code).toBe('PRODUCT_DUPLICATE');
  });

  it('CODE_CONFLICT: mã con mới trùng mã đã có của sản phẩm khác', async () => {
    // Sản phẩm A: GNNABC + màu "DO" size "40" => GNNABCDO40
    const a = await request(app)
      .post('/api/v1/products')
      .send({ categoryId: giayId, brandId: nnId, versionName: 'ABC', versionCode: 'ABC', variants: [{ color: 'Đỏ', size: '40' }] });
    expect(a.status).toBe(201);
    expect(a.body.data.variants[0].variantCode).toBe('GNNABCDO40');
    // Sản phẩm B: version ABCDO + size 40 (không màu) => GNNABCDO40 trùng
    const b = await request(app)
      .post('/api/v1/products')
      .send({ categoryId: giayId, brandId: nnId, versionName: 'ABC DO', versionCode: 'ABCDO', variants: [{ color: '', size: '40' }] });
    expect(b.status).toBe(409);
    expect(b.body.code).toBe('CODE_CONFLICT');
    expect(b.body.fields.code).toBe('GNNABCDO40');
  });

  it('AC4: Giá theo biến thể — POS quét từng mã ra đúng giá, biến thể không có giá dùng giá gốc', async () => {
    const red = await request(app).get('/api/v1/products/lookup?code=GASCSSFF4DO40');
    expect(red.status).toBe(200);
    expect(red.body.data.matchedBy).toBe('VARIANT_CODE');
    expect(red.body.data.sellingPrice).toBe(1200000);
    const blue = await request(app).get('/api/v1/products/lookup?code=gascssff4xa40');
    expect(blue.body.data.sellingPrice).toBe(1350000);
    const white = await request(app).get('/api/v1/products/lookup?code=GASCSSFF4TR41');
    expect(white.body.data.sellingPrice).toBe(1300000);
    const sales = await request(app).get('/api/v1/products/lookup?code=GASCSSFF4DO40').set('x-user-id', 'sales1');
    expect(sales.body.data.product.costPrice).toBeUndefined();
    const nf = await request(app).get('/api/v1/products/lookup?code=KHONGCO123');
    expect(nf.status).toBe(404);

    const order = await request(app)
      .post('/api/v1/orders')
      .send({
        customerName: 'Khách AC4',
        customerPhone: '0900111222',
        paymentMethod: 'CASH',
        items: [
          { productId, color: 'Đỏ', size: '40', quantity: 1 },
          { productId, color: 'Xanh', size: '40', quantity: 1 },
          { productId, color: 'Trắng', size: '41', quantity: 1 },
        ],
      });
    expect(order.status).toBe(201);
    const prices = order.body.data.items.map((it: any) => it.originalUnitPrice);
    expect(prices).toEqual([1200000, 1350000, 1300000]);
    expect(order.body.data.subtotal).toBe(1200000 + 1350000 + 1300000);
    expect(order.body.data.items[0].unitCost).toBe(900000);

    // Sửa giá biến thể (không chạm tồn kho) & thêm biến thể mới
    const patch = await request(app)
      .patch(`/api/v1/products/${productId}`)
      .send({ variantPrices: [{ variantCode: 'GASCSSFF4TR41', sellingPrice: 1250000, costPrice: 800000 }] });
    expect(patch.status).toBe(200);
    const white2 = await request(app).get('/api/v1/products/lookup?code=GASCSSFF4TR41');
    expect(white2.body.data.sellingPrice).toBe(1250000);

    const addVar = await request(app)
      .post(`/api/v1/products/${productId}/variants`)
      .send({ variants: [{ color: 'Đỏ', size: '41', sellingPrice: 1210000 }] });
    expect(addVar.status).toBe(200);
    const red41 = addVar.body.data.variants.find((v: any) => v.color === 'Đỏ' && v.size === '41');
    expect(red41.variantCode).toBe('GASCSSFF4DO41');
    expect(red41.colorCode).toBe('DO');
    const addDup = await request(app)
      .post(`/api/v1/products/${productId}/variants`)
      .send({ variants: [{ color: 'Đỏ', size: '41' }] });
    expect(addDup.body.code).toBe('DUPLICATE_VARIANT');
    const badColor = await request(app)
      .post(`/api/v1/products/${productId}/variants`)
      .send({ variants: [{ color: 'Tím', colorCode: 'DO', size: '42' }] });
    expect(badColor.body.code).toBe('COLOR_CODE_DUPLICATE');

    // Brand/Version nằm trong mã -> không sửa được
    const immut = await request(app).patch(`/api/v1/products/${productId}`).send({ versionCode: 'NEW1' });
    expect(immut.body.code).toBe('PRODUCT_CODE_IMMUTABLE');
  });

  it('Nhập kho: dòng mã mới giữ đúng sản phẩm (không sinh lại mã cũ) và cập nhật giá vốn biến thể', async () => {
    const imp = await request(app)
      .post('/api/v1/imports')
      .send({
        defaultCategoryId: giayId,
        items: [
          {
            productCode: 'GASCSSFF4',
            productName: 'Asics Solution Speed FF4',
            color: 'Đỏ',
            size: '40',
            unit: 'Đôi',
            expectedQuantity: 2,
            actualQuantity: 2,
            costPrice: 950000,
            isConfirmed: true,
          },
          {
            productName: 'Giày Asics Gel Rocket 11',
            brand: 'Asics',
            color: 'Đen',
            size: '42',
            unit: 'Đôi',
            expectedQuantity: 1,
            actualQuantity: 1,
            costPrice: 700000,
            isConfirmed: true,
          },
        ],
      });
    expect(imp.status).toBe(201);
    expect(imp.body.data.items[0].productId).toBe(productId);
    expect(imp.body.data.items[0].variantCode).toBe('GASCSSFF4DO40');
    expect(imp.body.data.items[1].productCode).toMatch(/^GASC/);
    expect(imp.body.data.items[1].productCode).not.toMatch(/\d{6}$/);

    const done = await request(app).post(`/api/v1/imports/${imp.body.data._id}/complete`).send({});
    expect(done.status).toBe(200);
    const red = await request(app).get('/api/v1/products/lookup?code=GASCSSFF4DO40');
    expect(red.body.data.variant.costPrice).toBe(950000);
    expect(red.body.data.variant.stockFloor1).toBe(5 - 1 + 2);
    const newCode = done.body.data.receipt.items[1].productCode;
    const created = await request(app).get(`/api/v1/products/lookup?code=${newCode}`);
    expect(created.status).toBe(200);
    expect(created.body.data.product.brandCode).toBe('ASC');
    expect(created.body.data.product.versionCode).toBeTruthy();
    expect(done.body.data.receipt.items[1].variantCode).toBe(created.body.data.product.variants[0].variantCode);
  });

  it('Bổ sung 1: Dòng nhập kho truyền brandId + versionName/versionCode + colorCode (kiểm tra BRAND_NOT_IN_CATEGORY, CODE_CONFLICT, gộp trùng bộ R4)', async () => {
    // 1.1 BRAND_NOT_IN_CATEGORY khi brand không thuộc category của dòng nhập
    const badBrandCat = await request(app)
      .post('/api/v1/imports')
      .send({
        defaultCategoryId: votId,
        items: [
          {
            categoryId: votId,
            brandId: asicsId,
            versionName: 'Court FF3',
            versionCode: 'CFF3',
            productName: 'Asics Court FF3',
            color: 'Trắng',
            colorCode: 'TR',
            size: '42',
            expectedQuantity: 2,
          },
        ],
      });
    expect(badBrandCat.status).toBe(400);
    expect(badBrandCat.body.code).toBe('BRAND_NOT_IN_CATEGORY');

    // 1.2 CODE_CONFLICT khi mã con sinh ra trùng với sản phẩm khác đã có (GNNABCDO40)
    const conflictImp = await request(app)
      .post('/api/v1/imports')
      .send({
        defaultCategoryId: giayId,
        items: [
          {
            categoryId: giayId,
            brandId: nnId,
            versionName: 'ABC DO',
            versionCode: 'ABCDO',
            productName: 'Giày ABC DO',
            color: '',
            size: '40',
            expectedQuantity: 1,
          },
        ],
      });
    expect(conflictImp.status).toBe(409);
    expect(conflictImp.body.code).toBe('CODE_CONFLICT');

    // 1.3 Sản phẩm mới truyền brandId + versionName + versionCode + colorCode & sản phẩm trùng (categoryId, brandId, versionCode)
    const imp = await request(app)
      .post('/api/v1/imports')
      .send({
        defaultCategoryId: giayId,
        items: [
          {
            categoryId: giayId,
            brandId: asicsId,
            versionName: 'Court FF3',
            versionCode: 'CFF3',
            productName: 'Tên tuỳ ý không dùng để đoán mã',
            color: 'Xanh Ngọc',
            colorCode: 'XN',
            size: '42',
            unit: 'Đôi',
            expectedQuantity: 3,
            actualQuantity: 3,
            costPrice: 1100000,
            sellingPrice: 1650000,
            isConfirmed: true,
          },
          {
            categoryId: giayId,
            brandId: asicsId,
            versionName: 'Solution Speed FF4',
            versionCode: 'SSFF4',
            productName: 'Asics Solution Speed FF4 thêm màu Cam',
            color: 'Cam',
            colorCode: 'CA',
            size: '42',
            unit: 'Đôi',
            expectedQuantity: 2,
            actualQuantity: 2,
            costPrice: 920000,
            isConfirmed: true,
          },
        ],
      });
    expect(imp.status).toBe(201);
    // Dòng 1: sản phẩm chưa có -> sinh đúng mã GASCCFF3 / GASCCFF3XN42 từ các trường truyền vào
    expect(imp.body.data.items[0].productId).toBe('');
    expect(imp.body.data.items[0].productCode).toBe('GASCCFF3');
    expect(imp.body.data.items[0].variantCode).toBe('GASCCFF3XN42');
    expect(imp.body.data.items[0].brandId).toBe(asicsId);
    expect(imp.body.data.items[0].versionCode).toBe('CFF3');
    expect(imp.body.data.items[0].colorCode).toBe('XN');
    // Dòng 2: trùng (categoryId, brandId, versionCode) với GASCSSFF4 đã có -> tự gắn vào productId
    expect(imp.body.data.items[1].productId).toBe(productId);
    expect(imp.body.data.items[1].productCode).toBe('GASCSSFF4');
    expect(imp.body.data.items[1].variantCode).toBe('GASCSSFF4CA42');

    const completed = await request(app).post(`/api/v1/imports/${imp.body.data._id}/complete`).send({});
    expect(completed.status).toBe(200);

    const cff3 = await request(app).get('/api/v1/products/lookup?code=GASCCFF3XN42');
    expect(cff3.status).toBe(200);
    expect(cff3.body.data.product.code).toBe('GASCCFF3');
    expect(cff3.body.data.product.versionCode).toBe('CFF3');
    expect(cff3.body.data.variant.stockFloor1).toBe(3);

    const ssff4Cam = await request(app).get('/api/v1/products/lookup?code=GASCSSFF4CA42');
    expect(ssff4Cam.status).toBe(200);
    expect(ssff4Cam.body.data.product._id).toBe(productId);
    expect(ssff4Cam.body.data.variant.stockFloor1).toBe(2);
    expect(ssff4Cam.body.data.variant.costPrice).toBe(920000);
  });

  it('Bổ sung 2: POST /api/v1/products có upsertIfExists trên sản phẩm mã mới -> sinh variantCode theo scheme mới', async () => {
    const up1 = await request(app)
      .post('/api/v1/products')
      .send({
        code: 'GASCSSFF4',
        name: 'Asics Solution Speed FF4',
        categoryId: giayId,
        color: 'Vàng Chanh',
        size: '42',
        quantity: 2,
        targetWarehouse: 'FLOOR_1',
        upsertIfExists: true,
      });
    expect(up1.status).toBe(200);
    expect(up1.body.meta.upserted).toBe(true);
    const vangVar = up1.body.data.variants.find((v: any) => v.color === 'Vàng Chanh' && v.size === '42');
    expect(vangVar).toBeTruthy();
    // Theo scheme mới: GASCSSFF4 + VC + 42 = GASCSSFF4VC42 (không phải GASCSSFF4VANGCHANH42)
    expect(vangVar.variantCode).toBe('GASCSSFF4VC42');
    expect(vangVar.colorCode).toBe('VC');
    expect(vangVar.stockFloor1).toBe(2);

    // Gọi kèm brandId + upsertIfExists cũng dùng scheme mới
    const up2 = await request(app)
      .post('/api/v1/products')
      .send({
        categoryId: giayId,
        brandId: asicsId,
        versionName: 'Solution Speed FF4',
        versionCode: 'SSFF4',
        color: 'Xám Bạc',
        colorCode: 'XB',
        size: '43',
        quantity: 1,
        targetWarehouse: 'FLOOR_2',
        upsertIfExists: true,
      });
    expect(up2.status).toBe(200);
    const xamVar = up2.body.data.variants.find((v: any) => v.color === 'Xám Bạc' && v.size === '43');
    expect(xamVar.variantCode).toBe('GASCSSFF4XB43');
    expect(xamVar.stockFloor2).toBe(1);
  });

  it('Bổ sung 3: POST /api/v1/products/:id/variants nhận quantity/stockFloor + targetWarehouse (chỉ CEO/ADMIN khi > 0, ghi StockMovement ADJUSTMENT)', async () => {
    // ACCOUNTANT không được truyền số lượng > 0
    const accForbidden = await request(app)
      .post(`/api/v1/products/${productId}/variants`)
      .set('x-user-id', 'accountant1')
      .send({
        targetWarehouse: 'FLOOR_2',
        variants: [{ color: 'Hồng', colorCode: 'HO', size: '39', quantity: 4 }],
      });
    expect(accForbidden.status).toBe(403);
    expect(accForbidden.body.code).toBe('DIRECT_STOCK_FORBIDDEN');

    // ADMIN thêm biến thể kèm tồn kho tại FLOOR_2 -> thành công + ghi StockMovement ADJUSTMENT
    const addWithStock = await request(app)
      .post(`/api/v1/products/${productId}/variants`)
      .send({
        targetWarehouse: 'FLOOR_2',
        variants: [{ color: 'Hồng', colorCode: 'HO', size: '39', quantity: 4, sellingPrice: 1280000 }],
      });
    expect(addWithStock.status).toBe(200);
    expect(addWithStock.body.meta.addedQuantity).toBe(4);
    const hong39 = addWithStock.body.data.variants.find((v: any) => v.variantCode === 'GASCSSFF4HO39');
    expect(hong39).toBeTruthy();
    expect(hong39.stockFloor1).toBe(0);
    expect(hong39.stockFloor2).toBe(4);
    expect(hong39.stock).toBe(4);

    const movements = await request(app).get(`/api/v1/inventory/movements?productId=${productId}&type=ADJUSTMENT`);
    expect(movements.status).toBe(200);
    const adjMove = movements.body.data.find((m: any) => m.color === 'Hồng' && m.size === '39');
    expect(adjMove).toBeTruthy();
    expect(adjMove.type).toBe('ADJUSTMENT');
    expect(adjMove.referenceType).toBe('ADJUSTMENT');
    expect(adjMove.quantityChange).toBe(4);
    expect(adjMove.warehouseLocation).toBe('FLOOR_2');
  });

  it('Bổ sung 4: PATCH /api/v1/products/:id/variants sửa color/size/colorCode -> sinh lại variantCode mới, lưu mã cũ vào legacyVariantCodes & legacyVariantCode', async () => {
    // Ban đầu biến thể Hồng/39 có mã GASCSSFF4HO39
    // Lần sửa 1: đổi colorCode sang HG và size sang 39.5 -> mã mới GASCSSFF4HG395, mã cũ GASCSSFF4HO39 vào legacyVariantCode & legacyVariantCodes
    const patch1 = await request(app)
      .patch(`/api/v1/products/${productId}/variants`)
      .send({
        variants: [
          {
            variantCode: 'GASCSSFF4HO39',
            color: 'Hồng Phấn',
            colorCode: 'HP',
            size: '39.5',
          },
        ],
      });
    expect(patch1.status).toBe(200);
    const v1 = patch1.body.data.variants.find((v: any) => v.variantCode === 'GASCSSFF4HP395');
    expect(v1).toBeTruthy();
    expect(v1.barcode).toBe('GASCSSFF4HP395');
    expect(v1.legacyVariantCode).toBe('GASCSSFF4HO39');
    expect(v1.legacyVariantCodes).toContain('GASCSSFF4HO39');
    expect(v1.stockFloor2).toBe(4);

    // Lần sửa 2: đổi size sang 40 -> mã mới GASCSSFF4HP40, legacyVariantCode giữ GASCSSFF4HO39, legacyVariantCodes có cả GASCSSFF4HO39 và GASCSSFF4HP395
    const patch2 = await request(app)
      .patch(`/api/v1/products/${productId}/variants`)
      .send({
        variantCode: 'GASCSSFF4HP395',
        size: '40',
      });
    expect(patch2.status).toBe(200);
    const v2 = patch2.body.data.variants.find((v: any) => v.variantCode === 'GASCSSFF4HP40');
    expect(v2).toBeTruthy();
    expect(v2.legacyVariantCode).toBe('GASCSSFF4HO39');
    expect(v2.legacyVariantCodes).toEqual(expect.arrayContaining(['GASCSSFF4HO39', 'GASCSSFF4HP395']));

    // Quét cả 2 mã cũ và mã mới đều ra đúng biến thể
    const scanOld1 = await request(app).get('/api/v1/products/lookup?code=GASCSSFF4HO39');
    expect(scanOld1.status).toBe(200);
    expect(scanOld1.body.data.matchedBy).toBe('LEGACY_VARIANT_CODE');
    expect(scanOld1.body.data.variant.variantCode).toBe('GASCSSFF4HP40');

    const scanOld2 = await request(app).get('/api/v1/products/lookup?code=GASCSSFF4HP395');
    expect(scanOld2.status).toBe(200);
    expect(scanOld2.body.data.matchedBy).toBe('LEGACY_VARIANT_CODE');
    expect(scanOld2.body.data.variant.variantCode).toBe('GASCSSFF4HP40');

    const scanNew = await request(app).get('/api/v1/products/lookup?code=GASCSSFF4HP40');
    expect(scanNew.status).toBe(200);
    expect(scanNew.body.data.matchedBy).toBe('VARIANT_CODE');
  });
});
