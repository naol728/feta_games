import apiClient from "./apiClient";

export const weeklyActivity = async () => {
  const res = await apiClient.get("/stats/dailyactivity");
  return res.data;
};
