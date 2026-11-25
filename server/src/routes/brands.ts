import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  getBrandsHandler,
  postBrandsHandler,
  patchBrands_ByIdHandler,
  deleteBrands_ByIdHandler,
} from '../controllers/brands.controller';

export const brandsRouter = Router();

brandsRouter.get('/brands', getBrandsHandler);
brandsRouter.post('/brands', requireAuth, postBrandsHandler);
brandsRouter.patch('/brands/:id', requireAuth, patchBrands_ByIdHandler);
brandsRouter.delete('/brands/:id', requireAuth, deleteBrands_ByIdHandler);
