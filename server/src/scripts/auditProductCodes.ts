/**
 * AUDIT (CHỈ ĐỌC) toàn bộ dữ liệu liên quan Mã sản phẩm.
 *   MONGODB_URI=mongodb://127.0.0.1:27017/11sportDB npx ts-node --transpile-only src/scripts/auditProductCodes.ts [out.json]
 * Không ghi gì vào DB.
 */
import fs from 'fs';
import { MongoClient } from 'mongodb';
import {
  generateVariantProductCode,
  isStandardSixDigitProductCode,
  normalizeToCompactUpperCode,
  resolveBrandInfo,
  resolveCategoryInitial,
} from '../utils/productCode';

type Issue = { type: string; [k: string]: any };

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/11sportDB';
  const out = process.argv[2];
  const client = await MongoClient.connect(uri);
  const db = client.db();
  const issues: Issue[] = [];
  const add = (type: string, data: Record<string, any>) => issues.push({ type, ...data });

  const [categories, products, orders, returns, movements, receipts, promotions] = await Promise.all(
    ['categories', 'products', 'orders', 'returnexchanges', 'stockmovements', 'importreceipts', 'promotions'].map(
      (c) => db.collection(c).find({}).toArray()
    )
  );

  const catById = new Map(categories.map((c: any) => [String(c._id), c]));
  const prodById = new Map(products.map((p: any) => [String(p._id), p]));
  const prodByCode = new Map<string, any[]>();
  const prodBySuffix = new Map<string, any[]>();
  const variantCodeOwners = new Map<string, string[]>();

  // ========== 1. PRODUCTS ==========
  for (const p of products as any[]) {
    const id = String(p._id);
    const code = String(p.code || '');
    prodByCode.set(code, [...(prodByCode.get(code) || []), p]);
    const suffix = code.match(/(\d{6})$/)?.[1];
    if (suffix) prodBySuffix.set(suffix, [...(prodBySuffix.get(suffix) || []), p]);

    if (!isStandardSixDigitProductCode(code)) add('PRODUCT_CODE_NON_STANDARD', { id, code, name: p.name });
    if (code !== normalizeToCompactUpperCode(code)) add('PRODUCT_CODE_NOT_UPPER_COMPACT', { id, code, name: p.name });
    if ((p.barcode || code) !== code) add('PRODUCT_BARCODE_NE_CODE', { id, code, barcode: p.barcode, name: p.name });

    const cat = catById.get(String(p.categoryId));
    if (!cat) add('PRODUCT_CATEGORY_MISSING', { id, code, name: p.name, categoryId: p.categoryId });
    else if (cat.code !== p.categoryCode || cat.name !== p.categoryName)
      add('PRODUCT_CATEGORY_DENORM_STALE', { id, code, name: p.name, stored: `${p.categoryCode}/${p.categoryName}`, actual: `${cat.code}/${cat.name}` });

    // Tiền tố mong đợi: [chữ cái Cate][Hãng|NN]
    if (isStandardSixDigitProductCode(code)) {
      const initial = resolveCategoryInitial(p.name, cat?.code || p.categoryCode, cat?.name || p.categoryName);
      const brand = resolveBrandInfo(p.name, p.brand).brandCode;
      const expectedPrefix = `${initial}${brand}`;
      const actualPrefix = code.slice(0, -6);
      if (actualPrefix !== expectedPrefix)
        add('PRODUCT_CODE_PREFIX_MISMATCH', { id, code, name: p.name, brand: p.brand || '', category: cat?.name, expectedPrefix, actualPrefix });
    }

    // Variants
    const variants: any[] = Array.isArray(p.variants) ? p.variants : [];
    const keys = new Set<string>();
    let sumV = 0, sumF1 = 0, sumF2 = 0;
    for (const v of variants) {
      const hasAttr = Boolean(String(v.color || '').trim() || String(v.size || '').trim());
      const expected = hasAttr ? generateVariantProductCode(code, v.color, v.size) : code;
      if (hasAttr && v.variantCode !== expected)
        add('VARIANT_CODE_MISMATCH', { id, code, name: p.name, color: v.color, size: v.size, stored: v.variantCode, expected });
      if (hasAttr && (v.barcode || v.variantCode) !== v.variantCode)
        add('VARIANT_BARCODE_NE_VARIANTCODE', { id, code, color: v.color, size: v.size, variantCode: v.variantCode, barcode: v.barcode });
      if (v.variantCode && !String(v.variantCode).startsWith(code))
        add('VARIANT_CODE_NOT_PREFIXED_BY_PRODUCT', { id, code, variantCode: v.variantCode });
      const k = `${normalizeToCompactUpperCode(v.color || '')}|${normalizeToCompactUpperCode(v.size || '')}`;
      if (keys.has(k)) add('VARIANT_DUPLICATE_COLOR_SIZE', { id, code, name: p.name, color: v.color, size: v.size });
      keys.add(k);
      if (v.variantCode) variantCodeOwners.set(v.variantCode, [...(variantCodeOwners.get(v.variantCode) || []), id]);
      sumV += Number(v.stock) || 0; sumF1 += Number(v.stockFloor1) || 0; sumF2 += Number(v.stockFloor2) || 0;
      if ((Number(v.stockFloor1) || 0) + (Number(v.stockFloor2) || 0) !== (Number(v.stock) || 0))
        add('VARIANT_FLOOR_SUM_NE_STOCK', { id, code, color: v.color, size: v.size, f1: v.stockFloor1, f2: v.stockFloor2, stock: v.stock });
    }
    if (variants.length > 0 && (sumV !== (Number(p.stock) || 0) || sumF1 !== (Number(p.stockFloor1) || 0) || sumF2 !== (Number(p.stockFloor2) || 0)))
      add('PRODUCT_STOCK_NE_SUM_VARIANTS', { id, code, name: p.name, stock: p.stock, sumVariants: sumV, f1: p.stockFloor1, sumF1, f2: p.stockFloor2, sumF2 });
    if (p.stockFloor1 !== undefined && (Number(p.stockFloor1) || 0) + (Number(p.stockFloor2) || 0) !== (Number(p.stock) || 0))
      add('PRODUCT_FLOOR_SUM_NE_STOCK', { id, code, name: p.name, f1: p.stockFloor1, f2: p.stockFloor2, stock: p.stock });
    if (p.parentSetProductId && !prodById.has(String(p.parentSetProductId)))
      add('PRODUCT_PARENT_SET_MISSING', { id, code, name: p.name, parentSetProductId: p.parentSetProductId });
  }
  for (const [code, list] of prodByCode) if (list.length > 1) add('PRODUCT_CODE_DUPLICATE', { code, ids: list.map((p) => String(p._id)) });
  for (const [suf, list] of prodBySuffix) if (list.length > 1)
    add('PRODUCT_6DIGIT_SUFFIX_SHARED', { suffix: suf, products: list.map((p) => `${p.code} | ${p.name}`) });
  for (const [vc, owners] of variantCodeOwners) if (owners.length > 1) add('VARIANT_CODE_DUPLICATE', { variantCode: vc, owners });
  // Mã con trùng mã gốc của sản phẩm khác
  for (const [vc, owners] of variantCodeOwners) {
    const clash = prodByCode.get(vc);
    if (clash && clash.some((p) => !owners.includes(String(p._id)))) add('VARIANT_CODE_CLASH_PRODUCT_CODE', { variantCode: vc, owners, clashWith: clash.map((p) => String(p._id)) });
  }

  // ========== 2. LINE ITEMS trong chứng từ ==========
  function checkLine(collection: string, docCode: string, it: any, extra: Record<string, any> = {}) {
    const p = prodById.get(String(it.productId || ''));
    const base = { collection, doc: docCode, productId: it.productId, productCode: it.productCode, productName: it.productName, color: it.color || '', size: it.size || '', ...extra };
    if (!p) {
      const byCode = prodByCode.get(String(it.productCode || ''))?.[0];
      add(byCode ? 'LINE_ORPHAN_ID_BUT_CODE_EXISTS' : 'LINE_ORPHAN_PRODUCT', { ...base, codeMatches: byCode ? `${byCode.code} | ${byCode.name}` : null });
      return;
    }
    if (it.productCode !== p.code) add('LINE_CODE_OUTDATED', { ...base, currentCode: p.code, currentName: p.name });
    const hasAttr = Boolean(String(it.color || '').trim() || String(it.size || '').trim());
    if (hasAttr) {
      const vs: any[] = Array.isArray(p.variants) ? p.variants : [];
      const found = vs.find(
        (v) => normalizeToCompactUpperCode(v.color || '') === normalizeToCompactUpperCode(it.color || '') &&
          normalizeToCompactUpperCode(v.size || '') === normalizeToCompactUpperCode(it.size || '')
      );
      if (!found) add('LINE_VARIANT_NOT_IN_PRODUCT', { ...base, currentCode: p.code, availableVariants: vs.map((v) => `${v.color}/${v.size}`).join(', ') });
    }
  }

  for (const o of orders as any[]) for (const it of o.items || []) checkLine('orders', o.orderCode, it, { status: o.status });
  for (const r of returns as any[]) {
    for (const it of r.returnItems || []) checkLine('returnexchanges.returnItems', r.code, it);
    for (const it of r.exchangeItems || []) checkLine('returnexchanges.exchangeItems', r.code, it);
  }
  for (const m of movements as any[]) checkLine('stockmovements', `${m.referenceCode}#${m.type}`, m);
  for (const rc of receipts as any[]) {
    for (const it of rc.items || []) {
      const p = prodById.get(String(it.productId || ''));
      if (!it.productId) {
        add('RECEIPT_LINE_NO_PRODUCTID', { collection: 'importreceipts', doc: rc.code, status: rc.status, productCode: it.productCode, productName: it.productName });
      } else checkLine('importreceipts', rc.code, it, { status: rc.status });
      const codeBase = p ? p.code : it.productCode;
      const expectedV = generateVariantProductCode(codeBase, it.color, it.size);
      if ((it.variantCode || '') !== expectedV || (it.barcode || '') !== expectedV)
        add('RECEIPT_VARIANT_BARCODE_MISMATCH', { doc: rc.code, productCode: it.productCode, color: it.color, size: it.size, variantCode: it.variantCode, barcode: it.barcode, expected: expectedV });
    }
  }
  for (const pr of promotions as any[]) {
    for (const it of pr.conditionProducts || []) checkLine('promotions.conditionProducts', pr.code, it);
    for (const it of pr.giftItems || []) checkLine('promotions.giftItems', pr.code, it);
    for (const pid of pr.conditionProductIds || []) if (!prodById.has(String(pid))) add('PROMO_CONDITION_ID_MISSING', { doc: pr.code, productId: pid });
  }

  // ========== 3. Đối soát tồn kho vs thẻ kho ==========
  const movByProd = new Map<string, any[]>();
  for (const m of movements as any[]) movByProd.set(String(m.productId), [...(movByProd.get(String(m.productId)) || []), m]);
  for (const p of products as any[]) {
    const ms = (movByProd.get(String(p._id)) || []).sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
    if (ms.length === 0) continue;
    const sum = ms.reduce((s, m) => s + (Number(m.quantityChange) || 0), 0);
    const last = ms[ms.length - 1];
    if (sum !== (Number(p.stock) || 0))
      add('STOCK_NE_SUM_MOVEMENTS', { code: p.code, name: p.name, stock: p.stock, sumMovements: sum, lastBalanceAfter: last.balanceAfter, movements: ms.length });
  }

  // ========== Tổng hợp ==========
  const summary: Record<string, number> = {};
  for (const i of issues) summary[i.type] = (summary[i.type] || 0) + 1;
  const counts = { categories: categories.length, products: products.length, orders: orders.length, returnexchanges: returns.length, stockmovements: movements.length, importreceipts: receipts.length, promotions: promotions.length };
  console.log('DB:', uri.replace(/\/\/([^:@/]+):([^@/]+)@/, '//$1:***@'));
  console.log('Counts:', counts);
  console.table(Object.entries(summary).sort((a, b) => b[1] - a[1]).map(([type, count]) => ({ type, count })));
  if (out) fs.writeFileSync(out, JSON.stringify({ counts, summary, issues }, null, 2));
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
