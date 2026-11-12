import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { connectDatabase, clearDatabase } from '../src/config/db';
import { seedDatabaseIfNeeded } from '../src/config/seed';
import { parseExcelDateToIso, parseStaffImportMatrix } from '../src/utils/staffImportParser';

describe('HR Quick Excel/CSV Import & Extended Staff Profile Fields', () => {
  const app = createApp();

  let hrToken: string;
  let salesToken: string;
  let salesId: string;

  beforeAll(async () => {
    process.env.FORCE_MEMORY_DB = 'true';
    await connectDatabase();
    await clearDatabase();
    await seedDatabaseIfNeeded();

    const hrRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'hr1', password: '123456' });
    hrToken = hrRes.body.data.token;

    const salesRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'sales1', password: '123456' });
    salesToken = salesRes.body.data.token;
    salesId = salesRes.body.data.user._id;
  });

  it('1. Bóc tách đúng mẫu Excel 2 dòng tiêu đề gộp ô của HR (SỐ HĐ & BHXH), ngày serial Excel, SĐT/CCCD mất số 0 đầu', () => {
    // 45962 = 2025-11-01 trong Excel serial date
    expect(parseExcelDateToIso('45962')).toBe('2025-11-01');
    expect(parseExcelDateToIso('15/08/2001')).toBe('2001-08-15');

    const matrix: string[][] = [
      [
        'BẮT ĐẦU',
        'KẾT THÚC',
        'HỌ TÊN',
        'NGÀY SINH',
        'GIỚI TÍNH',
        'QUỐC TỊCH',
        'CMND',
        'NGÀY CẤP',
        'NƠI CẤP',
        'ĐỊA CHỈ THƯỜNG CHÚ',
        'ĐỊA CHỈ HIỆN TẠI',
        'TRƯỜNG HỌC',
        'CHUYÊN NGÀNH',
        'VỊ TRÍ',
        'LOẠI HỢP ĐỒNG',
        'SỐ HĐ',
        '',
        '',
        'SDT',
        'BỘ PHẬN',
        'BHXH',
        '',
        '',
        'Lương',
        'Số ngày nghỉ',
        'STK',
      ],
      [
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        'HDTT',
        'HĐTV',
        'HDXDTH',
        '',
        '',
        'NGÀY ĐÓNG',
        'MỨC ĐÓNG',
        'NGÀY NGHỈ',
        '',
        '',
        '',
      ],
      [
        '01/11/2026',
        '31/12/2026',
        'Phạm Thị Thu Ngân',
        '15/08/2001',
        'nữ',
        'Việt Nam',
        '48301009988', // 11 số -> phục hồi 0 đầu thành 12 số CCCD
        '10/05/2022',
        'Cục CS QLHC về TTXH',
        'Hải Châu, Đà Nẵng',
        'Sơn Trà, Đà Nẵng',
        'ĐH Kinh tế Đà Nẵng',
        'Kế toán',
        'Nhân viên Kế toán',
        'Thử việc',
        '',
        'HĐTV-09/2026',
        '',
        '905123456', // 9 số -> phục hồi 0905123456
        'Văn phòng',
        '01/11/2026',
        '5.300.000',
        '',
        '8.500.000',
        '1.5',
        '1903888999 - Techcombank',
      ],
    ];

    const rows = parseStaffImportMatrix(matrix, ['nganptt']);
    expect(rows).toHaveLength(1);
    const r = rows[0];
    expect(r.suggestedUsername).toBe('nganptt2'); // tránh trùng username đã tồn tại
    expect(r.fullName).toBe('Phạm Thị Thu Ngân');
    expect(r.dateOfBirth).toBe('2001-08-15');
    expect(r.gender).toBe('Nữ');
    expect(r.nationality).toBe('Việt Nam');
    expect(r.citizenId).toBe('048301009988');
    expect(r.citizenIssueDate).toBe('2022-05-10');
    expect(r.citizenIssuePlace).toBe('Cục CS QLHC về TTXH');
    expect(r.permanentAddress).toBe('Hải Châu, Đà Nẵng');
    expect(r.currentAddress).toBe('Sơn Trà, Đà Nẵng');
    expect(r.school).toBe('ĐH Kinh tế Đà Nẵng');
    expect(r.major).toBe('Kế toán');
    expect(r.positionTitle).toBe('Nhân viên Kế toán');
    expect(r.role).toBe('ACCOUNTANT');
    expect(r.department).toBe('OFFICE');
    expect(r.contractType).toBe('PROBATION');
    expect(r.contractStartDate).toBe('2026-11-01');
    expect(r.contractEndDate).toBe('2026-12-31');
    expect(r.probationContractNumber).toBe('HĐTV-09/2026');
    expect(r.phone).toBe('0905123456');
    expect(r.bhxhStartDate).toBe('2026-11-01');
    expect(r.insurance).toBe(5300000);
    expect(r.bhxhEndDate).toBe('');
    expect(r.baseSalary).toBe(8500000);
    expect(r.recordedLeaveDays).toBe(1.5);
    expect(r.bankAccount).toBe('1903888999 - Techcombank');
  });

  it('2. API POST /api/v1/staff/parse-import-file chặn SALES (403) và trả dữ liệu chuẩn cho HR (200)', async () => {
    const csvSample = [
      'BẮT ĐẦU,KẾT THÚC,HỌ TÊN,NGÀY SINH,GIỚI TÍNH,QUỐC TỊCH,CMND,NGÀY CẤP,NƠI CẤP,ĐỊA CHỈ THƯỜNG CHÚ,ĐỊA CHỈ HIỆN TẠI,TRƯỜNG HỌC,CHUYÊN NGÀNH,VỊ TRÍ,LOẠI HỢP ĐỒNG,SỐ HĐ,,,SDT,BỘ PHẬN,BHXH,,,Lương,Số ngày nghỉ,STK',
      ',,,,,,,,,,,,,,,HDTT,HĐTV,HDXDTH,,,NGÀY ĐÓNG,MỨC ĐÓNG,NGÀY NGHỈ,,,',
      '01/10/2026,01/10/2027,Lê Minh Khôi,20/11/2000,Nam,Việt Nam,048200001122,12/06/2021,CA Đà Nẵng,Thanh Khê,Liên Chiểu,ĐH Bách Khoa,CNTT,Tư vấn bán hàng,Chính thức,,,HDXDTH-12/2026,0912345678,Bán hàng,01/10/2026,5300000,,7800000,2,0041000999999 - VCB',
    ].join('\n');

    const forbiddenRes = await request(app)
      .post('/api/v1/staff/parse-import-file')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ fileName: 'mau.csv', csvText: csvSample });
    expect(forbiddenRes.status).toBe(403);

    const okRes = await request(app)
      .post('/api/v1/staff/parse-import-file')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ fileName: 'mau.csv', csvText: csvSample });
    expect(okRes.status).toBe(200);
    expect(okRes.body.meta.total).toBe(1);
    expect(okRes.body.data.rows[0]).toMatchObject({
      suggestedUsername: 'khoilm',
      fullName: 'Lê Minh Khôi',
      role: 'SALES',
      department: 'SALES',
      contractType: 'FULLTIME',
      officialContractNumber: 'HDXDTH-12/2026',
      baseSalary: 7800000,
      insurance: 5300000,
      recordedLeaveDays: 2,
      bankAccount: '0041000999999 - VCB',
    });
  });

  it('3. Lưu đầy đủ hồ sơ mở rộng khi tạo tài khoản & phân quyền chặt chẽ khi nhân viên tự sửa vs HR sửa', async () => {
    const createRes = await request(app)
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        username: 'khoilm',
        password: '123456',
        fullName: 'Lê Minh Khôi',
        phone: '0912345678',
        dateOfBirth: '2000-11-20',
        gender: 'Nam',
        nationality: 'Việt Nam',
        citizenId: '048200001122',
        citizenIssueDate: '2021-06-12',
        citizenIssuePlace: 'CA Đà Nẵng',
        permanentAddress: 'Thanh Khê, Đà Nẵng',
        currentAddress: 'Liên Chiểu, Đà Nẵng',
        school: 'ĐH Bách Khoa',
        major: 'CNTT',
        positionTitle: 'Chuyên viên Tư vấn Bán hàng',
        bankAccount: '0041000999999 - VCB',
        role: 'SALES',
        department: 'SALES',
        contractType: 'FULLTIME',
        contractStartDate: '2026-10-01',
        contractEndDate: '2027-10-01',
        officialContractNumber: 'HDXDTH-12/2026',
        bhxhStartDate: '2026-10-01',
        insurance: 5300000,
        baseSalary: 7800000,
        recordedLeaveDays: 2,
      });

    expect(createRes.status).toBe(201);
    const staffId = createRes.body.data._id;
    expect(createRes.body.data.positionTitle).toBe('Chuyên viên Tư vấn Bán hàng');
    expect(createRes.body.data.officialContractNumber).toBe('HDXDTH-12/2026');
    expect(createRes.body.data.bankAccount).toBe('0041000999999 - VCB');
    expect(createRes.body.data.address).toBe('Thanh Khê, Đà Nẵng');

    // Nhân viên đăng nhập nhận đủ thông tin hồ sơ
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'khoilm', password: '123456' });
    expect(loginRes.status).toBe(200);
    const empToken = loginRes.body.data.token;
    expect(loginRes.body.data.user.school).toBe('ĐH Bách Khoa');
    expect(loginRes.body.data.user.bankAccount).toBe('0041000999999 - VCB');

    // Nhân viên khác (sales1) gọi GET /api/v1/staff không thấy lương & STK của khoilm
    const peerListRes = await request(app)
      .get('/api/v1/staff')
      .set('Authorization', `Bearer ${salesToken}`);
    expect(peerListRes.status).toBe(200);
    const peerView = peerListRes.body.data.find((s: any) => s._id === staffId);
    expect(peerView.baseSalary).toBe(0);
    expect(peerView.bankAccount).toBe('');

    // Nhân viên tự sửa thông tin cá nhân & STK ngân hàng -> 200 OK
    const selfUpdateOk = await request(app)
      .patch(`/api/v1/staff/${staffId}`)
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        currentAddress: 'Hải Châu, Đà Nẵng',
        school: 'ĐH Bách Khoa Đà Nẵng',
        bankAccount: '88889999 - MB Bank',
      });
    expect(selfUpdateOk.status).toBe(200);
    expect(selfUpdateOk.body.data.currentAddress).toBe('Hải Châu, Đà Nẵng');
    expect(selfUpdateOk.body.data.bankAccount).toBe('88889999 - MB Bank');

    // Nhân viên cố tự sửa các trường quản trị HR (Vị trí, Số HĐ, BHXH, Số ngày nghỉ) -> 403 FORBIDDEN
    const selfEditHrField = await request(app)
      .patch(`/api/v1/staff/${staffId}`)
      .set('Authorization', `Bearer ${empToken}`)
      .send({ officialContractNumber: 'FAKE-HD-999' });
    expect(selfEditHrField.status).toBe(403);

    const selfEditLeaveDays = await request(app)
      .patch(`/api/v1/staff/${staffId}`)
      .set('Authorization', `Bearer ${empToken}`)
      .send({ recordedLeaveDays: 30 });
    expect(selfEditLeaveDays.status).toBe(403);

    // Nhân viên cố sửa hồ sơ của đồng nghiệp khác -> 403 FORBIDDEN
    const editOtherStaff = await request(app)
      .patch(`/api/v1/staff/${salesId}`)
      .set('Authorization', `Bearer ${empToken}`)
      .send({ fullName: 'Sửa Trái Phép' });
    expect(editOtherStaff.status).toBe(403);

    // HR cập nhật vị trí, số HĐ, BHXH ngày nghỉ, số ngày nghỉ hồ sơ -> 200 OK
    const hrPatchRes = await request(app)
      .patch(`/api/v1/staff/${staffId}`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        positionTitle: 'Trưởng ca Bán hàng',
        bhxhEndDate: '2027-10-01',
        recordedLeaveDays: 3.5,
      });
    expect(hrPatchRes.status).toBe(200);
    expect(hrPatchRes.body.data.positionTitle).toBe('Trưởng ca Bán hàng');
    expect(hrPatchRes.body.data.recordedLeaveDays).toBe(3.5);
  });
});
