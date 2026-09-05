import { getSocket } from "@/lib/socket";
import { store } from "@/store/store";
import { setUserWallet } from "@/store/slice/auth";

export function registerSocketListeners() {
  const socket = getSocket();

  if (!socket) return;

  socket.on("balance:update", (wallet) => {
    const currentUser = store.getState().auth.user;

    if (!currentUser) return;

    store.dispatch(
      setUserWallet({
        balance: wallet.balance,
        locked_balance: wallet.locked_balance,
        available_balance: wallet.available_balance,
        withdrawable_balance: wallet.withdrawable_balance,
      }),
    );
  });
}
