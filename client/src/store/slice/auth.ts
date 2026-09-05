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

/**
 * Fetch current wallet from backend
 *
 * GET /wallet
 */
export const fetchWallet = createAsyncThunk(
  "auth/fetchWallet",
  async (_, { rejectWithValue }) => {
    try {
      const res = await apiClient.get("/wallet");

      const data = res.data;

      if (!data) {
        throw new Error("Wallet data not found");
      }

      // Supports either:
      // { wallet: {...} }
      // or directly {...}
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

export interface User {
  id: string;
  telegram_id: number;
  username: string;
  created_at: string;
  updated_at: string;
  Fname: string;
  Lname: string;
  referral_id: string;
  wallets: Wallet;
  phone: string | null;
}

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
      if (state.user) {
        state.user.wallets = {
          ...state.user.wallets,
          ...action.payload,
        };
      }
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
