import {
  staffRepo,
  categoryRepo,
  productRepo,
  stockMovementRepo,
  importReceiptRepo,
  customerRepo,
  orderRepo,
} from './db';
import { hashPassword } from '../utils/auth';
import { generateProductCode } from '../utils/productCode';

export async function seedDatabaseIfNeeded(): Promise<void> {
  const existingStaffCount = await staffRepo.countDocuments({});
  if (existingStaffCount > 0) {
    return;
  }

  console.log('[Seed] Initializing rich 11Sport seed data...');

  // 1. Seed 3 nhân viên: admin, warehouse1, sales1
  const adminStaff = await staffRepo.create({
    code: 'NV001',
    username: 'admin',
    passwordHash: hashPassword('admin123'),
    fullName: 'Quản Trị Viên 11Sport',
    phone: '0909000001',
    role: 'ADMIN',
    status: 'ACTIVE',
  });

  const warehouseStaff = await staffRepo.create({
    code: 'NV002',
    username: 'warehouse1',
    passwordHash: hashPassword('123456'),
    fullName: 'Lê Văn Kho',
    phone: '0909000002',
    role: 'WAREHOUSE',
    status: 'ACTIVE',
  });

  const salesStaff = await staffRepo.create({
    code: 'NV003',
    username: 'sales1',
    passwordHash: hashPassword('123456'),
    fullName: 'Nguyễn Văn Bán',
    phone: '0909000003',
    role: 'SALES',
    status: 'ACTIVE',
  });

  // 2. Seed Categories
  const catAo = await categoryRepo.create({
    code: 'AO',
    name: 'Áo thể thao',
    status: 'ACTIVE',
  });

  const catGiay = await categoryRepo.create({
    code: 'GIAY',
    name: 'Giày thể thao',
    status: 'ACTIVE',
  });

  const catPhuKien = await categoryRepo.create({
    code: 'PHU_KIEN',
    name: 'Phụ kiện',
    status: 'ACTIVE',
  });

  const catBong = await categoryRepo.create({
    code: 'BONG',
    name: 'Bóng thi đấu',
    status: 'ACTIVE',
  });

  // 3. Seed Products (chuẩn tên có (...) và 1 sản phẩm mới nhập có sellingPrice = 0)
  const productSeeds = [
    {
      name: 'Áo Polo Thể thao Unisex V1 (Áo Polo Thể thao Unisex V1 KMAP262510 Đỏ size L)',
      category: catAo,
      unit: 'Cái',
      sellingPrice: 280000,
      initialImportQty: 30,
    },
    {
      name: 'Áo Polo Thể thao Unisex V1 (Áo Polo Thể thao Unisex V1 KMAP262510 Xanh size M)',
      category: catAo,
      unit: 'Cái',
      sellingPrice: 280000,
      initialImportQty: 25,
    },
    {
      name: 'Giày Chạy Bộ 11Sport Pro (Giày Chạy Bộ 11Sport Pro GCB2026 Trắng size 42)',
      category: catGiay,
      unit: 'Đôi',
      sellingPrice: 850000,
      initialImportQty: 15,
    },
    {
      name: 'Vớ Thể Thao Cổ Cao (Vớ Thể Thao Cổ Cao VTT01 Đen FreeSize)',
      category: catPhuKien,
      unit: 'Đôi',
      sellingPrice: 45000,
      initialImportQty: 50,
    },
    {
      name: 'Bóng Đá Thi Đấu Size 5 (Bóng Đá Thi Đấu 11Sport BDT05 Trắng Xanh)',
      category: catBong,
      unit: 'Quả',
      sellingPrice: 0, // Sản phẩm mới nhập kho có sellingPrice = 0 để test chặn bán hàng khi giá = 0
      initialImportQty: 10,
    },
  ];

  const createdProducts: any[] = [];
  const importItems: any[] = [];
  const importDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // Cách đây 2 ngày

  for (let i = 0; i < productSeeds.length; i++) {
    const p = productSeeds[i];
    const code = generateProductCode(p.name);
    const prod = await productRepo.create({
      code,
      name: p.name,
      categoryId: p.category._id,
      categoryCode: p.category.code,
      categoryName: p.category.name,
      unit: p.unit,
      sellingPrice: p.sellingPrice,
      stock: p.initialImportQty,
      status: 'ACTIVE',
      createdAt: importDate,
      updatedAt: importDate,
    });
    createdProducts.push(prod);

    importItems.push({
      stt: i + 1,
      productId: prod._id,
      productCode: prod.code,
      productName: prod.name,
      categoryId: prod.categoryId,
      unit: prod.unit,
      expectedQuantity: p.initialImportQty,
      actualQuantity: p.initialImportQty,
      note: 'Nhập hàng đầu kỳ 11Sport',
      isChecked: true,
      isConfirmed: true,
      discrepancyNote: '',
    });
  }

  // 4. Tạo Phiếu nhập kho mẫu đã hoàn thành (PN-0001) + StockMovement IMPORT
  const sampleImport = await importReceiptRepo.create({
    code: 'PN-0001',
    status: 'COMPLETED',
    defaultCategoryId: catAo._id,
    note: 'Nhập hàng đợt 1 từ Nhà cung cấp 11Sport',
    items: importItems,
    createdBy: warehouseStaff._id,
    createdByName: warehouseStaff.fullName,
    completedBy: warehouseStaff._id,
    completedByName: warehouseStaff.fullName,
    completedAt: importDate,
    createdAt: importDate,
    updatedAt: importDate,
  });

  for (let i = 0; i < createdProducts.length; i++) {
    const prod = createdProducts[i];
    const qty = productSeeds[i].initialImportQty;
    await stockMovementRepo.create({
      type: 'IMPORT',
      productId: prod._id,
      productCode: prod.code,
      productName: prod.name,
      categoryId: prod.categoryId,
      unit: prod.unit,
      quantityChange: qty,
      balanceBefore: 0,
      balanceAfter: qty,
      referenceType: 'IMPORT_RECEIPT',
      referenceId: sampleImport._id,
      referenceCode: sampleImport.code,
      performedBy: warehouseStaff._id,
      performedByName: warehouseStaff.fullName,
      note: 'Nhập kho theo phiếu PN-0001',
      createdAt: importDate,
      updatedAt: importDate,
    });
  }

  // Tạo thêm 1 phiếu nhập đang ở trạng thái CHECKING (PN-0002) để thủ kho test ngay trên giao diện
  await importReceiptRepo.create({
    code: 'PN-0002',
    status: 'CHECKING',
    defaultCategoryId: catAo._id,
    note: 'Phiếu nhập hàng đợt 2 đang chờ kiểm thực tế',
    items: [
      {
        stt: 1,
        productId: createdProducts[0]._id,
        productCode: createdProducts[0].code,
        productName: createdProducts[0].name,
        categoryId: createdProducts[0].categoryId,
        unit: createdProducts[0].unit,
        expectedQuantity: 10,
        actualQuantity: 10,
        note: 'Bổ sung size L',
        isChecked: false,
        isConfirmed: false,
        discrepancyNote: '',
      },
      {
        stt: 2,
        productId: createdProducts[2]._id,
        productCode: createdProducts[2].code,
        productName: createdProducts[2].name,
        categoryId: createdProducts[2].categoryId,
        unit: createdProducts[2].unit,
        expectedQuantity: 5,
        actualQuantity: 5,
        note: 'Bổ sung giày chạy bộ',
        isChecked: false,
        isConfirmed: false,
        discrepancyNote: '',
      },
    ],
    createdBy: warehouseStaff._id,
    createdByName: warehouseStaff.fullName,
  });

  // 5. Tạo Khách hàng mẫu & Đơn hàng mẫu (HD-0001)
  const orderDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // Hôm qua
  const pPoloRed = createdProducts[0]; // 280,000 x 2 = 560,000
  const pSocks = createdProducts[3]; // 45,000 x 2 = 90,000
  const subtotal = 280000 * 2 + 45000 * 2; // 650,000
  const cardFee = Math.round(subtotal * 0.03); // 19,500
  const totalAmount = subtotal + cardFee; // 669,500

  const sampleCustomer = await customerRepo.create({
    phone: '0901234567',
    name: 'Trần Minh Khách',
    totalOrders: 1,
    totalSpent: totalAmount,
    lastOrderAt: orderDate,
    createdAt: orderDate,
    updatedAt: orderDate,
  });

  // Trừ tồn kho thực tế cho 2 sản phẩm bán trong đơn mẫu
  await productRepo.updateById(pPoloRed._id, { stock: pPoloRed.stock - 2 });
  await productRepo.updateById(pSocks._id, { stock: pSocks.stock - 2 });

  const sampleOrder = await orderRepo.create({
    orderCode: 'HD-0001',
    customerId: sampleCustomer._id,
    customerName: sampleCustomer.name,
    customerPhone: sampleCustomer.phone,
    items: [
      {
        productId: pPoloRed._id,
        productCode: pPoloRed.code,
        productName: pPoloRed.name,
        unit: pPoloRed.unit,
        unitPrice: pPoloRed.sellingPrice,
        quantity: 2,
        returnedQuantity: 0,
        lineTotal: pPoloRed.sellingPrice * 2,
      },
      {
        productId: pSocks._id,
        productCode: pSocks.code,
        productName: pSocks.name,
        unit: pSocks.unit,
        unitPrice: pSocks.sellingPrice,
        quantity: 2,
        returnedQuantity: 0,
        lineTotal: pSocks.sellingPrice * 2,
      },
    ],
    subtotal,
    paymentMethod: 'CARD',
    hasCardFee: true,
    cardFeePercent: 3,
    cardFee,
    totalAmount,
    note: 'Giá đã bao gồm thuế',
    status: 'PAID',
    createdBy: salesStaff._id,
    createdByName: salesStaff.fullName,
    createdAt: orderDate,
    updatedAt: orderDate,
  });

  await stockMovementRepo.create({
    type: 'SALE',
    productId: pPoloRed._id,
    productCode: pPoloRed.code,
    productName: pPoloRed.name,
    categoryId: pPoloRed.categoryId,
    unit: pPoloRed.unit,
    quantityChange: -2,
    balanceBefore: 30,
    balanceAfter: 28,
    referenceType: 'ORDER',
    referenceId: sampleOrder._id,
    referenceCode: sampleOrder.orderCode,
    performedBy: salesStaff._id,
    performedByName: salesStaff.fullName,
    note: 'Bán hàng đơn HD-0001',
    createdAt: orderDate,
    updatedAt: orderDate,
  });

  await stockMovementRepo.create({
    type: 'SALE',
    productId: pSocks._id,
    productCode: pSocks.code,
    productName: pSocks.name,
    categoryId: pSocks.categoryId,
    unit: pSocks.unit,
    quantityChange: -2,
    balanceBefore: 50,
    balanceAfter: 48,
    referenceType: 'ORDER',
    referenceId: sampleOrder._id,
    referenceCode: sampleOrder.orderCode,
    performedBy: salesStaff._id,
    performedByName: salesStaff.fullName,
    note: 'Bán hàng đơn HD-0001',
    createdAt: orderDate,
    updatedAt: orderDate,
  });

  console.log('[Seed] Seed data created successfully (Staffs, Categories, Products, ImportReceipts, Order, Customer, StockMovements).');
}
