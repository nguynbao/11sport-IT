import mongoose from 'mongoose';

type CollectionRecord = Record<string, any>;

class MemoryStore {
  private collections: Map<string, CollectionRecord[]> = new Map();

  getCollection(name: string): CollectionRecord[] {
    if (!this.collections.has(name)) {
      this.collections.set(name, []);
    }
    return this.collections.get(name)!;
  }

  clearAll(): void {
    this.collections.clear();
  }
}

export const memoryStore = new MemoryStore();

function generateObjectId(): string {
  return new mongoose.Types.ObjectId().toString();
}

function matchFilter(doc: CollectionRecord, filter: Record<string, any> = {}): boolean {
  for (const [key, val] of Object.entries(filter)) {
    if (val === undefined) continue;
    if (key === '$or' && Array.isArray(val)) {
      if (!val.some((sub) => matchFilter(doc, sub))) return false;
      continue;
    }
    const docVal = doc[key];
    if (val instanceof RegExp) {
      if (!val.test(String(docVal ?? ''))) return false;
    } else if (val && typeof val === 'object' && !(val instanceof Date)) {
      if ('$regex' in val) {
        const flags = val.$options || '';
        const regex = new RegExp(val.$regex, flags);
        if (!regex.test(String(docVal ?? ''))) return false;
      } else if ('$gte' in val || '$lte' in val || '$gt' in val || '$lt' in val || '$in' in val) {
        const dVal = docVal instanceof Date ? docVal.getTime() : docVal;
        if ('$gte' in val) {
          const cmp = val.$gte instanceof Date ? val.$gte.getTime() : val.$gte;
          if (!(dVal >= cmp)) return false;
        }
        if ('$lte' in val) {
          const cmp = val.$lte instanceof Date ? val.$lte.getTime() : val.$lte;
          if (!(dVal <= cmp)) return false;
        }
        if ('$gt' in val) {
          const cmp = val.$gt instanceof Date ? val.$gt.getTime() : val.$gt;
          if (!(dVal > cmp)) return false;
        }
        if ('$lt' in val) {
          const cmp = val.$lt instanceof Date ? val.$lt.getTime() : val.$lt;
          if (!(dVal < cmp)) return false;
        }
        if ('$in' in val && Array.isArray(val.$in)) {
          if (!val.$in.map(String).includes(String(docVal))) return false;
        }
      } else {
        if (String(docVal) !== String(val)) return false;
      }
    } else {
      if (String(docVal) !== String(val)) return false;
    }
  }
  return true;
}

export class Repository<T extends Record<string, any>> {
  private model: mongoose.Model<any>;
  private collectionName: string;

  constructor(model: mongoose.Model<any>, collectionName: string) {
    this.model = model;
    this.collectionName = collectionName;
  }

  private get isMongoConnected(): boolean {
    return mongoose.connection.readyState === 1;
  }

  async find(
    filter: Record<string, any> = {},
    sort?: Record<string, 1 | -1>
  ): Promise<(T & { _id: string; createdAt: Date; updatedAt: Date })[]> {
    if (this.isMongoConnected) {
      let q = this.model.find(filter);
      if (sort) q = q.sort(sort);
      const docs = await q.lean();
      return docs.map((d: any) => ({ ...d, _id: String(d._id) }));
    }

    const col = memoryStore.getCollection(this.collectionName);
    let results = col.filter((d) => matchFilter(d, filter)).map((d) => ({ ...d }));
    if (sort) {
      const sortEntries = Object.entries(sort);
      results.sort((a, b) => {
        for (const [k, dir] of sortEntries) {
          const va = a[k] instanceof Date ? a[k].getTime() : a[k];
          const vb = b[k] instanceof Date ? b[k].getTime() : b[k];
          if (va < vb) return -1 * dir;
          if (va > vb) return 1 * dir;
        }
        return 0;
      });
    }
    return results as any;
  }

  async findOne(
    filter: Record<string, any>
  ): Promise<(T & { _id: string; createdAt: Date; updatedAt: Date }) | null> {
    if (this.isMongoConnected) {
      const doc = await this.model.findOne(filter).lean();
      if (!doc) return null;
      return { ...(doc as any), _id: String((doc as any)._id) };
    }

    const col = memoryStore.getCollection(this.collectionName);
    const found = col.find((d) => matchFilter(d, filter));
    return found ? ({ ...found } as any) : null;
  }

  async findById(
    id: string
  ): Promise<(T & { _id: string; createdAt: Date; updatedAt: Date }) | null> {
    if (!id) return null;
    if (this.isMongoConnected) {
      if (!mongoose.Types.ObjectId.isValid(id)) return null;
      const doc = await this.model.findById(id).lean();
      if (!doc) return null;
      return { ...(doc as any), _id: String((doc as any)._id) };
    }

    const col = memoryStore.getCollection(this.collectionName);
    const found = col.find((d) => String(d._id) === String(id));
    return found ? ({ ...found } as any) : null;
  }

  async countDocuments(filter: Record<string, any> = {}): Promise<number> {
    if (this.isMongoConnected) {
      return this.model.countDocuments(filter);
    }
    const col = memoryStore.getCollection(this.collectionName);
    return col.filter((d) => matchFilter(d, filter)).length;
  }

  async create(
    data: Partial<T> & { _id?: string; createdAt?: Date; updatedAt?: Date }
  ): Promise<T & { _id: string; createdAt: Date; updatedAt: Date }> {
    if (this.isMongoConnected) {
      const created = await this.model.create(data);
      const obj = created.toObject();
      return { ...obj, _id: String(obj._id) };
    }

    const col = memoryStore.getCollection(this.collectionName);
    const now = new Date();
    const record: any = {
      ...data,
      _id: data._id ? String(data._id) : generateObjectId(),
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now,
    };
    col.push(record);
    return { ...record };
  }

  async updateById(
    id: string,
    update: Partial<T>
  ): Promise<(T & { _id: string; createdAt: Date; updatedAt: Date }) | null> {
    if (this.isMongoConnected) {
      if (!mongoose.Types.ObjectId.isValid(id)) return null;
      const updated = await this.model
        .findByIdAndUpdate(id, { $set: update }, { new: true })
        .lean();
      if (!updated) return null;
      return { ...(updated as any), _id: String((updated as any)._id) };
    }

    const col = memoryStore.getCollection(this.collectionName);
    const idx = col.findIndex((d) => String(d._id) === String(id));
    if (idx === -1) return null;
    const updatedRecord = {
      ...col[idx],
      ...update,
      _id: col[idx]._id,
      updatedAt: new Date(),
    };
    col[idx] = updatedRecord;
    return { ...updatedRecord } as any;
  }

  async deleteById(id: string): Promise<boolean> {
    if (this.isMongoConnected) {
      if (!mongoose.Types.ObjectId.isValid(id)) return false;
      const res = await this.model.findByIdAndDelete(id);
      return !!res;
    }

    const col = memoryStore.getCollection(this.collectionName);
    const idx = col.findIndex((d) => String(d._id) === String(id));
    if (idx === -1) return false;
    col.splice(idx, 1);
    return true;
  }
}
