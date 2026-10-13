/*eslint-disable*/
import { useState, useEffect, useRef } from "react";
import { getSocket } from "@/lib/socket";
import { setUserWallet } from "@/store/slice/auth";
import { audio } from "@/service/audio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Coins,
  User,
  Landmark,
  Handshake,
  Play,
  Trophy,
  Sparkles,
  CircleHelp,
} from "lucide-react";
import { useAppSelector, useAppDispatch } from "@/store/hook";

type Side = "PLAYER" | "BANKER" | "TIE";
interface Card_ {
  rank: number;
  suit: number;
}

// Minimum time the "Dealing..." state is shown, so a fast server reply
// does not skip the animation.
const DEAL_MS = 1200;
const BET_TIMEOUT_MS = 10_000;
const GUIDE_KEY = "baccarat:hideGuide";

const SUITS = ["♠", "♥", "♦", "♣"];
const RED_SUITS = new Set([1, 2]);
const rankLabel = (r: number) =>
  r === 1 ? "A" : r === 11 ? "J" : r === 12 ? "Q" : r === 13 ? "K" : String(r);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const readHideGuide = () => {
  try {
    return localStorage.getItem(GUIDE_KEY) === "1";
  } catch {
    return false;
  }
};

function PlayingCard({ card }: { card?: Card_ }) {
  if (!card) {
    // Face-down card
    return (
      <div className="flex h-12 w-8 items-center justify-center rounded-md border border-emerald-200/20 bg-gradient-to-br from-emerald-600/50 to-emerald-800/60 text-[10px] font-black text-emerald-100/40 shadow-md sm:h-14 sm:w-10">
        ?
      </div>
    );
  }
  const red = RED_SUITS.has(card.suit);
  return (
    <div
      className={`flex h-12 w-8 flex-col items-center justify-center rounded-md border border-black/10 bg-white shadow-md animate-in fade-in zoom-in-75 sm:h-14 sm:w-10 ${red ? "text-rose-600" : "text-slate-900"
        }`}
    >
      <span className="text-[11px] font-black leading-none sm:text-xs">
        {rankLabel(card.rank)}
      </span>
      <span className="text-[11px] leading-none sm:text-xs">
        {SUITS[card.suit]}
      </span>
    </div>
  );
}

function GuideSection({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-1.5">
      <h3 className="flex items-center gap-2 text-sm font-bold">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-black text-primary-foreground">
          {step}
        </span>
        {title}
      </h3>
      <div className="space-y-1.5 pl-7 text-xs leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

function HowToPlayDialog({
  open,
  onClose,
  payouts,
  limits,
}: {
  open: boolean;
  onClose: (dontShowAgain: boolean) => void;
  payouts: Record<Side, number>;
  limits: { minBet: number; maxBet: number };
}) {
  const [dontShow, setDontShow] = useState(readHideGuide());
  const fmt = (n: number) => `${Number(n.toFixed(2))}x`;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose(dontShow)}>
      <DialogContent className="flex max-h-[88vh] w-[calc(100%-1.5rem)] max-w-md flex-col gap-0 p-0">
        <DialogHeader className="space-y-1 border-b px-4 py-3 text-left">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            How to play Baccarat
          </DialogTitle>
          <DialogDescription className="text-xs">
            Pick a side, place your bet, and see which hand gets closest to 9.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <GuideSection step={1} title="Choose your bet">
            <p>Two hands are dealt: the Player and the Banker. Bet on:</p>
            <ul className="space-y-1">
              <li className="flex items-center justify-between rounded-md border bg-muted/30 px-2 py-1.5">
                <span className="flex items-center gap-1.5 font-semibold text-foreground">
                  <User className="h-3 w-3" /> Player wins
                </span>
                <span className="font-bold text-primary">{fmt(payouts.PLAYER)}</span>
              </li>
              <li className="flex items-center justify-between rounded-md border bg-muted/30 px-2 py-1.5">
                <span className="flex items-center gap-1.5 font-semibold text-foreground">
                  <Landmark className="h-3 w-3" /> Banker wins
                </span>
                <span className="font-bold text-primary">{fmt(payouts.BANKER)}</span>
              </li>
              <li className="flex items-center justify-between rounded-md border bg-muted/30 px-2 py-1.5">
                <span className="flex items-center gap-1.5 font-semibold text-foreground">
                  <Handshake className="h-3 w-3" /> Tie
                </span>
                <span className="font-bold text-primary">{fmt(payouts.TIE)}</span>
              </li>
            </ul>
            <p>
              The multiplier is applied to your bet when you win. Bets can be
              between{" "}
              <b className="text-foreground">
                {limits.minBet} and {limits.maxBet.toLocaleString()} ETB
              </b>
              .
            </p>
          </GuideSection>

          <GuideSection step={2} title="Card values">
            <ul className="list-disc space-y-0.5 pl-4">
              <li>
                <b className="text-foreground">A</b> is worth 1.
              </li>
              <li>
                <b className="text-foreground">2 to 9</b> are worth their face
                value.
              </li>
              <li>
                <b className="text-foreground">10, J, Q, K</b> are worth 0.
              </li>
            </ul>
            <p>
              A hand's total is the sum of its cards, keeping only the last
              digit. For example, 7 + 8 = 15, which counts as{" "}
              <b className="text-foreground">5</b>.
            </p>
          </GuideSection>

          <GuideSection step={3} title="The deal">
            <p>
              Each side gets 2 cards. The hand with the total closest to{" "}
              <b className="text-foreground">9</b> wins. If both totals are
              equal, it's a Tie.
            </p>
            <p>
              If either hand starts with an 8 or 9 (a{" "}
              <b className="text-foreground">natural</b>), no more cards are
              drawn and the round ends immediately.
            </p>
          </GuideSection>

          <GuideSection step={4} title="Third card rules">
            <p>
              Otherwise, a third card may be drawn. This is automatic, you
              don't need to do anything.
            </p>
            <div className="overflow-hidden rounded-md border">
              <div className="bg-muted/50 px-2 py-1 text-[11px] font-bold text-foreground">
                Player
              </div>
              <div className="space-y-0.5 px-2 py-1.5">
                <p>
                  Total <b className="text-foreground">0–5</b>: draws a card
                </p>
                <p>
                  Total <b className="text-foreground">6–7</b>: stands
                </p>
              </div>
            </div>
            <div className="overflow-hidden rounded-md border">
              <div className="bg-muted/50 px-2 py-1 text-[11px] font-bold text-foreground">
                Banker (if the Player stood)
              </div>
              <div className="space-y-0.5 px-2 py-1.5">
                <p>
                  Total <b className="text-foreground">0–5</b>: draws a card
                </p>
                <p>
                  Total <b className="text-foreground">6–7</b>: stands
                </p>
              </div>
            </div>
            <div className="overflow-hidden rounded-md border">
              <div className="bg-muted/50 px-2 py-1 text-[11px] font-bold text-foreground">
                Banker (if the Player drew a third card)
              </div>
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b text-[10px] uppercase tracking-wider">
                    <th className="px-2 py-1 font-semibold">Banker total</th>
                    <th className="px-2 py-1 font-semibold">
                      Draws when Player's 3rd card is
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr>
                    <td className="px-2 py-1 font-bold text-foreground">0–2</td>
                    <td className="px-2 py-1">Always</td>
                  </tr>
                  <tr>
                    <td className="px-2 py-1 font-bold text-foreground">3</td>
                    <td className="px-2 py-1">Anything except 8</td>
                  </tr>
                  <tr>
                    <td className="px-2 py-1 font-bold text-foreground">4</td>
                    <td className="px-2 py-1">2 – 7</td>
                  </tr>
                  <tr>
                    <td className="px-2 py-1 font-bold text-foreground">5</td>
                    <td className="px-2 py-1">4 – 7</td>
                  </tr>
                  <tr>
                    <td className="px-2 py-1 font-bold text-foreground">6</td>
                    <td className="px-2 py-1">6 – 7</td>
                  </tr>
                  <tr>
                    <td className="px-2 py-1 font-bold text-foreground">7</td>
                    <td className="px-2 py-1">Never (stands)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </GuideSection>

          <GuideSection step={5} title="Results and payouts">
            <ul className="list-disc space-y-0.5 pl-4">
              <li>
                If your side wins, you receive your bet multiplied by that
                side's multiplier.
              </li>
              <li>
                If you bet Player or Banker and the round is a{" "}
                <b className="text-foreground">Tie</b>, your bet is returned.
              </li>
              <li>If your side loses, the bet is lost.</li>
            </ul>
          </GuideSection>

          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-700 dark:text-amber-400">
            Play responsibly. Only bet what you can afford to lose.
          </p>
        </div>

        <DialogFooter className="flex-col gap-2 border-t px-4 py-3 sm:flex-col sm:space-x-0">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <Checkbox
              checked={dontShow}
              onCheckedChange={(v) => setDontShow(v === true)}
            />
            Don't show this again
          </label>
          <Button className="w-full" onClick={() => onClose(dontShow)}>
            <Play className="mr-1.5 h-3.5 w-3.5 fill-current" />
            Got it, let's play
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Baccarat() {
  const user = useAppSelector((state) => state.auth.user);
  const dispatch = useAppDispatch();
  const socket = getSocket();

  const [betAmount, setBetAmount] = useState<number>(100);
  const [betSide, setBetSide] = useState<Side>("PLAYER");
  const [gameState, setGameState] = useState<"IDLE" | "DEALING" | "RESULT">(
    "IDLE"
  );
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // How-to-play popup: opens when the user enters the page.
  const [guideOpen, setGuideOpen] = useState<boolean>(() => !readHideGuide());

  // Server-driven config.
  const [payouts, setPayouts] = useState<Record<Side, number>>({
    PLAYER: 2,
    BANKER: 1.95,
    TIE: 9,
  });
  const [limits, setLimits] = useState({ minBet: 1, maxBet: 50_000 });

  const busyRef = useRef(false);

  // Wallet lives in redux; the server's wallet is pushed in via setUserWallet.
  const balance = Number(user?.wallets?.available_balance ?? 0);

  const closeGuide = (dontShowAgain: boolean) => {
    try {
      if (dontShowAgain) localStorage.setItem(GUIDE_KEY, "1");
      else localStorage.removeItem(GUIDE_KEY);
    } catch {
      /* storage unavailable, ignore */
    }
    setGuideOpen(false);
  };

  // ---------------- socket wiring ----------------
  useEffect(() => {
    const onSync = (cfg: any) => {
      if (cfg?.payouts) setPayouts(cfg.payouts);
      if (cfg?.minBet && cfg?.maxBet)
        setLimits({ minBet: cfg.minBet, maxBet: cfg.maxBet });
    };
    // Sent only to this user's OTHER tabs/devices.
    const onWallet = (wallet: any) => {
      dispatch(setUserWallet(wallet));
    };
    const onConnect = () => socket.emit("baccarat:requestState");

    socket.on("baccarat:sync", onSync);
    socket.on("baccarat:wallet", onWallet);
    socket.on("connect", onConnect);
    socket.emit("baccarat:requestState");

    return () => {
      socket.off("baccarat:sync", onSync);
      socket.off("baccarat:wallet", onWallet);
      socket.off("connect", onConnect);
    };
  }, []);

  // ---------------- betting ----------------
  const deal = async () => {
    if (busyRef.current) return;

    if (betAmount < limits.minBet || betAmount > limits.maxBet) {
      setError(`Bet must be ${limits.minBet}–${limits.maxBet} ETB`);
      return;
    }
    if (betAmount > balance) {
      setError("Insufficient funds");
      return;
    }
    if (!socket.connected) {
      setError("Not connected, please wait...");
      return;
    }

    busyRef.current = true;
    setGameState("DEALING");
    setResult(null);
    setError(null);
    audio.playBet();

    const started = Date.now();

    const res: any = await new Promise((resolve) => {
      socket
        .timeout(BET_TIMEOUT_MS)
        .emit(
          "baccarat:bet",
          { amount: betAmount, side: betSide },
          (err: any, response: any) =>
            resolve(err ? { error: "No response from server" } : response)
        );
    });

    if (!res || res.error || !res.ok) {
      setError(res?.error ?? "Something went wrong, please try again");
      setGameState("IDLE");
      busyRef.current = false;
      return;
    }

    const wait = DEAL_MS - (Date.now() - started);
    if (wait > 0) await sleep(wait);

    // Reveal first, then update the balance, so it never spoils the result.
    setResult(res);
    setGameState("RESULT");
    dispatch(setUserWallet(res.wallet));

    if (res.won) audio.playWin();
    else if (!res.push) audio.playLoss();

    busyRef.current = false;
  };

  const fmt = (n: number) => `${Number(n.toFixed(2))}x`;

  const sides = [
    { key: "PLAYER" as const, label: "Player", multi: fmt(payouts.PLAYER), Icon: User },
    { key: "TIE" as const, label: "Tie", multi: fmt(payouts.TIE), Icon: Handshake },
    { key: "BANKER" as const, label: "Banker", multi: fmt(payouts.BANKER), Icon: Landmark },
  ];

  const showResult = gameState === "RESULT" && result;
  const pCards: Card_[] = showResult ? result.player.cards : [];
  const bCards: Card_[] = showResult ? result.banker.cards : [];

  return (
    <div className="space-y-1.5 px-2 py-2 sm:px-2.5 sm:py-2.5">
      {/* ============ HOW TO PLAY POPUP ============ */}
      <HowToPlayDialog
        open={guideOpen}
        onClose={closeGuide}
        payouts={payouts}
        limits={limits}
      />

      {/* ============ HERO HEADER ============ */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary via-primary to-primary/85 px-3 py-2.5 text-primary-foreground shadow-sm">
        <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full border-4 border-primary-foreground/15" />
        <div className="pointer-events-none absolute -bottom-6 -left-6 h-20 w-20 rounded-full border border-primary-foreground/10" />

        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-foreground/15 shadow-inner">
              <Sparkles className="h-3.5 w-3.5" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-sm font-black uppercase leading-none tracking-wider">
                Baccarat
              </h1>
              <p className="text-[7px] font-medium uppercase tracking-widest text-primary-foreground/70">
                Player · Banker · Tie
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setGuideOpen(true);
                audio.playClick();
              }}
              aria-label="How to play"
              className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-foreground/15 transition-colors hover:bg-primary-foreground/25 active:scale-95"
            >
              <CircleHelp className="h-3.5 w-3.5" />
            </button>
            <div className="flex flex-col items-end">
              <span className="text-[7px] uppercase tracking-wider text-primary-foreground/70">
                Balance
              </span>
              <span className="text-[11px] font-bold leading-tight">
                {balance.toFixed(2)}
                <span className="ml-0.5 text-[7px] font-normal opacity-80">
                  ETB
                </span>
              </span>
            </div>
          </div>
        </div>

        <div className="relative z-10 mt-2 grid grid-cols-3 gap-1">
          <div className="rounded-md bg-primary-foreground/10 px-1 py-1 text-center backdrop-blur-sm">
            <div className="flex items-center justify-center gap-0.5 text-primary-foreground/70">
              <Coins className="h-2 w-2" />
              <span className="text-[6px] uppercase tracking-wider">Bet</span>
            </div>
            <p className="mt-0.5 text-[10px] font-bold leading-none">
              {betAmount}
            </p>
          </div>

          <div className="rounded-md bg-primary-foreground/10 px-1 py-1 text-center backdrop-blur-sm">
            <div className="flex items-center justify-center gap-0.5 text-primary-foreground/70">
              <Sparkles className="h-2 w-2" />
              <span className="text-[6px] uppercase tracking-wider">Side</span>
            </div>
            <p className="mt-0.5 text-[10px] font-bold leading-none">
              {betSide}
            </p>
          </div>

          <div className="rounded-md bg-primary-foreground/10 px-1 py-1 text-center backdrop-blur-sm">
            <div className="flex items-center justify-center gap-0.5 text-primary-foreground/70">
              <Trophy className="h-2 w-2" />
              <span className="text-[6px] uppercase tracking-wider">Last</span>
            </div>
            <p className="mt-0.5 text-[10px] font-bold leading-none">
              {showResult ? result.winner : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* ============ TABLE ============ */}
      <Card className="overflow-hidden rounded-xl border-border/60 shadow-sm">
        <CardContent className="p-1.5">
          <div className="relative overflow-hidden rounded-lg bg-gradient-to-b from-emerald-800 via-emerald-900 to-emerald-950 p-3 shadow-inner">
            {/* Felt dot texture */}
            <div className="pointer-events-none absolute inset-0 opacity-10 [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.6)_1px,transparent_0)] [background-size:10px_10px]" />

            <div className="relative z-10 grid grid-cols-2 gap-2.5">
              {/* Player hand */}
              <div className="flex flex-col items-center">
                <div className="mb-1 flex items-center gap-1">
                  <User className="h-2.5 w-2.5 text-emerald-200/60" />
                  <span className="text-[8px] font-bold uppercase tracking-widest text-emerald-200/60">
                    Player
                  </span>
                </div>
                <div
                  className={`flex h-24 w-full flex-col items-center justify-center gap-1.5 rounded-lg border bg-white/5 shadow-lg backdrop-blur-md sm:h-28 ${showResult && result.winner === "PLAYER"
                    ? "border-yellow-300/50 shadow-[0_0_12px_rgba(250,204,21,0.35)]"
                    : "border-emerald-200/10"
                    }`}
                >
                  <div className="flex gap-1">
                    {showResult ? (
                      pCards.map((c, i) => <PlayingCard key={i} card={c} />)
                    ) : (
                      <>
                        <PlayingCard />
                        <PlayingCard />
                      </>
                    )}
                  </div>
                  <span className="text-xl font-black text-white sm:text-2xl">
                    {showResult ? result.player.total : "?"}
                  </span>
                </div>
              </div>

              {/* Banker hand */}
              <div className="flex flex-col items-center">
                <div className="mb-1 flex items-center gap-1">
                  <Landmark className="h-2.5 w-2.5 text-emerald-200/60" />
                  <span className="text-[8px] font-bold uppercase tracking-widest text-emerald-200/60">
                    Banker
                  </span>
                </div>
                <div
                  className={`flex h-24 w-full flex-col items-center justify-center gap-1.5 rounded-lg border bg-white/5 shadow-lg backdrop-blur-md sm:h-28 ${showResult && result.winner === "BANKER"
                    ? "border-yellow-300/50 shadow-[0_0_12px_rgba(250,204,21,0.35)]"
                    : "border-emerald-200/10"
                    }`}
                >
                  <div className="flex gap-1">
                    {showResult ? (
                      bCards.map((c, i) => <PlayingCard key={i} card={c} />)
                    ) : (
                      <>
                        <PlayingCard />
                        <PlayingCard />
                      </>
                    )}
                  </div>
                  <span className="text-xl font-black text-white sm:text-2xl">
                    {showResult ? result.banker.total : "?"}
                  </span>
                </div>
              </div>
            </div>

            {/* Result banner */}
            <div className="relative z-10 mt-3 flex h-7 items-center justify-center">
              {showResult ? (
                <div
                  className={`text-base font-black uppercase italic tracking-tight sm:text-lg ${result.won
                    ? "text-yellow-300 drop-shadow-[0_0_12px_rgba(250,204,21,0.7)]"
                    : "text-white/40"
                    }`}
                >
                  {result.winner === "TIE" ? "TIE" : `${result.winner} WINS`}
                  {result.won
                    ? "!"
                    : result.push
                      ? " · BET RETURNED"
                      : ""}
                </div>
              ) : gameState === "DEALING" ? (
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/80">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Dealing...
                </div>
              ) : (
                <p className="text-[9px] uppercase tracking-widest text-emerald-200/40">
                  Place your bet
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ============ CONTROLS ============ */}
      <Card className="rounded-xl border-border/60 shadow-sm">
        <CardContent className="space-y-2 p-2">
          {/* Side buttons */}
          <div className="grid grid-cols-3 gap-1.5">
            {sides.map(({ key, label, multi, Icon }) => {
              const isActive = betSide === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setBetSide(key);
                    audio.playClick();
                  }}
                  disabled={gameState === "DEALING"}
                  className={`flex flex-col items-center gap-0.5 rounded-lg border px-2 py-2 text-center transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${isActive
                    ? "border-primary bg-primary/15 text-primary shadow-sm"
                    : "border-border/60 bg-muted/20 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    {label}
                  </span>
                  <span className="text-[8px] font-semibold opacity-70">
                    {multi}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Bet amount */}
          <div className="space-y-1">
            <Label className="flex items-center gap-1 text-[8px] uppercase tracking-wider text-muted-foreground">
              <Coins className="h-2.5 w-2.5" />
              Investment Amount
            </Label>
            <div className="relative">
              <Input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(Number(e.target.value))}
                disabled={gameState === "DEALING"}
                className="h-8 rounded-lg pr-12 text-center text-[11px] font-bold"
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[8px] font-medium text-muted-foreground">
                ETB
              </span>
            </div>
          </div>

          {/* Place bet button */}
          <Button
            onClick={deal}
            disabled={
              gameState === "DEALING" ||
              betAmount <= 0 ||
              betAmount > balance
            }
            className="h-9 w-full rounded-lg text-[10px] font-bold uppercase tracking-widest shadow-sm"
          >
            {gameState === "DEALING" ? (
              <>
                <span className="mr-1.5 h-3 w-3 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
                Dealing...
              </>
            ) : (
              <>
                <Play className="mr-1.5 h-3 w-3 fill-current" />
                Place Bet
                <span className="ml-1.5 text-[9px] font-normal opacity-80">
                  · {betAmount} ETB
                </span>
              </>
            )}
          </Button>

          {error && (
            <p className="text-center text-[8px] font-medium text-rose-500">
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="h-1" />
    </div>
  );
}