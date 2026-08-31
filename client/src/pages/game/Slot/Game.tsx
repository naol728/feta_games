/* eslint-disable */

import React from "react"
import SlotColumn from "./SlotColumn"
import { type SlotProps } from "./Types"

import bottomBar from "/images/bottombar.webp"
import Sidebar from "/images/sidebar.webp"
import bar from "/images/bar.webp"

interface SlotMachineProps {
    grid: string[]
    isSpinning: boolean
    data: SlotProps | null
    winningLines: any[]
    loadedImages: number
    setLoadedImages: (value: number) => void
}

const Game: React.FC<SlotMachineProps> = ({
    grid,
    isSpinning,
    data,
    winningLines,
    loadedImages,
    setLoadedImages,
}) => {
    /*
     * ============================================
     * RESPONSIVE SLOT SIZE
     * ============================================
     *
     * The machine always shows EXACTLY 3 rows.
     *
     * Small Telegram viewport  -> ~58px row
     * Normal mobile             -> ~65-70px
     * Larger viewport            -> max 78px
     */
    const rowSize = "clamp(58px, 19vw, 78px)"

    /*
     * Exactly 3 rows.
     */
    const machineHeight = "calc(3 * var(--slot-row))"

    const handleImageLoad = () => {
        setLoadedImages(loadedImages + 1)
    }

    /*
     * ============================================
     * SIDEBAR
     * ============================================
     */
    const renderSidebar = (index: number) => {
        return (
            <img
                src={Sidebar}
                alt="slot sidebar"
                draggable={false}
                onLoad={handleImageLoad}
                className={`
          block
          shrink-0
          h-[var(--machine-height)]
          w-[clamp(7px,1.8vw,14px)]
          object-fill
          ${index === 1 ? "scale-x-[-1]" : ""}
        `}
            />
        )
    }

    /*
     * ============================================
     * TOP / BOTTOM DECORATIVE BAR
     * ============================================
     */
    const renderBottomBar = (index: number) => {
        return (
            <img
                src={bottomBar}
                alt="slot bottom bar"
                draggable={false}
                onLoad={handleImageLoad}
                className={`
          block
          w-full
          max-w-[390px]
          aspect-[539/7]
          object-fill
          z-10
          ${index === 0 ? "scale-y-[-1]" : ""}
        `}
            />
        )
    }

    return (
        <div
            className="
        mx-auto
        flex
        w-full
        max-w-[430px]
        flex-col
        items-center
        justify-center
        overflow-hidden
      "
            style={
                {
                    "--slot-row": rowSize,
                    "--machine-height": machineHeight,
                } as React.CSSProperties
            }
        >

            {/* ==========================================
          TOP DECORATION
      ========================================== */}
            {renderBottomBar(0)}

            {/* ==========================================
          SLOT MACHINE BODY
      ========================================== */}
            <div
                className="
          flex
          w-full
          items-stretch
          justify-center
        "
                style={{
                    height: machineHeight,
                }}
            >

                {/* LEFT FRAME */}
                {renderSidebar(0)}

                {/* ========================================
            3 REELS
        ======================================== */}
                <div
                    className="
            relative
            flex
            min-w-0
            flex-1
            overflow-hidden
            bg-background
          "
                    style={{
                        height: machineHeight,
                    }}
                >

                    {/* Subtle inner background */}
                    <div
                        className="
              pointer-events-none
              absolute
              inset-0
              z-20
              bg-gradient-to-b
              from-black/5
              via-transparent
              to-black/10
            "
                    />

                    {[
                        {
                            line: [0, 3, 6],
                        },
                        {
                            line: [1, 4, 7],
                        },
                        {
                            line: [2, 5, 8],
                        },
                    ].map((line, index) => (
                        <div
                            key={index}
                            className="
                relative
                flex
                min-w-0
                flex-1
                basis-0
              "
                            style={{
                                height: machineHeight,
                            }}
                        >

                            <SlotColumn
                                symbols={[
                                    grid[line.line[0]],
                                    grid[line.line[1]],
                                    grid[line.line[2]],
                                ]}
                                isSpinning={isSpinning}
                                position={index}
                                winningLines={winningLines}
                            />

                            {/* REEL DIVIDER */}
                            {index !== 2 && (
                                <img
                                    src={bar}
                                    alt="slot divider"
                                    draggable={false}
                                    onLoad={handleImageLoad}
                                    className={`
                    pointer-events-none
                    absolute
                    right-0
                    top-0
                    z-30
                    h-[var(--machine-height)]
                    w-[clamp(3px,0.8vw,7px)]
                    object-fill
                    ${index === 0 ? "scale-x-[-1]" : ""}
                  `}
                                />
                            )}

                        </div>
                    ))}

                    {/* ========================================
              TOP / BOTTOM SHADING
          ======================================== */}
                    <div
                        className="
              pointer-events-none
              absolute
              inset-x-0
              top-0
              z-20
              h-3
              bg-gradient-to-b
              from-black/20
              to-transparent
            "
                    />

                    <div
                        className="
              pointer-events-none
              absolute
              inset-x-0
              bottom-0
              z-20
              h-3
              bg-gradient-to-t
              from-black/20
              to-transparent
            "
                    />

                </div>

                {/* RIGHT FRAME */}
                {renderSidebar(1)}

            </div>

            {/* ==========================================
          BOTTOM DECORATION
      ========================================== */}
            {renderBottomBar(1)}

            {/* ==========================================
          WIN / PAYOUT DISPLAY
      ========================================== */}
            <div
                className="
          w-full
          bg-primary
          px-1
          py-1
          text-primary-foreground
        "
            >
                <div
                    className="
            flex
            min-h-[42px]
            w-full
            items-center
            justify-center
            rounded-full
            border-2
            border-primary-foreground/40
            px-3
            text-center
            text-xs
            font-bold
            sm:min-h-[48px]
            sm:text-sm
          "
                    style={{
                        boxShadow:
                            "inset 0 0 10px rgba(0,0,0,0.45)",
                    }}
                >
                    {data?.totalPayout &&
                        data.totalPayout > 0 &&
                        !isSpinning
                        ? `Won ${new Intl.NumberFormat("en-US", {
                            style: "currency",
                            currency: "ETB",
                            minimumFractionDigits: 0,
                        })
                            .format(data.totalPayout)
                            .replace("DOL", "ETB")}`
                        : ""}
                </div>
            </div>

        </div>
    )
}

export default Game