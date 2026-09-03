import { env } from "./../../config/env";

if (!env.VERITASAPIKEY) throw new Error("VERITAS_API_KEY is required");

type VeritasResponse = { success?: boolean; error?: string };

export async function veritas<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("x-api-key", env.VERITASAPIKEY);

  if (init.body && !(init.body instanceof FormData)) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(`${env.VERITASAPIURL}${path}`, {
    ...init,
    headers,
  });
  const result = (await response.json()) as T & VeritasResponse;

  if (!response.ok || result.success === false) {
    throw new Error(
      result.error ?? `Veritas request failed (${response.status})`,
    );
  }

  return result;
}

interface VeritasPaymentResult {
  success: boolean;
  data?:
    | {
        payerName?: string;
        payerTelebirrNo?: string;
        creditedPartyName?: string;
        creditedPartyAccountNo?: string;
        transactionStatus?: string;
        receiptNo?: string;
        paymentDate?: string;
        settledAmount?: string;
        serviceFee?: string;
        serviceFeeVAT?: string;
        totalPaidAmount?: string;
        bankName?: string;
        customerNote?: string;
      }
    ;
}

interface PaymentVerifyResult {
  valid: boolean;
  message: string;
  receiptNo?: string;
  payerName?: string;
  creditedPartyName?: string;
  settledAmount?: number;
}

const normalizeName = (name: string) => {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
};

const parseAmount = (amount: string | undefined): number | null => {
  if (!amount) return null;

  const value = Number(amount.replace(/[^0-9.]/g, ""));

  return Number.isFinite(value) ? value : null;
};

export const paymentVerify = (
  result: VeritasPaymentResult,
  expectedAmount: number,
  expectedAccountName: string,
): PaymentVerifyResult => {
  if (!result?.success || !result.data) {
    return {
      valid: false,
      message: "Payment verification failed",
    };
  }

  const payment = result.data;

  if (payment.transactionStatus?.toLowerCase() !== "completed") {
    return {
      valid: false,
      message: `Payment is not completed. Status: ${payment.transactionStatus}`,
    };
  }

  const settledAmount = parseAmount(payment.settledAmount);

  if (settledAmount === null) {
    return {
      valid: false,
      message: "Invalid settled payment amount",
    };
  }

  if (settledAmount !== Number(expectedAmount)) {
    return {
      valid: false,
      message: `Amount mismatch. Expected ${expectedAmount} Birr but received ${settledAmount} Birr`,
      settledAmount,
    };
  }

  const actualName = normalizeName(payment.creditedPartyName ?? "");
  const expectedName = normalizeName(expectedAccountName);

  if (!actualName || actualName !== expectedName) {
    return {
      valid: false,
      message: `Account holder mismatch. Expected "${expectedAccountName}" but payment was made to "${payment.creditedPartyName}"`,
      payerName: payment.payerName,
      creditedPartyName: payment.creditedPartyName,
      settledAmount,
    };
  }

  return {
    valid: true,
    message: "Payment verified successfully",
    receiptNo: payment.receiptNo,
    payerName: payment.payerName,
    creditedPartyName: payment.creditedPartyName,
    settledAmount,
  };
};
