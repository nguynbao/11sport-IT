import { Router } from 'express';
import {
  postProductsGenerateCodeHandler,
  postProductsPreviewCodeHandler,
  getProductsLookupHandler,
  getProductsHandler,
  postProductsHandler,
  postProducts_ByIdVariantsHandler,
  patchProducts_ByIdVariantsHandler,
  patchProducts_ByIdHandler,
  deleteProducts_ByIdHandler,
  getInventoryMovementsHandler,
  getInventoryReportHandler,
  postInventoryAdjustmentsHandler,
  postInventoryUnpackSetHandler,
  getInventoryTransfersHandler,
  postInventoryTransfersHandler,
} from '../controllers/productsInventory.controller';

export const productsInventoryRouter = Router();

productsInventoryRouter.post('/products/generate-code', postProductsGenerateCodeHandler);
productsInventoryRouter.post('/products/preview-code', postProductsPreviewCodeHandler);
productsInventoryRouter.get('/products/lookup', getProductsLookupHandler);
productsInventoryRouter.get('/products', getProductsHandler);
productsInventoryRouter.post('/products', postProductsHandler);
productsInventoryRouter.post('/products/:id/variants', postProducts_ByIdVariantsHandler);
productsInventoryRouter.patch('/products/:id/variants', patchProducts_ByIdVariantsHandler);
productsInventoryRouter.patch('/products/:id', patchProducts_ByIdHandler);
productsInventoryRouter.delete('/products/:id', deleteProducts_ByIdHandler);
productsInventoryRouter.get('/inventory/movements', getInventoryMovementsHandler);
productsInventoryRouter.get('/inventory/report', getInventoryReportHandler);
productsInventoryRouter.post('/inventory/adjustments', postInventoryAdjustmentsHandler);
productsInventoryRouter.post('/inventory/unpack-set', postInventoryUnpackSetHandler);
productsInventoryRouter.get('/inventory/transfers', getInventoryTransfersHandler);
productsInventoryRouter.post('/inventory/transfers', postInventoryTransfersHandler);
