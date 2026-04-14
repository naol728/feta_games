import apiClient from "./apiClient";
const BASE = "wallet";
export const paymentMethod = async ({ amount }: { amount: string }) => {
  const res = await apiClient.post(`/${BASE}/paymentmethod`, {
    amount,
  });
  return res.data;
};

export const gettransaction = async ({
  trxno,
}: {
  trxno: string | undefined;
}) => {
  const res = await apiClient.get(`/${BASE}/gettransaction/${trxno}`);
  return res.data;
};

export const varifytransaction = async (data: {
  trxno: string | undefined;
  transactionUrl: string;
}) => {
  const { trxno, transactionUrl } = data;
  const res = await apiClient.post(`/${BASE}/deposit`, {
    trxno,
    transactionUrl,
  });
  return res.data;
};
export const gettransactionhistory = async () => {
  const res = await apiClient.get(`/${BASE}/transactions`);
  return res.data;
};
