import apiClient from "./apiClient";

export const me = async () => {
  const res = await apiClient.get("/auth/me");
  return res.data;
};
