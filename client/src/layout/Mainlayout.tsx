import React from 'react'
import { Outlet } from 'react-router-dom'
import Nav from './Nav'

export default function MainLayout() {
  return (
    <div className="relative flex h-screen flex-col bg-background">
      {/* Page Content */}
      <main className="flex-1 overflow-y-auto pb-[72px]">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <Nav />
      </nav>
    </div>
  )
}
