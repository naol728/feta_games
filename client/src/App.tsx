import React, { Suspense, useEffect, useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Game from "./pages/player/Game";
import Invite from "./pages/player/Invite";
import Mainlayout from "./layout/Mainlayout";
import Profile from "./pages/player/Profile";
// import ConnectFour from "./pages/game/connectfour/ConnectFour";
// import ConnectFourMatchmaking from "./pages/game/connectfour/ConnectFourMatchmaking";
import Jetx from "./pages/game/Jetx/Jetx";
import MemoryFlip from "./pages/game/memoryflip/MemoryFlip";
import MinesDuel from "./pages/game/minesduel/MinesDuel";
import CardDraw from "./pages/game/carddraw/CardDraw";
import CardDrawMatchmaking from "./pages/game/carddraw/CardDrawMatchmaking";
import { ToastContainer } from "react-toastify"
import { initAuth, setUser } from "./store/slice/auth";
import { useAppDispatch, useAppSelector } from "./store/hook";
import { connectSocket } from "./lib/socket";
import { toast } from 'react-toastify';
import MatchMakingLayout from "./layout/MatchMakingLayout";
import { registerSocketListeners } from "./lib/socketListeners";
import MinimalLayout from "./layout/MinimalLayout";
import Loading from "./components/layout/Loading";
import { SessionStatsProvider } from "./stats/SessionStatsContext";
import Slots from "./pages/game/Slot/Slot";
import LeaderBoard from "./pages/player/LeaderBoard";
import CrashGame from "./pages/Crash/Crash";
import PhoneNumberSetup from "./components/PhoneNumberSetup";
import Deposit from "./pages/player/Deposit";


export default function App() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user)
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
      <Loading />
    );
  }
  if (!user?.phone) {
    return <PhoneNumberSetup onComplete={(phone) => {
      if (user) {
        dispatch(
          setUser({
            ...user,
            phone,
          }),
        );
      }
    }} />
  }

  return (
    <Suspense fallback={<Loading />}>
      <SessionStatsProvider >

        <BrowserRouter>
          <Routes>
            <Route element={<Mainlayout />}>
              <Route index element={<Game />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/leaderboard" element={<LeaderBoard />} />
              <Route path="/invite" element={<Invite />} />
              <Route path="/promo" element={<Invite />} />
            </Route>
            <Route element={<MatchMakingLayout />}>
              {/* <Route path="/connectfour" element={<ConnectFourMatchmaking />} /> */}
              <Route path="/carddraw" element={<CardDrawMatchmaking />} />
              <Route path="/jetxpick" element={<Jetx />} />
              <Route path="/memoryflip" element={<MemoryFlip />} />
              <Route path="/minesduel" element={<MinesDuel />} />
              <Route path="/slot" element={<Slots />} />
              <Route path="/aviator" element={<CrashGame />} />
              <Route path="/keno" element={<Slots />} />
              <Route path="/keno" element={<Slots />} />
              <Route path="/wheel" element={<Slots />} />
              <Route path="/chicken-road" element={<Slots />} />
              <Route path="/joker-x" element={<Slots />} />
            </Route>

            <Route element={<MinimalLayout />}>
              <Route path="/deposit/:trxno" element={<Deposit />} />
            </Route>
            {/* <Route path="/connectfour/:roomId" element={<ConnectFour />} /> */}
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
      </SessionStatsProvider>
    </Suspense>
  );
}
