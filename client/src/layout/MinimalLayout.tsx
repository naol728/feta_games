import React from 'react'
import { Outlet } from 'react-router-dom';
import TopBar from './TopBar';

export default function MinimalLayout() {
    return (
        <div className="flex min-h-screen flex-col bg-background max-w-md mx-auto">

            <header className="sticky top-0 z-50">
                <TopBar showBack title="Deposit" />
            </header>

            <main className="flex-1 overflow-y-auto">
                <Outlet />
            </main>

        </div>
    );
}
