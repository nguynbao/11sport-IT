import { productRepo, staffRepo, stockMovementRepo } from "../../repositories";
import { ServiceContext } from "../../shared/http";
import { ok, ServiceResult } from "../../shared/result";
import { withPagination } from "../../shared/pagination";
import { filterAndRankBySearch } from "../../shared/search";
import { floorLabel, getFloorStocks } from "./warehouseFloor.rules";

export function inferActorRole(
  explicitRole?: string,
  userId?: string,
  userName?: string,
  staffRoleMap?: Map<string, string>,
  fallback = 'ADMIN'
): string {
  const cleanRole = String(explicitRole || '').trim().toUpperCase();
  if (cleanRole === 'CEO' || cleanRole === 'ADMIN' || cleanRole === 'ACCOUNTANT' || cleanRole === 'HR' || cleanRole === 'MARKETING' || cleanRole === 'SALES') {
    return cleanRole;
  }
  const uid = String(userId || '').trim();
  if (uid && staffRoleMap?.has(uid)) {
    return staffRoleMap.get(uid)!;
  }
  const upperId = uid.toUpperCase();
  if (upperId === 'ADMIN') return 'ADMIN';
  if (upperId === 'ACCOUNTANT') return 'ACCOUNTANT';
  if (upperId === 'SALES') return 'SALES';
  const nameLower = String(userName || '').toLowerCase();
  if (nameLower.includes('admin') || nameLower.includes('quản trị') || nameLower.includes('quản lý')) {
    return 'ADMIN';
  }
  if (nameLower.includes('kế toán') || nameLower.includes('thủ kho') || nameLower.includes('kho')) {
    return 'ACCOUNTANT';
  }
  return fallback;
}

export async function buildStaffRoleMap(): Promise<Map<string, string>> {
  const staffs = await staffRepo.find({});
  const map = new Map<string, string>();
  for (const s of staffs) {
    if (s._id && s.role) map.set(String(s._id), String(s.role).toUpperCase());
    if (s.username && s.role) map.set(String(s.username), String(s.role).toUpperCase());
  }
  return map;
}

// POST /api/v1/products/generate-code


export async function getInventoryMovements(ctx: ServiceContext, query: any): Promise<ServiceResult> {
  const { productId, type, from, to, search } = query || {};
    const [movements, allProducts, staffRoleMap] = await Promise.all([
      stockMovementRepo.find({}, { createdAt: -1 }),
      productRepo.find({}),
      buildStaffRoleMap(),
    ]);

    const hideCost = ctx.user?.role === 'SALES';
    const prodById = new Map(allProducts.map((p) => [String(p._id), p]));
    const prodByCode = new Map(allProducts.map((p) => [String(p.code), p]));

    const fromDate = from ? new Date(String(from)) : null;
    if (fromDate) fromDate.setHours(0, 0, 0, 0);

    const toDate = to ? new Date(String(to)) : null;
    if (toDate) toDate.setHours(23, 59, 59, 999);

    const baseMovements = movements
      .filter((m) => {
        if (productId && String(m.productId) !== String(productId)) return false;
        if (type && m.type !== String(type).toUpperCase()) return false;
        const mTime = new Date(m.createdAt).getTime();
        if (fromDate && mTime < fromDate.getTime()) return false;
        if (toDate && mTime > toDate.getTime()) return false;
        return true;
      })
      .map((m) => {
        const prod = prodById.get(String(m.productId)) || prodByCode.get(String(m.productCode));
        const defaultFallbackRole =
          m.type === 'SALE' || m.type === 'RETURN' || m.type === 'EXCHANGE_IN' || m.type === 'EXCHANGE_OUT'
            ? 'SALES'
            : String(m.referenceCode || '').startsWith('PN-')
            ? 'ACCOUNTANT'
            : 'ADMIN';
        const performedByRole = inferActorRole(
          (m as any).performedByRole,
          m.performedBy,
          m.performedByName,
          staffRoleMap,
          defaultFallbackRole
        );
        return {
          ...(m as any),
          performedByRole,
          sellingPrice: Number(prod?.sellingPrice || 0),
          currentStock: Number(prod?.stock ?? m.balanceAfter ?? 0),
          ...(hideCost ? {} : { costPrice: Number(prod?.costPrice || 0) }),
        };
      });

    const filtered = search
      ? filterAndRankBySearch(baseMovements, String(search), (m) => [
          { text: m.productCode, weight: 1.5 },
          { text: m.referenceCode, weight: 1.4 },
          { text: m.productName, weight: 1.3 },
          { text: m.color, weight: 0.9 },
          { text: m.size, weight: 0.9 },
          { text: m.performedByName, weight: 0.9 },
          { text: m.type, weight: 0.8 },
          { text: m.note, weight: 0.8 },
        ])
      : baseMovements;

    return withPagination(filtered, query);
}

export async function getInventoryReport(ctx: ServiceContext, query: any): Promise<ServiceResult> {
  const { from, to, categoryId, search } = query || {};
    const hideCost = ctx.user?.role === 'SALES';

    const fromDate = from ? new Date(String(from)) : new Date(0);
    if (from) fromDate.setHours(0, 0, 0, 0);

    const toDate = to ? new Date(String(to)) : new Date();
    if (to) toDate.setHours(23, 59, 59, 999);

    const allProducts = await productRepo.find({}, { createdAt: 1 });
    const allMovements = await stockMovementRepo.find({}, { createdAt: 1 });

    const baseProducts = allProducts.filter((p) => {
      if (categoryId && String(p.categoryId) !== String(categoryId)) return false;
      return true;
    });

    const searchedProducts = search
      ? filterAndRankBySearch(baseProducts, String(search), (p) => [
          { text: p.code, weight: 1.5 },
          { text: p.name, weight: 1.3 },
          { text: p.categoryName, weight: 0.9 },
          { text: p.categoryCode, weight: 0.9 },
        ])
      : baseProducts;

    const reportRows = searchedProducts.map((product) => {
      const pMovements = allMovements.filter(
        (m) => String(m.productId) === String(product._id)
      );

      let openingStock = 0;
      let importedQty = 0;
      let soldQty = 0;
      let adjustedAndReturnedQty = 0;

      for (const m of pMovements) {
        if (m.type === 'TRANSFER') continue;
        const mTime = new Date(m.createdAt).getTime();
        if (mTime < fromDate.getTime()) {
          openingStock += m.quantityChange;
        } else if (mTime <= toDate.getTime()) {
          if (m.type === 'IMPORT') {
            importedQty += m.quantityChange;
          } else if (m.type === 'SALE') {
            soldQty += Math.abs(m.quantityChange);
          } else {
            adjustedAndReturnedQty += m.quantityChange;
          }
        }
      }

      const closingStock =
        openingStock + importedQty - soldQty + adjustedAndReturnedQty;
      const floors = getFloorStocks(product);

      return {
        productId: product._id,
        productCode: product.code,
        productName: product.name,
        variants: floors.variants,
        categoryId: product.categoryId,
        categoryCode: product.categoryCode,
        categoryName: product.categoryName,
        unit: product.unit,
        sellingPrice: Number(product.sellingPrice || 0),
        ...(hideCost ? {} : { costPrice: Number(product.costPrice || 0) }),
        openingStock,
        importedQty,
        soldQty,
        adjustedAndReturnedQty,
        closingStock,
        currentStock: floors.stock,
        stockFloor1: floors.stockFloor1,
        stockFloor2: floors.stockFloor2,
      };
    });

    const summary = reportRows.reduce(
      (acc, r) => {
        acc.totalOpeningStock += r.openingStock;
        acc.totalImportedQty += r.importedQty;
        acc.totalSoldQty += r.soldQty;
        acc.totalAdjustedAndReturnedQty += r.adjustedAndReturnedQty;
        acc.totalClosingStock += r.closingStock;
        return acc;
      },
      {
        totalOpeningStock: 0,
        totalImportedQty: 0,
        totalSoldQty: 0,
        totalAdjustedAndReturnedQty: 0,
        totalClosingStock: 0,
      }
    );

    return withPagination(reportRows, query, {
        from: from || null,
        to: to || null,
        summary,
      });
}


export async function getInventoryTransfers(query: any): Promise<ServiceResult> {
  const movements = await stockMovementRepo.find({ type: 'TRANSFER' }, { createdAt: -1 });
    return withPagination(movements, query);
}

