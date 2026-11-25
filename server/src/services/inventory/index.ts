export type {
  NormalizeVariantOptions,
} from './warehouseFloor.rules';

export {
  normalizeFloor,
  floorLabel,
  normalizeVariants,
  summarizeVariants,
  getFloorStocks,
  getVariantFloorStocks,
  applyFloorDelta,
  deductStockForSale,
  formatProductWithVariant,
  sanitizeColorHexes,
} from './warehouseFloor.rules';

export {
  enrichProductsWithSetLinks,
  executeUnpackSetToRetail,
} from './unpackSet.service';

export {
  getInventoryMovements,
  getInventoryReport,
  getInventoryTransfers,
} from './inventory.queries';

export {
  adjustStock,
  unpackSet,
} from './stockAdjustment.service';

export { transferStock } from './stockTransfer.service';

export { inferActorRole, buildStaffRoleMap } from './inventory.queries';
