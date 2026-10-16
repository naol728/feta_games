/* eslint-disable */
// @ts-nocheck
import { useEffect, useRef } from "react";

import { draw_dot, getDistance_between_entities } from "./game";
import {
    pocketFromNumber,
    type Pocket,
    type SpinParams,
    type TableType,
} from "./rouletteLogic";

// ============================================================
// Props
// ============================================================
interface RouletteGameProps {
    tableType: TableType;
    width: number;
    /** Set to a new object to start a spin. */
    spin: SpinParams | null;
    onSpinEnd: (winning: Pocket) => void;
}

// ============================================================
// Wheel engine
// ============================================================
class RouletteWheelEngine {
    private ctx!: CanvasRenderingContext2D;

    private roulette_radius_x = 240;
    private roulette_radius_y = 240;
    private numbers: string[] = [];
    private colors: string[] = [];
    private startAngle = -1.65;
    private startAngle01 = 0;
    private outsideRadius = 200;
    private textRadius = 180;
    private insideRadius = 170;
    private roulettePos: { x: number; y: number; nr: string; color: string; h: number; w: number }[] = [];

    private circle = { radius: 130, angle: 0 };
    private ball = { x: 70, y: 170, speed: 0.05, width: 10 };

    private font_bold_10 = "bold 10px sans-serif";
    private font_bold_12 = "bold 12px sans-serif";
    private font_bold_14 = "bold 14px sans-serif";

    private spin_clear: [number, number, number, number] = [0, 0, 0, 0];
    private radiantLine01: number[] = [];
    private radiantLine02: number[] = [];
    private radiantLine03: number[] = [];

    private rafId: number | null = null;
    private forced: string | null = null;
    private onEnd: ((p: Pocket) => void) | null = null;

    constructor(
        private readonly canvas: HTMLCanvasElement,
        private tableType: TableType,
    ) { }

    get busy(): boolean {
        return this.rafId !== null;
    }

    ready(): void {
        this.redraw();
    }

    redraw(tableType?: TableType): void {
        if (tableType) this.tableType = tableType;
        this.createCanvas();
        this.chooseRouletteType();
        this.start();
    }

    private createCanvas(): void {
        this.ctx = this.canvas.getContext("2d") as CanvasRenderingContext2D;
        const containerWidth = this.canvas.parentElement?.clientWidth ?? window.innerWidth;

        if (window.innerWidth < 960) {
            if (window.innerHeight < window.innerWidth) {
                this.canvas.width = 260;
                this.canvas.height = 260;
                this.roulette_radius_x = 135;
                this.roulette_radius_y = 135;
                this.outsideRadius = 110;
            } else {
                const side = Math.min(280, Math.max(220, containerWidth - 24));
                this.canvas.width = side;
                this.canvas.height = side;
                this.roulette_radius_x = side / 2;
                this.roulette_radius_y = side / 2;
                this.outsideRadius = side * 0.4;
            }
            this.textRadius = this.outsideRadius - 15;
            this.insideRadius = this.outsideRadius - 20;
            this.radiantLine01 = [-65, 15];
            this.radiantLine02 = [-105, -35];
            this.radiantLine03 = [-105, -85];
            this.circle = { radius: this.textRadius - 15, angle: 0 };
            this.ball = { x: 70, y: this.roulette_radius_x, speed: 0.05, width: 6 };
            this.font_bold_10 = "bold 8px sans-serif";
            this.font_bold_12 = "bold 10px sans-serif";
            this.font_bold_14 = "bold 12px sans-serif";
        } else {
            this.canvas.width = 480;
            this.canvas.height = 480;
            this.roulette_radius_x = this.canvas.width / 2;
            this.roulette_radius_y = 240;
            this.outsideRadius = 200;
            this.textRadius = this.outsideRadius - 20;
            this.insideRadius = this.outsideRadius - 30;
            this.circle = { radius: this.textRadius - 22, angle: 0 };
            this.ball = { x: 70, y: this.roulette_radius_x, speed: 0.05, width: 10 };
            this.font_bold_10 = "bold 10px sans-serif";
            this.font_bold_12 = "bold 12px sans-serif";
            this.font_bold_14 = "bold 14px sans-serif";
            this.radiantLine01 = [-60, 20];
            this.radiantLine02 = [-60, -160];
            this.radiantLine03 = [-160, -200];
        }

        this.canvas.style.maxWidth = "100%";
        this.canvas.style.height = "auto";
        this.canvas.style.display = "block";
        this.spin_clear = [0, 0, this.canvas.width, this.canvas.height];
    }

    private chooseRouletteType(): void {
        this.numbers =
            this.tableType === "european"
                ? ["0", "32", "15", "19", "4", "21", "2", "25", "17", "34", "6", "27", "13", "36", "11", "30", "8", "23", "10", "5", "24", "16", "33", "1", "20", "14", "31", "9", "22", "18", "29", "7", "28", "12", "35", "3", "26"]
                : ["0", "28", "9", "26", "30", "11", "7", "20", "32", "17", "5", "22", "34", "15", "3", "24", "36", "13", "1", "00", "27", "10", "25", "29", "12", "8", "19", "31", "18", "6", "21", "33", "16", "4", "23", "35", "14", "2"];
        this.colors = this.numbers.map((n) => pocketFromNumber(n).color);
    }

    private start(): void {
        if (!this.ctx) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.font = this.font_bold_10;
        this.ctx.shadowColor = "black";
        this.ctx.shadowOffsetX = 0;
        this.ctx.shadowOffsetY = 0;
        this.drawRoulette();
        this.ctx.font = this.font_bold_14;
    }

    private drawRoulette(): void {
        this.roulettePos = [];

        this.ctx.shadowBlur = 10;
        draw_dot(this.ctx, this.roulette_radius_x, this.roulette_radius_y, this.outsideRadius * 1.05, 0, 2 * Math.PI, false, "#a87b51", 15, "#5e391c");
        draw_dot(this.ctx, this.roulette_radius_x, this.roulette_radius_y, this.outsideRadius * 0.97, 0, 2 * Math.PI, false, "black", 15, "black");
        this.ctx.shadowBlur = 0;

        this.ctx.font = this.font_bold_12;
        this.drawHoles(this.outsideRadius, this.insideRadius, this.numbers.length, this.colors, true, this.startAngle);
        this.ctx.font = this.font_bold_14;
        this.drawHoles(this.insideRadius - 1, this.insideRadius * 0.7, this.numbers.length, "dark", false, this.startAngle);

        this.radiantLine(this.numbers.length, 1, "gold", this.radiantLine01, this.startAngle);

        this.drawHoles(this.insideRadius * 0.7 - 1, 0, 12, "grey", false, this.startAngle01);
        this.radiantLine(12, 1, "#4d4d4d", this.radiantLine02, this.startAngle01);

        this.drawHoles(20, 0, 8, "gold", false, this.startAngle01);
        this.radiantLine(8, 1, "#b99813", this.radiantLine03, this.startAngle01);
    }

    private drawHoles(
        outsideRadius: number,
        insideRadius: number,
        how_many: number,
        colors: string[] | "grey" | "gold" | "dark",
        show: boolean,
        startAngle: number,
    ): void {
        const space = outsideRadius - insideRadius;
        for (let i = 0; i < how_many; i++) {
            const arc = Math.PI / (how_many / 2);
            const angle = startAngle + i * arc;

            this.ctx.beginPath();
            this.ctx.arc(this.roulette_radius_x, this.roulette_radius_y, outsideRadius, angle, angle + arc, false);
            this.ctx.arc(this.roulette_radius_x, this.roulette_radius_y, insideRadius, angle + arc, angle, true);

            if (colors === "grey") this.ctx.fillStyle = i % 2 === 0 ? "gray" : "#999";
            else if (colors === "gold") this.ctx.fillStyle = i % 2 === 0 ? "#f0d875" : "#eac739";
            else if (colors === "dark") {
                if (this.tableType === "european") {
                    this.ctx.fillStyle = i === 0 ? "darkgreen" : i % 2 === 0 ? "black" : "darkred";
                } else {
                    this.ctx.fillStyle = i === 0 || i === 19 ? "darkgreen" : i % 2 === 0 ? "darkred" : "black";
                }
            } else this.ctx.fillStyle = colors[i];

            this.ctx.fill();
            this.ctx.save();

            const radius = this.textRadius - 2 * this.ball.width;
            const sliceX = this.roulette_radius_x + Math.cos(angle + arc / 2) * this.textRadius;
            const sliceY = this.roulette_radius_y + Math.sin(angle + arc / 2) * this.textRadius;
            const slicePosX = this.roulette_radius_x + Math.cos(angle + arc / 2) * radius;
            const slicePosY = this.roulette_radius_y + Math.sin(angle + arc / 2) * radius;
            const w = 2 * radius * Math.sin(arc / 2);

            if (show) {
                this.ctx.fillStyle = "white";
                this.ctx.translate(sliceX, sliceY);
                this.ctx.rotate(angle + arc / 2 + Math.PI / 2);
                const text = this.numbers[i];
                this.ctx.fillText(text, -this.ctx.measureText(text).width / 2, 0);
                this.roulettePos.push({
                    x: slicePosX,
                    y: slicePosY,
                    nr: text,
                    color: Array.isArray(colors) ? colors[i] : "",
                    h: space,
                    w,
                });
            }

            this.ctx.restore();
            this.ctx.closePath();
        }
    }

    private radiantLine(how_many: number, line: number, color: string, offset: number[], startAngle: number): void {
        for (let i = 0; i < how_many; i++) {
            const arc = Math.PI / (how_many / 2);
            const angle = startAngle + i * arc;
            this.ctx.beginPath();
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = line;
            this.ctx.moveTo(
                this.roulette_radius_x + Math.cos(angle + arc) * (this.textRadius + offset[0]),
                this.roulette_radius_y + Math.sin(angle + arc) * (this.textRadius + offset[0]),
            );
            this.ctx.lineTo(
                this.roulette_radius_x + Math.cos(angle + arc) * (this.textRadius + offset[1]),
                this.roulette_radius_y + Math.sin(angle + arc) * (this.textRadius + offset[1]),
            );
            this.ctx.stroke();
            this.ctx.closePath();
        }
    }

    private closestIndex(): number {
        let closest = Infinity;
        let index = 0;
        for (let i = 0; i < this.roulettePos.length; i++) {
            const d = getDistance_between_entities(this.ball, this.roulettePos[i]);
            if (d < closest) {
                closest = d;
                index = i;
            }
        }
        return index;
    }

    spin(p: SpinParams, onEnd: (pocket: Pocket) => void): void {
        if (!this.ctx) return;
        this.cancel(); // never run two spins at once

        this.onEnd = onEnd;
        this.forced = p.monkey !== undefined && p.monkey !== null ? String(p.monkey) : null;
        this.ball.speed = p.ball_speed;
        this.circle.angle = 0;

        const arc = p.arc;
        const spinTime = p.spin_time;
        const extra = 200;
        const forcedWait = 200;
        let n = 0;

        const step = () => {
            this.ctx.clearRect(...this.spin_clear);

            if (n > spinTime + extra) {
                this.rafId = null;
                this.endSpin();
                return;
            }

            if (n > spinTime) {
                n++;
                this.rotateWheel(arc - 0.04);
                const w = this.roulettePos[this.closestIndex()];
                this.circle.angle -= arc - 0.04;
                this.rotateBall(w.x, w.y);
            } else {
                n++;
                if (n <= spinTime / 2) {
                    this.rotateWheel(arc);
                    this.circle.angle += this.ball.speed;
                } else if (n <= (2 * spinTime) / 3) {
                    this.rotateWheel(arc - 0.01);
                    this.circle.angle += this.ball.speed - 0.01;
                } else if (n <= (5 * spinTime) / 6) {
                    this.rotateWheel(arc - 0.02);
                    this.circle.angle += this.ball.speed - 0.02;
                } else if (n <= spinTime - 20) {
                    this.rotateWheel(arc - 0.03);
                    this.circle.angle += this.ball.speed - 0.03;
                } else if (n <= spinTime - 10) {
                    this.rotateWheel(arc - 0.04);
                    this.circle.angle += this.ball.speed - 0.04;
                }

                if (this.forced !== null) {
                    const w = this.roulettePos[this.closestIndex()];
                    if (w.nr === this.forced && n > spinTime - forcedWait) {
                        this.rotateBall(w.x, w.y);
                        n = spinTime + 1; // start the wind-down
                    } else {
                        this.rotateBall(this.ball.x, this.ball.y);
                    }
                } else {
                    this.rotateBall(this.ball.x, this.ball.y);
                }
            }

            this.rafId = window.requestAnimationFrame(step);
        };

        this.rafId = window.requestAnimationFrame(step);
    }

    private endSpin(): void {
        this.drawRoulette();
        // If the server named a number, land exactly on it even if the
        // physics-ish animation drifted to a neighbour.
        const forcedPos =
            this.forced !== null ? this.roulettePos.find((p) => p.nr === this.forced) : undefined;
        const target = forcedPos ?? this.roulettePos[this.closestIndex()];
        this.rotateBall(target.x, target.y);

        const cb = this.onEnd;
        this.onEnd = null;
        cb?.(pocketFromNumber(target.nr));
    }

    private rotateWheel(x: number): void {
        this.startAngle += x;
        this.startAngle01 += x;
        this.ball.y = this.roulette_radius_y + Math.cos(this.circle.angle) * this.circle.radius;
        this.ball.x = this.roulette_radius_x + Math.sin(this.circle.angle) * this.circle.radius;
    }

    private rotateBall(a: number, b: number): void {
        this.drawRoulette();
        this.ctx.font = this.font_bold_14;
        draw_dot(this.ctx, a, b, this.ball.width, 0, 2 * Math.PI, false, "white", 1, "grey");
    }

    private cancel(): void {
        if (this.rafId !== null) {
            window.cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    }

    destroy(): void {
        this.cancel();
        this.onEnd = null;
    }
}

// ============================================================
// Component
// ============================================================
export default function RouletteGame({ tableType, width, spin, onSpinEnd }: RouletteGameProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<RouletteWheelEngine | null>(null);

    // Always call the latest callback without re-triggering the spin.
    const endRef = useRef(onSpinEnd);
    useEffect(() => {
        endRef.current = onSpinEnd;
    });

    // Create the engine once.
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const engine = new RouletteWheelEngine(canvas, tableType);
        engine.ready();
        engineRef.current = engine;
        return () => {
            engine.destroy();
            engineRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Redraw on table-type / viewport change (never mid-spin).
    useEffect(() => {
        const engine = engineRef.current;
        if (!engine || engine.busy) return;
        engine.redraw(tableType);
    }, [tableType, width]);

    // Start a spin whenever a new SpinParams object arrives.
    useEffect(() => {
        if (!spin) return;
        engineRef.current?.spin(spin, (pocket) => endRef.current(pocket));
    }, [spin]);

    return (
        <div className="game_box relative flex w-full items-center justify-center">
            <canvas
                ref={canvasRef}
                id="roulette_canvas"
                className="max-w-full select-none"
                style={{ touchAction: "manipulation" }}
            />
        </div>
    );
}