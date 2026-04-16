import apiClinet from "./apiClient";

export const getInviteData = async () => {
  const res = await apiClinet.get("/invites");
  return res.data;
};
