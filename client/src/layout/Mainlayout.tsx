import React from 'react'
import { Outlet } from 'react-router-dom'
import Nav from './Nav'
import TopBar from './TopBar'

export default function MainLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background max-w-md mx-auto">

      {/* Top Bar */}
      <header className="sticky top-0 z-50">
        <TopBar />
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto  pt-2 pb-24">
        <Outlet />
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur max-w-md mx-auto">
        <Nav />
      </nav>

    </div>
  )
}
