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


export default function App() {
  const dispatch = useAppDispatch()
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        await dispatch(initAuth()).unwrap();
        connectSocket(); // ✅ init once
      } catch (err) {
        console.error("Init failed", err);
      } finally {
        setReady(true);
      }
    }

    init();
  }, [dispatch]);

  if (!ready) return null

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Mainlayout />}>
          <Route index element={<Game />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/invite" element={<Invite />} />
        </Route>
        <Route path="/connectfour" element={<ConnectFourMatchmaking />} />
        <Route path="/connectfour/:roomId" element={<ConnectFour />} />
        <Route path="/jetxpick" element={<Jetx />} />
        <Route path="/memoryflip" element={<MemoryFlip />} />
        <Route path="/minesduel" element={<MinesDuel />} />
        <Route path="/carddraw" element={<CardDrawMatchmaking />} />
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
