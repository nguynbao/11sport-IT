import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  getCategoriesHandler,
  postCategoriesHandler,
  patchCategories_ByIdHandler,
  deleteCategories_ByIdHandler,
} from '../controllers/categories.controller';

export const categoriesRouter = Router();

categoriesRouter.get('/categories', getCategoriesHandler);
categoriesRouter.post('/categories', requireAuth, postCategoriesHandler);
categoriesRouter.patch('/categories/:id', requireAuth, patchCategories_ByIdHandler);
categoriesRouter.delete('/categories/:id', requireAuth, deleteCategories_ByIdHandler);
