import apiClient from "./apiClient";

export const redeemCode = async (coupon: string) => {
  const res = await apiClient.post("/coupon/redeem", { coupon });
  return res.data;
};
