import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
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

productsInventoryRouter.post('/products/generate-code', requireAuth, postProductsGenerateCodeHandler);
productsInventoryRouter.post('/products/preview-code', requireAuth, postProductsPreviewCodeHandler);
productsInventoryRouter.get('/products/lookup', getProductsLookupHandler);
productsInventoryRouter.get('/products', getProductsHandler);
productsInventoryRouter.post('/products', requireAuth, postProductsHandler);
productsInventoryRouter.post('/products/:id/variants', requireAuth, postProducts_ByIdVariantsHandler);
productsInventoryRouter.patch('/products/:id/variants', requireAuth, patchProducts_ByIdVariantsHandler);
productsInventoryRouter.patch('/products/:id', requireAuth, patchProducts_ByIdHandler);
productsInventoryRouter.delete('/products/:id', requireAuth, deleteProducts_ByIdHandler);
productsInventoryRouter.use('/inventory', requireAuth);
productsInventoryRouter.get('/inventory/movements', getInventoryMovementsHandler);
productsInventoryRouter.get('/inventory/report', getInventoryReportHandler);
productsInventoryRouter.post('/inventory/adjustments', postInventoryAdjustmentsHandler);
productsInventoryRouter.post('/inventory/unpack-set', postInventoryUnpackSetHandler);
productsInventoryRouter.get('/inventory/transfers', getInventoryTransfersHandler);
productsInventoryRouter.post('/inventory/transfers', postInventoryTransfersHandler);
