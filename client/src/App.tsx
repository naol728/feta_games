import React from "react";
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

export default function App() {
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
    </BrowserRouter>
  );
}
