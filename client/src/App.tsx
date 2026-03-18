import React from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Game from './pages/player/Game'
import Invite from './pages/player/Invite'
import Mainlayout from './layout/Mainlayout'
import Profile from './pages/player/Profile'
import ConnectFour from './pages/game/ConnectFour'
import { socket } from './lib/socket'
import MatchMaking from './pages/game/MatchMaking'

export default function App() {
   
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Mainlayout />}>
          <Route index element={<Game />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/invite" element={<Invite />} />
        </Route>
        <Route path="/connectfour" element={<MatchMaking />} />
         <Route path="/connectfour/:roomId" element={<ConnectFour />} />
      </Routes>

    </BrowserRouter>
  )
}
