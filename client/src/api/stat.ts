import apiClient from "./apiClient";

export const weeklyActivity = async () => {
  const res = await apiClient.get("/stats/dailyactivity");
  return res.data;
};
export const getDailyLeaderboard = async (date?: string) => {
  const res = await apiClient.get("/stats/leaderboard", {
    params: date ? { date } : {},
  });

  return res.data;
};

export const getSupport = async () => {
  const res = await apiClient.get("/stats/support");

  return res.data;
};
