import { PayOS } from '@payos/node';

let payOSInstance: PayOS | null = null;

/**
 * Khởi tạo hoặc lấy PayOS client singleton từ biến môi trường
 */
export function getPayOSClient(): PayOS | null {
  const clientId = process.env.PAYOS_CLIENT_ID;
  const apiKey = process.env.PAYOS_API_KEY;
  const checksumKey = process.env.PAYOS_CHECKSUM_KEY;

  if (!clientId || !apiKey || !checksumKey) {
    return null;
  }

  if (!payOSInstance) {
    payOSInstance = new PayOS({
      clientId,
      apiKey,
      checksumKey,
    });
  }

  return payOSInstance;
}

export interface CreatePayosLinkParams {
  orderCode: number;
  amount: number;
  description: string;
  returnUrl: string;
  cancelUrl: string;
  items?: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
}

/**
 * Tạo link thanh toán PayOS VietQR
 */
export async function createPayosPaymentLink(params: CreatePayosLinkParams) {
  const client = getPayOSClient();
  if (!client) {
    throw new Error('PayOS credentials are missing from environment');
  }

  // PayOS yêu cầu description tối đa 25 ký tự, không dấu, không ký tự đặc biệt
  const cleanDescription = (params.description || `DH ${params.orderCode}`)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim()
    .slice(0, 25);

  const paymentData = {
    orderCode: params.orderCode,
    amount: params.amount,
    description: cleanDescription || `11S ${params.orderCode}`.slice(0, 25),
    returnUrl: params.returnUrl,
    cancelUrl: params.cancelUrl,
    items: params.items,
  };

  const paymentResponse = await client.paymentRequests.create(paymentData);
  return paymentResponse;
}

/**
 * Xác thực dữ liệu webhook trả về từ PayOS
 */
export async function verifyPayosWebhookData(webhookBody: any) {
  const client = getPayOSClient();
  if (!client) {
    throw new Error('PayOS credentials are missing from environment');
  }

  return client.webhooks.verify(webhookBody);
}
