import React, { useEffect, useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Game from "./pages/player/Game";
import Invite from "./pages/player/Invite";
import Mainlayout from "./layout/Mainlayout";
import Profile from "./pages/player/Profile";
import ConnectFour from "./pages/game/connectfour/ConnectFour";
import ConnectFourMatchmaking from "./pages/game/connectfour/ConnectFourMatchmaking";
import Jetx from "./pages/game/Jetx/Jetx";
import MemoryFlip from "./pages/game/memoryflip/MemoryFlip";
import MinesDuel from "./pages/game/minesduel/MinesDuel";
import CardDraw from "./pages/game/carddraw/CardDraw";
import CardDrawMatchmaking from "./pages/game/carddraw/CardDrawMatchmaking";
import { ToastContainer } from "react-toastify"
import { initAuth } from "./store/slice/auth";
import { useAppDispatch } from "./store/hook";
import { connectSocket } from "./lib/socket";
import { toast } from 'react-toastify';
import Deposit from "./pages/player/Deposit";
import MatchMakingLayout from "./layout/MatchMakingLayout";
import { registerSocketListeners } from "./lib/socketListeners";
import MinimalLayout from "./layout/MinimalLayout";


export default function App() {
  const dispatch = useAppDispatch();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    async function init() {
      try {
        await dispatch(initAuth()).unwrap();
        await connectSocket();
        await registerSocketListeners();
      } catch (err: unknown) {
        let message = "Initialization failed";
        if (err instanceof Error) {
          message = err.message;
        }
        toast.error(message);
      } finally {
        setReady(true);
      }
    }

    init();
  });


  if (!ready) {
    return (
      <div className="h-screen flex items-center justify-center ">
        <div className="animate-pulse text-lg">Connecting...</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Mainlayout />}>
          <Route index element={<Game />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/invite" element={<Invite />} />

        </Route>
        <Route element={<MatchMakingLayout />}>
          <Route path="/connectfour" element={<ConnectFourMatchmaking />} />
          <Route path="/carddraw" element={<CardDrawMatchmaking />} />
          <Route path="/jetxpick" element={<Jetx />} />
          <Route path="/memoryflip" element={<MemoryFlip />} />
          <Route path="/minesduel" element={<MinesDuel />} />
        </Route>

        <Route element={<MinimalLayout />}>
          <Route path="/deposit/:trxno" element={<Deposit />} />
        </Route>
        <Route path="/connectfour/:roomId" element={<ConnectFour />} />

        <Route path="/carddraw/:roomId" element={<CardDraw />} />
      </Routes>

      <ToastContainer
        position="top-center"
        autoClose={2000}
        hideProgressBar
        newestOnTop
        closeOnClick
        draggable={false}
        pauseOnHover={false}
        theme="dark"
      />
    </BrowserRouter>
  );
}
