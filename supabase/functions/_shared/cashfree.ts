export const CASHFREE_API_VERSION = "2026-01-01";

declare const Deno: { env: { get(key: string): string | undefined } };

export type CashfreeEnvironment = "sandbox" | "production";

export type CashfreeOrder = {
  cf_order_id: string;
  order_id: string;
  order_amount: number;
  order_currency: string;
  order_status: string;
  payment_session_id?: string;
  customer_details?: {
    customer_id?: string;
    customer_email?: string;
    customer_phone?: string;
    customer_name?: string;
  };
  order_tags?: Record<string, string> | null;
};

export type CashfreePayment = {
  cf_payment_id: string | number;
  order_id: string;
  order_amount: number;
  order_currency: string;
  payment_amount: number;
  payment_currency: string;
  payment_status: "SUCCESS" | "NOT_ATTEMPTED" | "FAILED" | "USER_DROPPED" | "VOID" | "CANCELLED" | "PENDING";
  payment_time?: string;
  payment_completion_time?: string;
};

export type CashfreeEarlyAccessEvidence = {
  state: "paid" | "pending" | "failed" | "cancelled" | "user_dropped" | "void";
  paymentId: string | null;
  paidAt: string | null;
};

type CashfreeConfig = {
  appId: string;
  secretKey: string;
  environment: CashfreeEnvironment;
  baseUrl: string;
};

export class CashfreeApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly errorType: string | null;
  readonly requestId: string;

  constructor(
    message: string,
    status: number,
    code: string | null,
    errorType: string | null,
    requestId: string,
  ) {
    super(message);
    this.name = "CashfreeApiError";
    this.status = status;
    this.code = code;
    this.errorType = errorType;
    this.requestId = requestId;
  }
}

export function getCashfreeConfig(): CashfreeConfig {
  const appId = Deno.env.get("CASHFREE_APP_ID");
  const secretKey = Deno.env.get("CASHFREE_SECRET_KEY");
  const environment = Deno.env.get("CASHFREE_ENV");
  if (!appId || !secretKey) throw new Error("Cashfree credentials are not configured.");
  if (environment !== "sandbox" && environment !== "production") {
    throw new Error("CASHFREE_ENV must be sandbox or production.");
  }
  return {
    appId,
    secretKey,
    environment,
    baseUrl: environment === "sandbox"
      ? "https://sandbox.cashfree.com/pg"
      : "https://api.cashfree.com/pg",
  };
}

async function cashfreeRequest<T>(
  path: string,
  requestId: string,
  init: RequestInit = {},
  idempotencyKey?: string,
): Promise<T> {
  const config = getCashfreeConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`${config.baseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-api-version": CASHFREE_API_VERSION,
        "x-client-id": config.appId,
        "x-client-secret": config.secretKey,
        "x-request-id": requestId,
        ...(idempotencyKey ? { "x-idempotency-key": idempotencyKey } : {}),
        ...init.headers,
      },
    });
    const data = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (!response.ok) {
      throw new CashfreeApiError(
        typeof data?.message === "string" ? data.message : "Cashfree request failed.",
        response.status,
        typeof data?.code === "string" ? data.code : null,
        typeof data?.type === "string" ? data.type : null,
        requestId,
      );
    }
    return data as T;
  } catch (error: unknown) {
    if (error instanceof CashfreeApiError) throw error;
    const message = error instanceof DOMException && error.name === "AbortError"
      ? "Cashfree request timed out."
      : "Unable to reach Cashfree.";
    throw new CashfreeApiError(message, 0, null, "network_error", requestId);
  } finally {
    clearTimeout(timeout);
  }
}

export function createCashfreeOrder(
  payload: Record<string, unknown>,
  requestId: string,
  idempotencyKey: string,
) {
  return cashfreeRequest<CashfreeOrder>(
    "/orders",
    requestId,
    { method: "POST", body: JSON.stringify(payload) },
    idempotencyKey,
  );
}

export function getCashfreeOrder(orderId: string, requestId: string) {
  return cashfreeRequest<CashfreeOrder>(`/orders/${encodeURIComponent(orderId)}`, requestId);
}

export function getCashfreePaymentsForOrder(orderId: string, requestId: string) {
  return cashfreeRequest<CashfreePayment[]>(`/orders/${encodeURIComponent(orderId)}/payments`, requestId);
}

export function validateCashfreeEarlyAccessEvidence(
  order: CashfreeOrder,
  payments: CashfreePayment[],
  expected: {
    orderId: string;
    workspaceId: string;
    internalPaymentId: string;
    amountPaise: number;
    currency: string;
    paymentType: string;
  },
  amountToPaise: (value: string | number) => number | null,
): CashfreeEarlyAccessEvidence {
  if (
    order.order_id !== expected.orderId
    || amountToPaise(order.order_amount) !== expected.amountPaise
    || order.order_currency !== expected.currency
    || order.customer_details?.customer_id !== expected.workspaceId
    || order.order_tags?.product !== expected.paymentType
    || order.order_tags?.workspace_id !== expected.workspaceId
    || order.order_tags?.internal_payment_id !== expected.internalPaymentId
  ) {
    throw new Error("CASHFREE_ORDER_EVIDENCE_MISMATCH");
  }

  const successfulPayments = payments.filter((payment) => payment.payment_status === "SUCCESS");
  const successfulPayment = successfulPayments.find((payment) => (
    payment.order_id === expected.orderId
    && amountToPaise(payment.payment_amount) === expected.amountPaise
    && payment.payment_currency === expected.currency
  ));
  if (successfulPayments.length > 0 && !successfulPayment) {
    throw new Error("CASHFREE_PAYMENT_EVIDENCE_MISMATCH");
  }
  if (order.order_status === "PAID" && successfulPayment) {
    return {
      state: "paid",
      paymentId: String(successfulPayment.cf_payment_id),
      paidAt: successfulPayment.payment_completion_time || successfulPayment.payment_time || new Date().toISOString(),
    };
  }

  const statuses = new Set(payments.map((payment) => payment.payment_status));
  if (statuses.has("PENDING") || statuses.has("NOT_ATTEMPTED") || payments.length === 0) {
    return { state: "pending", paymentId: null, paidAt: null };
  }
  if (statuses.has("USER_DROPPED")) return { state: "user_dropped", paymentId: null, paidAt: null };
  if (statuses.has("CANCELLED")) return { state: "cancelled", paymentId: null, paidAt: null };
  if (statuses.has("VOID")) return { state: "void", paymentId: null, paidAt: null };
  if (statuses.has("FAILED")) return { state: "failed", paymentId: null, paidAt: null };
  return { state: "pending", paymentId: null, paidAt: null };
}

export async function verifyCashfreeWebhookSignature(
  rawBody: string,
  timestamp: string,
  signature: string,
) {
  const { secretKey } = getCashfreeConfig();
  let supplied: Uint8Array<ArrayBuffer>;
  try {
    supplied = Uint8Array.from(atob(signature), (char) => char.charCodeAt(0));
  } catch {
    return false;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secretKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify(
    "HMAC",
    key,
    supplied,
    encoder.encode(`${timestamp}${rawBody}`),
  );
}
