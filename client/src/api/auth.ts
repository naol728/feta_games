import apiClient from "./apiClient";

export const me = async () => {
  const res = await apiClient.get("/me");
  return res.data;
};
