import { staffRepo } from './db';
import { hashPassword } from '../utils/auth';

export async function seedDatabaseIfNeeded(): Promise<void> {
  const existingStaffCount = await staffRepo.countDocuments({});
  if (existingStaffCount > 0) {
    return;
  }

  console.log('[Seed] Initializing default staff accounts (admin, warehouse1, sales1)...');

  await staffRepo.create({
    code: 'NV001',
    username: 'admin',
    passwordHash: hashPassword('admin123'),
    fullName: 'Quản Trị Viên 11Sport',
    phone: '0909000001',
    role: 'ADMIN',
    status: 'ACTIVE',
  });

  await staffRepo.create({
    code: 'NV002',
    username: 'warehouse1',
    passwordHash: hashPassword('123456'),
    fullName: 'Lê Văn Kho',
    phone: '0909000002',
    role: 'WAREHOUSE',
    status: 'ACTIVE',
  });

  await staffRepo.create({
    code: 'NV003',
    username: 'sales1',
    passwordHash: hashPassword('123456'),
    fullName: 'Nguyễn Văn Bán',
    phone: '0909000003',
    role: 'SALES',
    status: 'ACTIVE',
  });
}
