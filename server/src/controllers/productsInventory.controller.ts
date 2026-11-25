import { handle } from '../shared/http';
import {
  generateCode,
  previewCode,
  lookupProducts,
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  addProductVariant,
  updateProductVariant,
} from '../services/products';
import {
  getInventoryMovements,
  getInventoryReport,
  getInventoryTransfers,
  adjustStock,
  unpackSet,
  transferStock,
} from '../services/inventory';

export const postProductsGenerateCodeHandler = handle((req) => generateCode(req.body));
export const postProductsPreviewCodeHandler = handle((req) => previewCode(req.body));
export const getProductsLookupHandler = handle((req, ctx) => lookupProducts(ctx, req.query));
export const getProductsHandler = handle((req, ctx) => listProducts(ctx, req.query));
export const postProductsHandler = handle((req, ctx) => createProduct(ctx, req.body));
export const postProducts_ByIdVariantsHandler = handle((req, ctx) =>
  addProductVariant(ctx, req.params.id, req.body)
);
export const patchProducts_ByIdVariantsHandler = handle((req, ctx) =>
  updateProductVariant(ctx, req.params.id, req.body)
);
export const patchProducts_ByIdHandler = handle((req, ctx) =>
  updateProduct(ctx, req.params.id, req.body)
);
export const deleteProducts_ByIdHandler = handle((req, ctx) =>
  deleteProduct(ctx, req.params.id)
);

export const getInventoryMovementsHandler = handle((req, ctx) =>
  getInventoryMovements(ctx, req.query)
);
export const getInventoryReportHandler = handle((req, ctx) =>
  getInventoryReport(ctx, req.query)
);
export const postInventoryAdjustmentsHandler = handle((req, ctx) =>
  adjustStock(ctx, req.body)
);
export const postInventoryUnpackSetHandler = handle((req, ctx) =>
  unpackSet(ctx, req.body)
);
export const getInventoryTransfersHandler = handle((req) =>
  getInventoryTransfers(req.query)
);
export const postInventoryTransfersHandler = handle((req, ctx) =>
  transferStock(ctx, req.body)
);
