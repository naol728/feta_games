import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { User } from "../components/Types";

interface Player {
    player: User;
}

const CARD_W = 320;
const GAP = 10;
const FLIP_AT = 180;

const PlayerPreview: React.FC<Player> = ({ player }) => {
    const anchor = useRef<HTMLSpanElement | null>(null);

    const [at, setAt] = useState<{
        left: number;
        top?: number;
        bottom?: number;
    } | null>(null);

    useLayoutEffect(() => {
        let host: HTMLElement | null =
            anchor.current?.parentElement || null;

        while (
            host &&
            host.getBoundingClientRect().width === 0
        ) {
            host = host.parentElement;
        }

        const box = host?.getBoundingClientRect();

        if (!box) return;

        const wide = Math.min(
            CARD_W,
            window.innerWidth - 16
        );

        const left = Math.min(
            Math.max(
                8,
                box.left +
                box.width / 2 -
                wide / 2
            ),
            window.innerWidth -
            wide -
            8
        );

        setAt(
            box.top < FLIP_AT
                ? {
                    left,
                    top: box.bottom + GAP,
                }
                : {
                    left,
                    bottom:
                        window.innerHeight -
                        box.top +
                        GAP,
                }
        );
    }, []);

    const fullName =
        `${player.Fname || ""} ${player.Lname || ""}`.trim();

    const displayName =
        fullName || player.username || "Player";

    const username =
        player.username
            ? `@${player.username}`
            : "Telegram player";

    const avatarLetter =
        (
            player.Fname?.[0] ||
            player.username?.[0] ||
            "?"
        ).toUpperCase();

    const balance =
        Number(player.wallets?.balance || 0);

    const lockedBalance =
        Number(
            player.wallets?.locked_balance || 0
        );

    const card = (
        <div
            style={{
                ...at,
                width: CARD_W,
                maxWidth: "calc(100vw - 16px)",
            }}
            className="
        fixed
        z-[140]
        pointer-events-none
        overflow-hidden
        rounded-2xl
        border
        border-border
        bg-card
        shadow-2xl
      "
        >
            {/* Header */}

            <div
                className="
          flex
          items-center
          gap-3
          border-b
          border-border
          bg-muted/30
          p-4
        "
            >
                {/* Avatar */}

                <div
                    className="
            flex
            h-12
            w-12
            shrink-0
            items-center
            justify-center
            rounded-full
            bg-primary
            text-lg
            font-bold
            text-primary-foreground
          "
                >
                    {avatarLetter}
                </div>

                {/* User information */}

                <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-foreground">
                        {displayName}
                    </div>

                    <div className="truncate text-xs text-muted-foreground">
                        {username}
                    </div>
                </div>
            </div>

            {/* Account information */}

            <div className="grid grid-cols-2 gap-2 p-3">
                {/* Balance */}

                <div
                    className="
            rounded-xl
            border
            border-border
            bg-background
            p-3
          "
                >
                    <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Balance
                    </div>

                    <div className="mt-1 truncate text-sm font-bold text-foreground">
                        {balance.toLocaleString()}
                    </div>
                </div>

                {/* Locked balance */}

                <div
                    className="
            rounded-xl
            border
            border-border
            bg-background
            p-3
          "
                >
                    <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Locked
                    </div>

                    <div className="mt-1 truncate text-sm font-bold text-foreground">
                        {lockedBalance.toLocaleString()}
                    </div>
                </div>
            </div>

            {/* Telegram ID */}

            <div className="px-3 pb-3">
                <div
                    className="
            flex
            items-center
            justify-between
            rounded-xl
            bg-muted/40
            px-3
            py-2
          "
                >
                    <span className="text-[10px] text-muted-foreground">
                        Telegram ID
                    </span>

                    <span className="text-xs font-semibold text-foreground">
                        {player.telegram_id}
                    </span>
                </div>
            </div>
        </div>
    );

    return (
        <>
            <span
                ref={anchor}
                className="block h-0 w-0"
            />

            {at &&
                createPortal(
                    card,
                    document.body
                )}
        </>
    );
};

export default PlayerPreview;