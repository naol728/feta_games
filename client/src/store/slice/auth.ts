/* eslint-disable */

import apiClient from "@/api/apiClient";
import {
  createSlice,
  createAsyncThunk,
  type PayloadAction,
} from "@reduxjs/toolkit";

export const initAuth = createAsyncThunk("auth/init", async () => {
  const res = await apiClient.post(`/auth/telegram`, {
    initData: window.Telegram.WebApp.initData,
  });

  const data = res.data;

  if (!data?.access_token) {
    throw new Error("Auth failed");
  }

  localStorage.setItem("access_token", data.access_token);

  return data.user;
});

export const fetchWallet = createAsyncThunk(
  "auth/fetchWallet",
  async (_, { rejectWithValue }) => {
    try {
      const res = await apiClient.get("/wallet");

      const data = res.data;

      if (!data) {
        throw new Error("Wallet data not found");
      }

      return data.wallet ?? data;
    } catch (error: any) {
      return rejectWithValue(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to fetch wallet",
      );
    }
  },
);
interface Wallet {
  balance: number;
  locked_balance: number;
  withdrawable_balance: number;
  available_balance: number;
}

interface UserProgress {
  user_id: string;
  current_level: number;
  total_points: number;
  total_deposit: number;
  current_level_required_points: number;
  current_level_minimum_deposit: number;
  next_level: number | null;
  next_level_required_points: number;
  next_level_minimum_deposit: number;
  points_remaining: number;
  deposit_remaining: number;
  points_progress_percent: number;
  deposit_progress_percent: number;
  is_max_level: boolean;
}

export interface User {
  id: string;
  telegram_id: number;
  username: string;
  created_at: string;
  updated_at: string;
  Fname: string;
  Lname: string | null;
  referral_id: string;
  invited_by: string | null;
  phone: string | null;
  wallets: Wallet;
  progress?: UserProgress;
}

// Redux state – unchanged
type InitalState = {
  user: User | null;
  loading: boolean;
  walletLoading: boolean;
};

const initialState: InitalState = {
  user: null,
  loading: true,
  walletLoading: false,
};

const authSlice = createSlice({
  name: "auth",

  initialState,

  reducers: {
    /**
     * Manually update wallet in Redux
     */
    setUserWallet: (state, action: PayloadAction<Wallet>) => {
      if (!state.user) return;

      state.user.wallets = action.payload;
    },

    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;

      localStorage.setItem("user", JSON.stringify(action.payload));
    },
  },

  extraReducers: (builder) => {
    builder

      // =========================
      // INIT AUTH
      // =========================
      .addCase(initAuth.pending, (state) => {
        state.loading = true;
      })

      .addCase(initAuth.fulfilled, (state, action) => {
        state.user = action.payload;
        state.loading = false;
      })

      .addCase(initAuth.rejected, (state) => {
        state.loading = false;
      })

      // =========================
      // FETCH WALLET
      // =========================
      .addCase(fetchWallet.pending, (state) => {
        state.walletLoading = true;
      })

      .addCase(fetchWallet.fulfilled, (state, action) => {
        state.walletLoading = false;

        if (state.user) {
          state.user.wallets = {
            ...state.user.wallets,
            ...action.payload,
          };

          // Keep localStorage synchronized
          localStorage.setItem("user", JSON.stringify(state.user));
        }
      })

      .addCase(fetchWallet.rejected, (state) => {
        state.walletLoading = false;
      });
  },
});

export const { setUserWallet, setUser } = authSlice.actions;

export default authSlice.reducer;
