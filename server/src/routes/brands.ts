import { Router } from 'express';
import {
  getBrandsHandler,
  postBrandsHandler,
  patchBrands_ByIdHandler,
  deleteBrands_ByIdHandler,
} from '../controllers/brands.controller';

export const brandsRouter = Router();

brandsRouter.get('/brands', getBrandsHandler);
brandsRouter.post('/brands', postBrandsHandler);
brandsRouter.patch('/brands/:id', patchBrands_ByIdHandler);
brandsRouter.delete('/brands/:id', deleteBrands_ByIdHandler);
