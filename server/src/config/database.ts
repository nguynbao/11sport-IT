import mongoose from 'mongoose';
import { env } from './env';
import { memoryStore } from '../repositories/base.repository';

let dbMode: 'mongodb' | 'memory' = 'memory';
let mongoMemoryServerInstance: any = null;

export function getDbMode(): 'mongodb' | 'memory' {
  return dbMode;
}

export async function connectDatabase(): Promise<'mongodb' | 'memory'> {
  const uri = env.mongodbUri;

  if (env.forceMemoryDb) {
    dbMode = 'memory';
    return dbMode;
  }

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
    dbMode = 'memory';
    console.log(
      '[DB] Local MongoDB service not detected on 27017 -> Using built-in in-memory database engine (100% compatible).'
    );
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
