import {
  staffRepo,
  categoryRepo,
  productRepo,
  importReceiptRepo,
  stockMovementRepo,
  orderRepo,
  returnExchangeRepo,
} from './db';
import { hashPassword } from '../utils/auth';
import {
  extractVariantFromText,
  generateProductCode,
  generateVariantProductCode,
  isStandardSixDigitProductCode,
  normalizeToCompactUpperCode,
} from '../utils/productCode';
import { normalizeVariants } from '../utils/warehouseFloor';

let codeMigrationPromise: Promise<void> | null = null;

/**
 * Tự động chuẩn hóa toàn bộ Mã sản phẩm hiện có trong DB sang quy tắc mới:
 * - Mã gốc (code): [Chữ cái đầu của Cate] + [Tên Hãng (không có hãng = NN)] + [6 chữ số] (VD: GASIA221401)
 * - Mã con theo thuộc tính (variantCode / barcode trên variants[] và import items): [Mã gốc][MÀU][SIZE] (VD: GASIA221401DO38)
 */
export async function ensureStandardProductCodesMigrated(): Promise<void> {
  if (codeMigrationPromise) {
    return codeMigrationPromise;
  }

  codeMigrationPromise = (async () => {
    try {
      const [categories, products, receipts] = await Promise.all([
        categoryRepo.find({}),
        productRepo.find({}),
        importReceiptRepo.find({}),
      ]);

      const catMap = new Map(categories.map((c) => [String(c._id), c]));
      const needsProductMigration = products.some(
        (p) =>
          !isStandardSixDigitProductCode(p.code) ||
          (Array.isArray(p.variants) &&
            p.variants.some(
              (v: any) =>
                !v.variantCode ||
                v.variantCode !== generateVariantProductCode(p.code, v.color, v.size)
            ))
      );
      const needsReceiptMigration = receipts.some((r) =>
        (r.items || []).some(
          (it: any) =>
            !isStandardSixDigitProductCode(it.productCode) ||
            !it.variantCode ||
            it.variantCode !== generateVariantProductCode(it.productCode, it.color, it.size)
        )
      );

      if (!needsProductMigration && !needsReceiptMigration) {
        return;
      }

      const oldToNewCode = new Map<string, string>();
      const usedCodes = new Set<string>();

      // Giữ lại các mã đã đúng chuẩn trước
      for (const p of products) {
        if (isStandardSixDigitProductCode(p.code)) {
          usedCodes.add(p.code);
        }
      }

      // 1. Chuẩn hóa bảng Products & variants[].variantCode
      for (const p of products) {
        const cat = catMap.get(String(p.categoryId));
        const extracted = extractVariantFromText(p.name, {
          categoryCode: cat?.code || p.categoryCode,
          categoryName: cat?.name || p.categoryName,
          brand: p.brand,
          existingCode: p.code,
          seedSuffix: p.unit && String(p.unit).toLowerCase() !== 'cái' ? p.unit : '',
        });

        let newCode = isStandardSixDigitProductCode(p.code)
          ? normalizeToCompactUpperCode(p.code)
          : extracted.code ||
            generateProductCode(p.name, {
              categoryCode: cat?.code || p.categoryCode,
              categoryName: cat?.name || p.categoryName,
              brand: p.brand,
            });

        // Đảm bảo không trùng 6 chữ số giữa 2 sản phẩm khác nhau
        if (usedCodes.has(newCode) && newCode !== p.code) {
          const prefix = newCode.slice(0, -6);
          let num = parseInt(newCode.slice(-6), 10) || 100000;
          while (usedCodes.has(`${prefix}${String(num).padStart(6, '0')}`)) {
            num = ((num - 100000 + 1) % 900000) + 100000;
          }
          newCode = `${prefix}${String(num).padStart(6, '0')}`;
        }

        usedCodes.add(newCode);
        if (p.code) {
          oldToNewCode.set(p.code, newCode);
          oldToNewCode.set(normalizeToCompactUpperCode(p.code), newCode);
        }

        const nextBrand = p.brand || extracted.brand || '';
        const normalizedVariants = normalizeVariants(p.variants, newCode);
        const variantsChanged =
          Array.isArray(p.variants) &&
          p.variants.some(
            (v: any, idx: number) =>
              v.variantCode !== normalizedVariants[idx]?.variantCode ||
              v.barcode !== normalizedVariants[idx]?.barcode
          );

        if (
          newCode !== p.code ||
          p.barcode !== newCode ||
          p.brand !== nextBrand ||
          variantsChanged
        ) {
          await productRepo.updateById(p._id, {
            code: newCode,
            barcode: newCode,
            brand: nextBrand,
            ...(normalizedVariants.length > 0 ? { variants: normalizedVariants } : {}),
          });
        }
      }

      // 2. Chuẩn hóa bảng ImportReceipts
      for (const rc of receipts) {
        let changed = false;
        const defaultCat = catMap.get(String(rc.defaultCategoryId)) || categories[0];
        const nextItems = (rc.items || []).map((it: any) => {
          const itemCat = catMap.get(String(it.categoryId)) || defaultCat;
          const compactOld = normalizeToCompactUpperCode(it.productCode || '');
          const mappedCode =
            oldToNewCode.get(it.productCode) ||
            oldToNewCode.get(compactOld) ||
            (isStandardSixDigitProductCode(it.productCode)
              ? compactOld
              : generateProductCode(it.productName || it.productCode, {
                  categoryCode: itemCat?.code,
                  categoryName: itemCat?.name,
                  brand: it.brand,
                  existingCode: it.productCode,
                  seedSuffix: it.unit && String(it.unit).toLowerCase() !== 'cái' ? it.unit : '',
                }));
          const extracted = extractVariantFromText(it.productName || '', {
            categoryCode: itemCat?.code,
            categoryName: itemCat?.name,
            brand: it.brand,
          });
          const nextBrand = it.brand || extracted.brand || '';
          const nextVariantCode = generateVariantProductCode(mappedCode, it.color, it.size);
          if (
            mappedCode !== it.productCode ||
            it.variantCode !== nextVariantCode ||
            it.barcode !== nextVariantCode ||
            nextBrand !== (it.brand || '')
          ) {
            changed = true;
            return {
              ...it,
              productCode: mappedCode,
              variantCode: nextVariantCode,
              barcode: nextVariantCode,
              brand: nextBrand,
            };
          }
          return it;
        });

        if (changed) {
          await importReceiptRepo.updateById(rc._id, { items: nextItems });
        }
      }

      // 3. Đồng bộ mã trong StockMovements, Orders, ReturnExchanges
      if (oldToNewCode.size > 0) {
        const movements = await stockMovementRepo.find({});
        for (const m of movements) {
          const mapped =
            oldToNewCode.get(m.productCode) ||
            oldToNewCode.get(normalizeToCompactUpperCode(m.productCode || ''));
          if (mapped && mapped !== m.productCode) {
            await stockMovementRepo.updateById(m._id, { productCode: mapped });
          }
        }

        const orders = await orderRepo.find({});
        for (const o of orders) {
          let oChanged = false;
          const nextOrderItems = (o.items || []).map((it: any) => {
            const mapped =
              oldToNewCode.get(it.productCode) ||
              oldToNewCode.get(normalizeToCompactUpperCode(it.productCode || ''));
            if (mapped && mapped !== it.productCode) {
              oChanged = true;
              return { ...it, productCode: mapped };
            }
            return it;
          });
          if (oChanged) {
            await orderRepo.updateById(o._id, { items: nextOrderItems });
          }
        }

        const returns = await returnExchangeRepo.find({});
        for (const r of returns) {
          let rChanged = false;
          const nextReturnItems = (r.returnItems || []).map((it: any) => {
            const mapped =
              oldToNewCode.get(it.productCode) ||
              oldToNewCode.get(normalizeToCompactUpperCode(it.productCode || ''));
            if (mapped && mapped !== it.productCode) {
              rChanged = true;
              return { ...it, productCode: mapped };
            }
            return it;
          });
          const nextExchangeItems = (r.exchangeItems || []).map((it: any) => {
            const mapped =
              oldToNewCode.get(it.productCode) ||
              oldToNewCode.get(normalizeToCompactUpperCode(it.productCode || ''));
            if (mapped && mapped !== it.productCode) {
              rChanged = true;
              return { ...it, productCode: mapped };
            }
            return it;
          });
          if (rChanged) {
            await returnExchangeRepo.updateById(r._id, {
              returnItems: nextReturnItems,
              exchangeItems: nextExchangeItems,
            });
          }
        }
      }
    } catch (err) {
      console.error('[Migration] Error migrating product codes:', err);
    } finally {
      codeMigrationPromise = null;
    }
  })();

  return codeMigrationPromise;
}

export async function seedDatabaseIfNeeded(): Promise<void> {
  await ensureStandardProductCodesMigrated();

  const existingStaffCount = await staffRepo.countDocuments({});
  if (existingStaffCount > 0) {
    return;
  }

  console.log('[Seed] Initializing default staff accounts (admin, warehouse1, sales1)...');

  await staffRepo.create({
    code: 'NV001',
    username: 'admin',
    passwordHash: hashPassword('admin123'),
    fullName: 'Quản Trị Viên 11Sport',
    phone: '0909000001',
    role: 'ADMIN',
    status: 'ACTIVE',
  });

  await staffRepo.create({
    code: 'NV002',
    username: 'warehouse1',
    passwordHash: hashPassword('123456'),
    fullName: 'Lê Văn Kho',
    phone: '0909000002',
    role: 'WAREHOUSE',
    status: 'ACTIVE',
  });

  await staffRepo.create({
    code: 'NV003',
    username: 'sales1',
    passwordHash: hashPassword('123456'),
    fullName: 'Nguyễn Văn Bán',
    phone: '0909000003',
    role: 'SALES',
    status: 'ACTIVE',
  });
}
