import axios from "axios";
export interface CBEReceipt {
  id: string;
  transactionType: string;

  debitAccountNo: string;
  debitCurrency: string;
  debitAmount: string;
  debitValueDate: string;

  creditAccountNo: string;
  creditCurrency: string;
  creditValueDate: string;

  processingDate: string;

  debitTheirRef: string;
  creditTheirRef: string;

  paymentDetails: string[];

  chargeComDisplay: string;
  commissionCode: string;

  commissionTypes: CommissionType[];

  chargeCode: string;
  positionType: string;

  taxTypes: TaxType[];

  amountDebitedWithCurrency: string;
  amountCreditedWithCurrency: string;
  totalChargeAmountWithCurrency: string;
  totalTaxAmountWithCurrency: string;

  amountDebited: string;
  amountCredited: string;
  totalChargeAmount: string;
  totalTaxAmount: string;

  debitCustomer: string;
  creditCustomer: string;
  chargedCustomer: string;

  totRecComm: string;
  totRecCommLcl: string;
  totRecChg: string;
  totRecChgLcl: string;

  rateFixing: string;
  authDate: string;
  roundType: string;
  currNo: string;

  dateTimes: string[];

  creditAccountHolder: string;
  debitAccountHolder: string;
}
export interface CommissionType {
  commissionType: string;
  commissionAmt: string;
}

export interface TaxType {
  taxType: string;
  taxAmt: string;
}
export interface DBTransaction {
  id: string;
  amount: number;
  status: string;
  metadata: {
    account_number: string;
  };
}

export async function getCBEReceipt(transactionId: string) {
  const url = `https://mb.cbe.com.et/api/v1/transactions/public/transaction-detail/${transactionId}`;

  try {
    const { data } = await axios.get(url, {
      headers: {
        "X-App-ID": "d1292e42-7400-49de-a2d3-9731caa4c819",
        "X-App-Version": "0a01980b-9859-1369-8198-59f403820000",
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json",
      },
    });

    if (!data || Object.keys(data).length === 0) {
      return {
        success: false,
        error: "Receipt not found",
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error: any) {
    // Handle API response errors
    if (error.response) {
      const status = error.response.status;

      if (status === 404) {
        return {
          success: false,
          error: "Receipt not found",
        };
      }

      if (status === 400) {
        return {
          success: false,
          error: "Receipt not found",
        };
      }

      return {
        success: false,
        error: error.response.data?.error || "Receipt not found",
      };
    }

    // Network / timeout errors
    return {
      success: false,
      error: "Unable to connect to CBE service",
    };
  }
}

export async function checkTransactionCBE({
  recepit,
  trx,
}: {
  recepit: CBEReceipt;
  trx: DBTransaction;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const dbAccount = trx.metadata?.account_number;
    const apiAccount = recepit.debitAccountNo;

    if (!dbAccount || dbAccount !== apiAccount) {
      return {
        success: false,
        error: "Account number mismatch",
      };
    }

    const dbAmount = Number(trx.amount);
    const apiAmount = parseFloat(recepit.amountCredited);

    if (dbAmount !== apiAmount) {
      return {
        success: false,
        error: "Amount mismatch",
      };
    }

    if (trx.status === "completed") {
      return {
        success: false,
        error: "Transaction already processed",
      };
    }

    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Unknown error",
    };
  }
}
