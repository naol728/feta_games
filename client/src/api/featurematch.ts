import apiClient from "./apiClient";

export const featureMatch = async () => {
  const res = await apiClient.get("/feature/match");
  return res.data;
};
export const placefeaturedbet = async ({
  matchId,
  predictionId,
  stake,
}: {
  matchId: string;
  predictionId: string;
  stake: number;
}) => {
  const res = await apiClient.post("/feature/bet", {
    matchId,
    predictionId,
    stake,
  });

  return res.data;
};
export const getMyFeatureMatchBet = async (matchId: string) => {
  const res = await apiClient.get("/feature/bet", {
    params: {
      matchId,
    },
  });

  return res.data;
};
