import React from 'react'
import TopBar from './TopBar'
import { Outlet } from 'react-router-dom'

export default function MatchMakingLayout() {
    return (
        <div className="flex min-h-screen flex-col bg-background max-w-md mx-auto">

            {/* Top Bar */}
            <header className="sticky top-0 z-50">
                <TopBar showBack showDeposit={false} />
            </header>

            {/* Content */}
            <main className="flex-1 overflow-y-auto ">
                <Outlet />
            </main>


        </div>
    )
}
