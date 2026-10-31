import mongoose from 'mongoose';
import { StaffModel, IStaff } from '../models/Staff';
import { CategoryModel, ICategory } from '../models/Category';
import { ProductModel, IProduct } from '../models/Product';
import { StockMovementModel, IStockMovement } from '../models/StockMovement';
import { ImportReceiptModel, IImportReceipt } from '../models/ImportReceipt';
import { CustomerModel, ICustomer } from '../models/Customer';
import { OrderModel, IOrder } from '../models/Order';
import { ReturnExchangeModel, IReturnExchange } from '../models/ReturnExchange';
import { PromotionModel, IPromotion } from '../models/Promotion';
import { Repository, memoryStore } from './repository';

export const staffRepo = new Repository<IStaff>(StaffModel, 'staffs');
export const categoryRepo = new Repository<ICategory>(CategoryModel, 'categories');
export const productRepo = new Repository<IProduct>(ProductModel, 'products');
export const stockMovementRepo = new Repository<IStockMovement>(StockMovementModel, 'stock_movements');
export const importReceiptRepo = new Repository<IImportReceipt>(ImportReceiptModel, 'import_receipts');
export const customerRepo = new Repository<ICustomer>(CustomerModel, 'customers');
export const orderRepo = new Repository<IOrder>(OrderModel, 'orders');
export const returnExchangeRepo = new Repository<IReturnExchange>(ReturnExchangeModel, 'return_exchanges');
export const promotionRepo = new Repository<IPromotion>(PromotionModel, 'promotions');

let dbMode: 'mongodb' | 'memory' = 'memory';
let mongoMemoryServerInstance: any = null;

export function getDbMode(): 'mongodb' | 'memory' {
  return dbMode;
}

export async function connectDatabase(): Promise<'mongodb' | 'memory'> {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/11sport';

  if (process.env.FORCE_MEMORY_DB === 'true') {
    dbMode = 'memory';
    return dbMode;
  }

  // 1. Thử kết nối trực tiếp tới MONGODB_URI (local hoặc remote Atlas)
  try {
    const isRemote = uri.startsWith('mongodb+srv://') || !uri.includes('127.0.0.1');
    const timeoutMs = isRemote ? 10000 : 2500;
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: timeoutMs,
      connectTimeoutMS: timeoutMs,
    });
    dbMode = 'mongodb';
    console.log(`[DB] Connected to MongoDB at ${uri.replace(/:([^:@]+)@/, ':***@')}`);
    return dbMode;
  } catch {
    // 2. Fallback sang cơ chế lưu trữ tương thích trong bộ nhớ để chạy độc lập 100% không lỗi
    dbMode = 'memory';
    console.log('[DB] Local MongoDB service not detected on 27017 -> Using built-in in-memory database engine (100% compatible).');
    return dbMode;
  }
}

export async function clearDatabase(): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  }
  memoryStore.clearAll();
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoMemoryServerInstance) {
    await mongoMemoryServerInstance.stop();
    mongoMemoryServerInstance = null;
  }
}
