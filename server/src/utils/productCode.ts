/**
 * Công thức tự sinh Mã sản phẩm chuẩn 11Sport (BR-03):
 * - Trích xuất nội dung bên trong cặp ngoặc đơn (...) cuối cùng của Tên hàng hóa.
 * - Fallback: Nếu tên hàng không chứa (), chuẩn hóa toàn bộ chuỗi tên hàng.
 * - Bỏ dấu tiếng Việt (Đ/đ -> D), chuyển IN HOA, thay khoảng trắng/ký tự đặc biệt bằng dấu gạch chân '_',
 *   cắt bỏ '_' ở đầu và cuối.
 */
export function generateProductCode(rawName: string): string {
  if (!rawName || typeof rawName !== 'string') {
    return '';
  }

  const trimmed = rawName.trim();
  if (!trimmed) {
    return '';
  }

  // Tìm tất cả các cặp ngoặc đơn (...) và lấy cặp cuối cùng không rỗng
  const matches = [...trimmed.matchAll(/\(([^()]+)\)/g)];
  let targetText = trimmed;
  if (matches.length > 0) {
    const lastMatch = matches[matches.length - 1][1].trim();
    if (lastMatch.length > 0) {
      targetText = lastMatch;
    }
  }

  return normalizeToUpperCode(targetText);
}

export function normalizeToUpperCode(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Bỏ dấu tiếng Việt
    .replace(/[đĐ]/g, 'D')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_') // Thay khoảng trắng & ký tự đặc biệt liên tiếp bằng _
    .replace(/^_+|_+$/g, ''); // Cắt _ ở đầu/cuối
}
