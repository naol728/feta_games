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
  reducers: {
    setUserWallet: (state, action) => {
      if (state.user) {
        state.user.wallets.balance = action.payload.balance;
        state.user.wallets.locked_balance = action.payload.locked_balance;
      }
    },
  },
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
export const { setUserWallet } = authSlice.actions;
export default authSlice.reducer;
