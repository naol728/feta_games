import axios, { AxiosError } from "axios";
import { env } from "../../config/env";

if (!env.VERIFY_ET_API_KEY) {
  throw new Error("VERIFY_ET_API_KEY is required");
}

if (!env.VERIFY_ET_API_URL) {
  throw new Error("VERIFY_ET_API_URL is required");
}

// ============================================================
// VERIFY.ET TYPES
// ============================================================

export interface VerifyEtTransaction {
  bank?: string;
  status?: string;
  verified?: boolean;

  amount?: number | string;
  currency?: string;

  senderName?: string;
  senderAccount?: string;

  receiverName?: string;
  receiverAccount?: string;

  referenceNumber?: string;
  transactionNumber?: string;

  timestamp?: string;

  settlementAccountMatch?: {
    matched?: boolean;
    matchType?: string;
    matchConfidence?: string;
    source?: string;
    bank?: string;
    receiverAccount?: string;
    matchedSettlementAccount?: string;
    candidateCount?: number;
    ambiguous?: boolean;
    reason?: string;
  };

  // Kept for compatibility if Verify.ET/provider
  // ever returns these names.
  payerName?: string;
  payerTelebirrNo?: string;
  creditedPartyName?: string;
  creditedPartyAccountNo?: string;
  transactionStatus?: string;
  receiptNo?: string;
  paymentDate?: string;
  settledAmount?: number | string;
  totalPaidAmount?: number | string;
}

export interface VerifyEtResponse {
  success?: boolean;
  message?: string;

  data?: VerifyEtTransaction[];

  requestId?: string;
  statusUrl?: string;

  verification?: {
    requestId?: string;
    bank?: string;
    processingStatus?: string;
    status?: string;
    verified?: boolean;
  };

  links?: {
    statusUrl?: string;
    pollAfterMs?: number;
    webhookRegistered?: boolean;
  };
}

// ============================================================
// NORMALIZED RESULT USED BY YOUR APP
// ============================================================

export interface PaymentVerifyResult {
  valid: boolean;
  pending?: boolean;
  message: string;

  receiptNo?: string;
  referenceNumber?: string;

  payerName?: string;
  payerAccount?: string;

  creditedPartyName?: string;
  creditedPartyAccount?: string;

  settledAmount?: number;

  receiverMatched?: boolean;
}

// ============================================================
// HELPERS
// ============================================================

const normalizeName = (name: string = "") => {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
};

const normalizeAccount = (account: string = "") => {
  return account
    .replace(/\s+/g, "")
    .replace(/^\+251/, "0")
    .replace(/^251/, "0");
};

const parseAmount = (
  amount: string | number | undefined | null,
): number | null => {
  if (amount === undefined || amount === null || amount === "") {
    return null;
  }

  if (typeof amount === "number") {
    return Number.isFinite(amount) ? amount : null;
  }

  const value = Number(amount.replace(/[^0-9.]/g, ""));

  return Number.isFinite(value) ? value : null;
};

// ============================================================
// CALL VERIFY.ET
// ============================================================

export async function verifyPayment(
  reference: string,
  settlementAccount?: string,
): Promise<VerifyEtResponse> {
  try {
    const response = await axios.post<VerifyEtResponse>(
      env.VERIFY_ET_API_URL,
      {
        bank: "telebirr",
        transactionNumber: reference,

        // Important:
        // Verify.ET can verify that the transaction was
        // actually sent to your Telebirr account.
        ...(settlementAccount
          ? {
              settlementAccount,
            }
          : {}),
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.VERIFY_ET_API_KEY,

          // Prevent duplicate verification submissions.
          "Idempotency-Key": `gebeta-deposit-${reference}`,
        },

        // Verify.ET can return 202 when the request is queued.
        validateStatus: (status) => status >= 200 && status < 300,

        timeout: 15_000,
      },
    );

    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<VerifyEtResponse>;

    console.error("Verify.ET request failed:", {
      status: axiosError.response?.status,
      data: axiosError.response?.data,
      message: axiosError.message,
    });

    throw new Error(
      axiosError.response?.data?.message ||
        "Unable to verify payment with Verify.ET",
    );
  }
}

// ============================================================
// VALIDATE VERIFY.ET RESPONSE
// ============================================================

export const paymentVerify = (
  result: VerifyEtResponse,
  expectedAmount: number,
  expectedAccountName: string,
  expectedSettlementAccount?: string,
): PaymentVerifyResult => {
  // ----------------------------------------------------------
  // Verify.ET returned nothing
  // ----------------------------------------------------------

  if (!result) {
    return {
      valid: false,
      message: "Payment verification failed",
    };
  }

  // ----------------------------------------------------------
  // QUEUED
  // ----------------------------------------------------------

  const processingStatus = result.verification?.processingStatus?.toLowerCase();

  const verificationStatus = result.verification?.status?.toLowerCase();

  if (
    processingStatus === "queued" ||
    processingStatus === "running" ||
    verificationStatus === "pending"
  ) {
    return {
      valid: false,
      pending: true,
      message:
        "Payment verification is still processing. Please try again shortly.",
    };
  }

  // ----------------------------------------------------------
  // API LEVEL FAILURE
  // ----------------------------------------------------------

  if (result.success === false) {
    return {
      valid: false,
      message: result.message || "Payment verification failed",
    };
  }

  // ----------------------------------------------------------
  // GET FIRST VERIFIED RESULT
  // ----------------------------------------------------------

  const payment = result.data?.[0];

  if (!payment) {
    return {
      valid: false,
      message:
        result.message || "Transaction was not found or could not be verified.",
    };
  }

  // ----------------------------------------------------------
  // VERIFY STATUS
  // ----------------------------------------------------------

  const status = (
    payment.status ||
    payment.transactionStatus ||
    ""
  ).toLowerCase();

  const verified = payment.verified === true;

  if (!verified && status !== "success" && status !== "completed") {
    return {
      valid: false,
      message: `Payment is not verified. Status: ${
        payment.status || "unknown"
      }`,
    };
  }

  // ----------------------------------------------------------
  // AMOUNT
  // ----------------------------------------------------------

  const receivedAmount = parseAmount(
    payment.amount ?? payment.settledAmount ?? payment.totalPaidAmount,
  );

  if (receivedAmount === null) {
    return {
      valid: false,
      message: "Invalid payment amount returned by Verify.ET",
    };
  }

  // Avoid floating-point comparison issues.
  const normalizedReceived = Number(receivedAmount.toFixed(2));
  const normalizedExpected = Number(Number(expectedAmount).toFixed(2));

  if (normalizedReceived !== normalizedExpected) {
    return {
      valid: false,
      message: `Amount mismatch. Expected ${normalizedExpected} Birr but received ${normalizedReceived} Birr`,
      settledAmount: normalizedReceived,
      payerName: payment.senderName || payment.payerName,
      creditedPartyName: payment.receiverName || payment.creditedPartyName,
    };
  }

  // ----------------------------------------------------------
  // RECEIVER / SETTLEMENT ACCOUNT
  // ----------------------------------------------------------

  const settlementMatch = payment.settlementAccountMatch;

  if (
    expectedSettlementAccount &&
    settlementMatch &&
    settlementMatch.matched !== true
  ) {
    return {
      valid: false,
      message: "Payment was not made to the expected Telebirr account.",
      payerName: payment.senderName || payment.payerName,
      creditedPartyName: payment.receiverName || payment.creditedPartyName,
      settledAmount: normalizedReceived,
      receiverMatched: false,
    };
  }

  // ----------------------------------------------------------
  // RECEIVER NAME
  // ----------------------------------------------------------

  const actualName = normalizeName(
    payment.receiverName || payment.creditedPartyName || "",
  );

  const expectedName = normalizeName(expectedAccountName);

  if (!actualName) {
    return {
      valid: false,
      message: "Receiver account name was not returned by Verify.ET.",
      payerName: payment.senderName || payment.payerName,
      settledAmount: normalizedReceived,
    };
  }

  if (actualName !== expectedName) {
    return {
      valid: false,
      message: `Account holder mismatch. Expected "${expectedAccountName}" but payment was made to "${payment.receiverName || payment.creditedPartyName}"`,
      payerName: payment.senderName || payment.payerName,
      creditedPartyName: payment.receiverName || payment.creditedPartyName,
      settledAmount: normalizedReceived,
      receiverMatched: false,
    };
  }

  // ----------------------------------------------------------
  // SUCCESS
  // ----------------------------------------------------------

  return {
    valid: true,
    message: "Payment verified successfully",

    receiptNo:
      payment.referenceNumber || payment.transactionNumber || payment.receiptNo,

    referenceNumber: payment.referenceNumber || payment.transactionNumber,

    payerName: payment.senderName || payment.payerName,

    payerAccount: payment.senderAccount || payment.payerTelebirrNo,

    creditedPartyName: payment.receiverName || payment.creditedPartyName,

    creditedPartyAccount:
      payment.receiverAccount || payment.creditedPartyAccountNo,

    settledAmount: normalizedReceived,

    receiverMatched: settlementMatch?.matched ?? undefined,
  };
};
