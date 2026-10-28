import type {
  CreateOrderParams,
  CreateOrderResult,
  PaymentProvider,
  RefundParams,
  RefundResult,
  VerifySignatureParams,
} from "./payment";

export class MockPaymentProvider implements PaymentProvider {
  public orders: Map<string, CreateOrderParams & { order_id: string }> = new Map();
  public refunds: Map<string, RefundParams & { refund_id: string }> = new Map();
  public mockSignatureValid = true;
  private orderCounter = 1;
  private refundCounter = 1;

  async createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
    const order_id = `order_mock_${this.orderCounter++}`;
    this.orders.set(order_id, { ...params, order_id });
    return {
      order_id,
      amount_paise: params.amount_paise,
      currency: params.currency ?? "INR",
      key_id: "rzp_test_mock",
    };
  }

  verifySignature(_params: VerifySignatureParams): boolean {
    return this.mockSignatureValid;
  }

  async refund(params: RefundParams): Promise<RefundResult> {
    const refund_id = `rfnd_mock_${this.refundCounter++}`;
    this.refunds.set(refund_id, { ...params, refund_id });
    return {
      refund_id,
      payment_id: params.payment_id,
      amount_paise: params.amount_paise ?? 50000,
      status: "processed",
    };
  }
}
