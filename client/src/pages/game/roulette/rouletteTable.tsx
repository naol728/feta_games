import { useEffect, useRef } from "react";

import { getMousePos, isInside, type BetSlot } from "./game";
import type { TableType } from "./rouletteLogic";

// ============================================================
// Props
// ============================================================
interface RouletteTableProps {
    images: (HTMLImageElement | null)[];
    tokenImages: (HTMLImageElement | null)[];
    tableType: TableType;
    width: number;
    /** spot text -> total chips on that spot (owned by the parent reducer) */
    bets: Record<string, number>;
    disabled?: boolean;
    onSpotClick: (text: string) => void;
}

// ============================================================
// Layout + drawing
// ============================================================
interface Layout {
    canvasW: number;
    canvasH: number;
    coords: number[];
    small: boolean;
    square: number;
    spots: BetSlot[];
}

const COLORS = ["red", "black", "red", "black", "red", "black", "red", "black", "red", "black", "black", "red", "black", "red", "black", "red", "black", "red", "red", "black", "red", "black", "red", "black", "red", "black", "red", "black", "black", "red", "black", "red", "black", "red", "black", "red"];

type Sq = { x: number; y: number; w: number; h: number };
interface Squares {
    a: Sq;
    b?: Sq;
    c: Sq;
    d: Sq;
    e: Sq;
    f: Sq;
}

function buildLayout(tableType: TableType): Layout {
    const american = tableType === "american";
    const k = american ? 1 : 0;
    const count = american ? 38 : 37;

    let canvasW = 795;
    let canvasH = 270;
    let coords = [0, 0, 795, 268, 0, 0, 795, 268];
    let small = false;
    let square = 40;
    let s: Squares;

    if (window.innerWidth < 960) {
        square = 30;
        if (window.innerHeight < window.innerWidth) {
            // landscape phone
            canvasW = 400;
            canvasH = 135;
            coords = [0, 0, 795, 268, 0, 0, 400, 135];
            s = american
                ? { a: { x: 0, y: 0, w: 27, h: 40 }, b: { x: 0, y: 40, w: 27, h: 40 }, c: { x: 26, y: 80, w: 27, h: 27 }, d: { x: 27, y: 80, w: 106, h: 27 }, e: { x: 27, y: 110, w: 53, h: 27 }, f: { x: 345, y: 0, w: 53, h: 27 } }
                : { a: { x: 0, y: 0, w: 27, h: 78 }, c: { x: 26, y: 80, w: 27, h: 27 }, d: { x: 27, y: 80, w: 106, h: 27 }, e: { x: 27, y: 110, w: 53, h: 27 }, f: { x: 345, y: 0, w: 53, h: 27 } };
        } else {
            // portrait phone (vertical table)
            canvasW = 135;
            canvasH = 400;
            small = true;
            coords = [0, 0, 382, 1136, 0, 0, 191, 568];
            s = american
                ? { a: { x: 53, y: 0, w: 40, h: 27 }, b: { x: 93, y: 0, w: 40, h: 27 }, c: { x: 27, y: 27, w: 27, h: 26 }, d: { x: 27, y: 27, w: 27, h: 106 }, e: { x: 0, y: 27, w: 27, h: 53 }, f: { x: 53, y: 345, w: 27, h: 53 } }
                : { a: { x: 53, y: 0, w: 78, h: 27 }, c: { x: 27, y: 27, w: 27, h: 26 }, d: { x: 27, y: 27, w: 27, h: 106 }, e: { x: 0, y: 27, w: 27, h: 53 }, f: { x: 53, y: 345, w: 27, h: 53 } };
        }
    } else {
        s = american
            ? { a: { x: 0, y: 0, w: 53, h: 80 }, b: { x: 0, y: 80, w: 53, h: 80 }, c: { x: 50, y: 160, w: 53, h: 57 }, d: { x: 50, y: 160, w: 212, h: 57 }, e: { x: 50, y: 212, w: 106, h: 57 }, f: { x: 685, y: 0, w: 106, h: 53 } }
            : { a: { x: 0, y: 0, w: 53, h: 160 }, c: { x: 50, y: 160, w: 53, h: 57 }, d: { x: 50, y: 160, w: 212, h: 57 }, e: { x: 50, y: 212, w: 106, h: 57 }, f: { x: 685, y: 0, w: 106, h: 53 } };
    }

    const spots: BetSlot[] = [];
    const push = (q: Sq, color: string, text: string) =>
        spots.push({ x: q.x, y: q.y, width: q.w, height: q.h, color, text, bet_value: 1 });

    push(s.a, "green", "0");
    if (s.b) push(s.b, "green", "00");

    // numbers 1..36 (zig-zag through the 3 rows / columns)
    const c = { ...s.c };
    let a = 0;
    for (let i = 1; i < count - k; i++) {
        a++;
        if (!small) {
            if (a > 3) {
                c.x += c.w;
                c.y += 2 * c.w;
                a = 1;
            } else {
                c.y -= c.w;
            }
        } else if (a > 3) {
            c.x -= 2 * c.w;
            c.y += c.h;
            a = 1;
        } else {
            c.x += c.w;
        }
        push(c, COLORS[i - 1], String(i));
    }

    const eLabels = ["1-18", "Even", "reds", "blacks", "Odd", "19-36"];
    const fLabels = ["2 to 1a", "2 to 1b", "2 to 1c"];

    for (let d = 0; d < 3; d++) {
        push(
            small
                ? { x: s.d.x, y: d * s.d.h + s.d.y, w: s.d.w, h: s.d.h }
                : { x: d * s.d.w + s.d.x, y: s.d.y, w: s.d.w, h: s.d.h },
            "",
            `${d + 1}st 12`,
        );
    }
    for (let e = 0; e < 6; e++) {
        push(
            small
                ? { x: s.e.x, y: e * s.e.h + s.e.y, w: s.e.w, h: s.e.h }
                : { x: e * s.e.w + s.e.x, y: s.e.y, w: s.e.w, h: s.e.h },
            "",
            eLabels[e],
        );
    }
    for (let f = 0; f < 3; f++) {
        push(
            small
                ? { x: f * s.f.w + s.f.x, y: s.f.y, w: s.f.w, h: s.f.h }
                : { x: s.f.x, y: f * s.f.h + s.f.y, w: s.f.w, h: s.f.h },
            "",
            fLabels[f],
        );
    }

    return { canvasW, canvasH, coords, small, square, spots };
}

function draw(
    canvas: HTMLCanvasElement,
    layout: Layout,
    tableType: TableType,
    images: (HTMLImageElement | null)[],
    token: HTMLImageElement | null,
    bets: Record<string, number>,
) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const american = tableType === "american";
    const img = american
        ? layout.small ? images[3] : images[2]
        : layout.small ? images[1] : images[0];

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (img) {
        const [sx, sy, sw, sh, x, y, w, h] = layout.coords;
        ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
    }

    for (const spot of layout.spots) {
        const amount = bets[spot.text];
        if (!amount) continue;

        const cx = spot.x + spot.width / 2;
        const cy = spot.y + spot.height / 2;

        if (token) {
            const w = layout.square / 2;
            const h = layout.square / 2 + 10;
            ctx.drawImage(token, cx - w / 2, cy - h / 2 - 3, w, h);
        }

        // chip total badge
        const label = String(amount);
        ctx.font = `bold ${layout.small ? 8 : 10}px sans-serif`;
        const tw = ctx.measureText(label).width;
        const bw = tw + 6;
        const bh = layout.small ? 11 : 13;
        const bx = cx - bw / 2;
        const by = cy + layout.square / 4;
        ctx.fillStyle = "rgba(0,0,0,0.78)";
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, 4);
        ctx.fill();
        ctx.fillStyle = "#fbbf24";
        ctx.textBaseline = "middle";
        ctx.fillText(label, bx + 3, by + bh / 2 + 0.5);
        ctx.textBaseline = "alphabetic";
    }
}

// ============================================================
// Component
// ============================================================
export default function RouletteTable({
    images,
    tokenImages,
    tableType,
    width,
    bets,
    disabled,
    onSpotClick,
}: RouletteTableProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const layoutRef = useRef<Layout | null>(null);

    // Always call the latest handlers from the click listener.
    const clickRef = useRef(onSpotClick);
    const disabledRef = useRef(disabled);
    useEffect(() => {
        clickRef.current = onSpotClick;
        disabledRef.current = disabled;
    });

    // (Re)build layout + size the canvas on mount / table / viewport change.
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const layout = buildLayout(tableType);
        layoutRef.current = layout;
        canvas.width = layout.canvasW;
        canvas.height = layout.canvasH;
        draw(canvas, layout, tableType, images, tokenImages[0] ?? null, bets);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tableType, width, images, tokenImages]);

    // Redraw whenever bets change.
    useEffect(() => {
        const canvas = canvasRef.current;
        const layout = layoutRef.current;
        if (!canvas || !layout) return;
        draw(canvas, layout, tableType, images, tokenImages[0] ?? null, bets);
    }, [bets, tableType, images, tokenImages]);

    // Click → find the spot (canvas may be CSS-scaled, so map coordinates).
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const onClick = (event: MouseEvent) => {
            const layout = layoutRef.current;
            if (!layout || disabledRef.current) return;
            const raw = getMousePos(canvas, event);
            const rect = canvas.getBoundingClientRect();
            const pos = {
                x: raw.x * (canvas.width / rect.width),
                y: raw.y * (canvas.height / rect.height),
            };
            // Last match wins (outside bets are drawn over number cells' edges).
            let hit: BetSlot | null = null;
            for (const spot of layout.spots) {
                if (isInside(pos, spot)) hit = spot;
            }
            if (hit) clickRef.current(hit.text);
        };
        canvas.addEventListener("click", onClick);
        return () => canvas.removeEventListener("click", onClick);
    }, []);

    return (
        <canvas
            ref={canvasRef}
            id="roulette_bets_canvas"
            className={disabled ? "opacity-60" : ""}
            style={{ maxWidth: "100%", height: "auto", display: "block", margin: "0 auto" }}
        />
    );
}