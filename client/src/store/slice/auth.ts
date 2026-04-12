/*eslint-disable*/
import apiClient from "@/api/apiClient";
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

export const initAuth = createAsyncThunk("auth/init", async () => {
  const res = await apiClient.post(`/auth/telegram`, {
    initData: window.Telegram.WebApp.initData,
  });
  const data = res.data;
  if (!data?.access_token) throw new Error("Auth failed");
  localStorage.setItem("access_token", data.access_token);
  return data.user;
});

interface Wallet {
  balance: number;
  locked_balance: number;
}
interface User {
  id: string;
  telegram_id: number;
  username: string;
  created_at: string;
  updated_at: string;
  Fname: string;
  Lname: string;
  wallets: Wallet;
}

type InitalState = {
  user: User | null;
  loading: boolean;
};
const initialState: InitalState = {
  user: null,
  loading: true,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(initAuth.pending, (state) => {
        state.loading = true;
      })
      .addCase(initAuth.fulfilled, (state, action) => {
        state.user = action.payload;
        state.loading = false;
      })
      .addCase(initAuth.rejected, (state) => {
        state.loading = false;
      });
  },
});

export default authSlice.reducer;
