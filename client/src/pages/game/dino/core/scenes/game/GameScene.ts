/*eslint-disable*/
// @ts-nocheck
import Phaser from "phaser";

import CONFIG from "../../config/game";
import InputManager from "./InputManager";
import SoundManager from "./SoundManager";
import ResizeManager from "./ResizeManager";
import LocalScoreManager from "./score/LocalScoreManager";
import TelegramScoreManager from "./score/TelegramScoreManager";
import UI from "./UI";
import Intro from "./Intro";
import Player from "../../prefabs/player/Player";
import Horizon from "../../prefabs/horizon/Horizon";
import Cactus from "../../prefabs/horizon/obstacles/cactus/Cactus";
import isTelegramMode from "../../utils/telegram/isTelegramMode";

// ============================================================
// Types
// ============================================================

type ObstacleCategory = "narrow" | "medium" | "wide";

interface JumpDistanceEntry {
  narrow: number | null;
  medium: number | null;
  wide: number | null;
}

type JumpDistanceTable = Record<number, JumpDistanceEntry>;

/** Structural type for anything the scene treats as an obstacle. */
type DinoObstacle = Phaser.Physics.Arcade.Sprite & {
  gap: number;
  setGap(value: number): void;
  die(): void;
  reset(): void;
};

/** Structural type for a group that spawns obstacles with a "gap". */
interface ObstacleGroup extends Phaser.Physics.Arcade.Group {
  spawnItem(speed: number, isMobile: boolean): void;
  getGap(speed: number, min: number, width: number): number;
  _originalSpawnItem?: (
    this: ObstacleGroup,
    speed: number,
    isMobile: boolean,
  ) => void;
}

/** Ground just needs a resize method for the game-objects hook. */
interface GroundLike {
  resize(gameSize: Phaser.Structs.Size): void;
}

/** Night mode interface to avoid hard-typing to the concrete class. */
interface NightModeLike {
  isEnabled: boolean;
  enable(): void;
  disable(onComplete?: () => void): void;
  reset(): void;
}

interface HorizonLike {
  ground: GroundLike;
  obstacles: ObstacleGroup;
  nightMode: NightModeLike;
  update(speed: number, isMobile: boolean): void;
}

interface UILike {
  highScorePanel: { setScore(score: number): void };
  update(
    isPlaying: boolean,
    gameSize: Phaser.Structs.Size,
    score: number,
  ): void;
  resize(gameSize: Phaser.Structs.Size): void;
}

interface IntroLike {
  isComplete: boolean;
}

interface ResizeHandlers {
  canvas: (gameSize: Phaser.Structs.Size) => Phaser.Types.Math.Vector2Like;
  camera: (gameSize: Phaser.Structs.Size) => void;
  gameSpeed: (gameSize: Phaser.Structs.Size) => void;
  gameObjects: (gameSize: Phaser.Structs.Size) => void;
}

interface ScoreManagerLike {
  getHighScore(): Promise<number>;
  saveHighScore(score: number): Promise<number | void>;
}

// ============================================================
// GameScene
// ============================================================

class GameScene extends Phaser.Scene {
  static readonly CONFIG = CONFIG.SCENES.GAME;

  /**
   * Lookup table: per-speed optimal jump distance for each obstacle width
   * category. Generated from Python simulation.
   *   narrow  (w <= 40):  cactus-small-1 (34px)
   *   medium  (w <= 75):  cactus-small-2 (68px)
   *   wide    (w <= 110): cactus-small-3 (102px)
   */
  static readonly JUMP_DISTANCES: JumpDistanceTable = {
    8: { narrow: 15, medium: null, wide: null },
    10: { narrow: 33, medium: 13, wide: null },
    12: { narrow: 59, medium: 35, wide: null },
    14: { narrow: 71, medium: 57, wide: 43 },
    16: { narrow: 95, medium: 79, wide: 47 },
    17: { narrow: 107, medium: 90, wide: 65 },
    18: { narrow: 119, medium: 101, wide: 83 },
    20: { narrow: 123, medium: 103, wide: 83 },
  };

  /** Sorted speeds — computed once at class load. */
  private static readonly SORTED_SPEEDS: readonly number[] = Object.keys(
    GameScene.JUMP_DISTANCES,
  )
    .map(Number)
    .sort((a, b) => a - b);

  // ---- Scene state ---------------------------------------------------
  isInitialStart = true;
  isPlaying = false;
  readyToRestart = false;

  // Betting state
  bettingMode = false;
  waitingForJump = false;
  obstaclesCleared = 0;
  currentObstacle: DinoObstacle | null = null;
  shouldAutoJump = false;
  shouldFailJump = false;
  successfulJumpInProgress = false;
  optimalJumpDistance = 0;
  forceDarkMode = false;
  pausedSpeed = 0;

  // Speed
  speed = 0;
  maxSpeed = 0;

  // Scoring
  distance = 0;
  highScore = 0;

  // ---- Managers ------------------------------------------------------
  soundManager!: SoundManager;
  inputManager!: InputManager;
  resizeManager!: ResizeManager;
  scoreManager!: ScoreManagerLike;

  // ---- Scene objects (created in `create`) ---------------------------
  ui!: UILike;
  intro!: IntroLike;
  player!: Player;
  horizon!: HorizonLike;
  ground!: GroundLike;
  obstacles!: ObstacleGroup;
  nightMode!: NightModeLike;

  constructor() {
    super(GameScene.CONFIG.NAME);
  }

  // ============================================================
  // Speed
  // ============================================================

  /**
   * Initialise `speed` and `maxSpeed` based on the current viewport.
   * Landscape gets full speed; portrait is divided by MOBILE_COEFFICIENT.
   */
  private initSpeed(): void {
    const { width } = this.scale.gameSize;
    const { INITIAL, MAX, MOBILE_COEFFICIENT } =
      GameScene.CONFIG.GAME.OBSTACLES.SPEED;

    if (width === CONFIG.GAME.WIDTH.LANDSCAPE) {
      this.speed = INITIAL;
      this.maxSpeed = MAX;
    } else if (width === CONFIG.GAME.WIDTH.PORTRAIT) {
      this.speed = INITIAL / MOBILE_COEFFICIENT;
      this.maxSpeed = MAX / MOBILE_COEFFICIENT;
    }
  }

  // ============================================================
  // Lifecycle
  // ============================================================

  init(): void {
    this.isInitialStart = true;
    this.isPlaying = false;
    this.readyToRestart = false;

    // Betting mode state
    this.bettingMode = false;
    this.waitingForJump = false;
    this.obstaclesCleared = 0;
    this.currentObstacle = null;
    this.shouldAutoJump = false;
    this.shouldFailJump = false;
    this.successfulJumpInProgress = false;
    this.optimalJumpDistance = 0;
    this.forceDarkMode = false;
    this.pausedSpeed = 0;

    // Speed
    this.speed = 0;
    this.maxSpeed = 0;
    this.initSpeed();

    // Scoring
    this.distance = 0;
    this.highScore = 0;

    // Managers
    this.soundManager = new SoundManager(this);
    this.inputManager = new InputManager(this);
    this.resizeManager = new ResizeManager(this, {
      canvas: this.onResizeCanvas.bind(this),
      camera: this.onResizeCamera.bind(this),
      gameSpeed: this.onResizeGameSpeed.bind(this),
      gameObjects: this.onResizeGameObjects.bind(this),
    } satisfies ResizeHandlers);

    this.scoreManager = isTelegramMode()
      ? new TelegramScoreManager(this.events)
      : new LocalScoreManager(this.events);

    // Game lifecycle events
    this.events.on(CONFIG.EVENTS.GAME_START, this.onGameStart, this);
    this.events.on(CONFIG.EVENTS.GAME_INTRO_START, this.onIntroStart, this);
    this.events.on(
      CONFIG.EVENTS.GAME_INTRO_COMPLETE,
      this.onIntroComplete,
      this,
    );
    this.events.on(CONFIG.EVENTS.GAME_RESTART, this.onGameRestart, this);
    this.events.on(CONFIG.EVENTS.GAME_OVER, this.onGameOver, this);
    this.events.on(
      CONFIG.EVENTS.HIGH_SCORE_UPDATE,
      this.onHighScoreUpdate,
      this,
    );

    // Betting events
    this.events.on(CONFIG.EVENTS.BETTING_MODE_ON, this.onBettingModeOn, this);
    this.events.on(CONFIG.EVENTS.BETTING_MODE_OFF, this.onBettingModeOff, this);
    this.events.on(CONFIG.EVENTS.JUMP_SUCCESS, this.onJumpSuccess, this);
    this.events.on(CONFIG.EVENTS.JUMP_FAIL, this.onJumpFail, this);

    this.events.on("FORCE_DARK_MODE", this.onForceDarkMode, this);
  }

  create(): void {
    this.ui = new UI(this) as unknown as UILike;
    this.intro = new Intro(this.events) as unknown as IntroLike;
    this.player = new Player(this);

    this.horizon = new Horizon(this) as unknown as HorizonLike;
    this.ground = this.horizon.ground;
    this.obstacles = this.horizon.obstacles;
    this.nightMode = this.horizon.nightMode;

    this.physics.add.collider(
      this.player,
      this.ground as unknown as Phaser.Types.Physics.Arcade.ArcadeColliderType,
    );

    // processCollision is a SAFETY NET: during a successful jump, if the
    // player is genuinely ABOVE the obstacle, ignore the overlap.
    this.physics.add.overlap(
      this.player,
      this.obstacles,
      this
        .onPlayerHitObstacle as unknown as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      this.processCollision.bind(
        this,
      ) as unknown as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      this,
    );

    this.resizeManager.resize(this.scale.gameSize, this.scale.parentSize);

    this.scoreManager
      .getHighScore()
      .then((highScore) => {
        this.highScore = highScore;
      })
      .catch(() => {
        /* ignore */
      });
  }

  // ============================================================
  // Update loop
  // ============================================================

  update(): void {
    const { gameSize } = this.scale;
    const isMobile = gameSize.width === CONFIG.GAME.WIDTH.PORTRAIT;

    this.inputManager.update();
    this.ui.update(this.isPlaying, gameSize, this.score);

    if (!this.isPlaying) return;

    this.player.update();

    if (!this.intro.isComplete) return;

    const { GAME, NIGHTMODE } = GameScene.CONFIG;
    const { OBSTACLES } = GAME;

    // === BETTING: detect incoming obstacle ===
    if (
      this.bettingMode &&
      !this.waitingForJump &&
      !this.shouldAutoJump &&
      !this.shouldFailJump &&
      !this.successfulJumpInProgress
    ) {
      const nearestObstacle = this.getNearestObstacle();
      if (nearestObstacle) {
        const playerRight = this.player.x + this.player.width;
        const dist = nearestObstacle.x - playerRight;

        const jumpDist = this.getJumpDistanceForObstacle(nearestObstacle) ?? 60;
        const pauseDistance = Math.max(jumpDist + 100, 20);

        if (dist <= pauseDistance && dist > 0) {
          this.waitingForJump = true;
          this.pausedSpeed = this.speed;
          this.speed = 0;
          this.currentObstacle = nearestObstacle;
          this.events.emit(
            CONFIG.EVENTS.WAITING_FOR_JUMP,
            this.obstaclesCleared,
          );
          return;
        }
      }
    }

    // === WAITING for player decision ===
    if (this.waitingForJump) return;

    // === AUTO-JUMP: timing the jump for success ===
    if (this.shouldAutoJump && this.currentObstacle) {
      const playerRight = this.player.x + this.player.width;
      const dist = this.currentObstacle.x - playerRight;

      if (dist <= this.optimalJumpDistance) {
        this.player.jump();
        this.shouldAutoJump = false;
        this.successfulJumpInProgress = true;
        this.watchForObstacleClear();
      }
    }

    // === FAIL: no jump needed — physics collision handles GAME_OVER ===

    // === Normal speed update ===
    if (this.speed < this.maxSpeed) {
      this.speed += OBSTACLES.ACCELERATION;
    } else {
      this.speed = this.maxSpeed;
    }

    this.distance += this.speed;

    if (!this.forceDarkMode && this.shouldNightModeStart) {
      this.nightMode.enable();
      this.time.delayedCall(NIGHTMODE.DURATION, () => {
        if (this.isPlaying && this.nightMode.isEnabled && !this.forceDarkMode) {
          this.nightMode.disable();
        }
      });
    }

    this.horizon.update(this.speed, isMobile);
  }

  // ============================================================
  // Jump distance (Python simulation lookup)
  // ============================================================

  /**
   * Get the optimal jump distance for an obstacle based on its width and
   * the current game speed.
   * @returns distance in px, or null if unclearable at this speed
   */
  private getJumpDistanceForObstacle(obstacle: DinoObstacle): number | null {
    const obsWidth = obstacle.displayWidth || obstacle.width;
    const obsHeight = obstacle.displayHeight || obstacle.height;

    // Large cactuses (height >= 90) are unclearable at game speeds <= 17.
    if (obsHeight >= 90) return null;

    const category: ObstacleCategory =
      obsWidth <= 40 ? "narrow" : obsWidth <= 75 ? "medium" : "wide";

    const speeds = GameScene.SORTED_SPEEDS;
    const currentSpeed = Math.round(this.speed);

    let nearest = speeds[0];
    let nearestDist = Math.abs(nearest - currentSpeed);

    for (let i = 1; i < speeds.length; i += 1) {
      const s = speeds[i];
      const d = Math.abs(s - currentSpeed);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = s;
      }
    }

    return GameScene.JUMP_DISTANCES[nearest][category];
  }

  // ============================================================
  // Obstacle clearance tracking
  // ============================================================

  /**
   * Watch the current obstacle until it passes the player after a
   * successful jump. Only clears state if `currentObstacle` is still
   * the SAME obstacle, to avoid clobbering a newer reference.
   */
  private watchForObstacleClear(): void {
    const trackedObstacle = this.currentObstacle;
    if (!trackedObstacle) {
      this.successfulJumpInProgress = false;
      return;
    }

    const checkCleared = this.time.addEvent({
      delay: 50,
      loop: true,
      callback: () => {
        const playerX = this.player.x;
        if (
          !trackedObstacle.visible ||
          trackedObstacle.x + trackedObstacle.width < playerX
        ) {
          checkCleared.remove();
          this.obstaclesCleared += 1;
          this.successfulJumpInProgress = false;
          if (this.currentObstacle === trackedObstacle) {
            this.currentObstacle = null;
          }
        }
      },
    });

    // Safety timeout — only clears if still tracking the same obstacle
    this.time.delayedCall(3000, () => {
      checkCleared.remove();
      this.successfulJumpInProgress = false;
      if (this.currentObstacle === trackedObstacle) {
        this.currentObstacle = null;
      }
    });
  }

  /**
   * Get the nearest visible obstacle in front of the player.
   * Single pass; bails fast when the group is empty.
   */
  private getNearestObstacle(): DinoObstacle | null {
    const children = this.obstacles.getChildren() as DinoObstacle[];
    if (children.length === 0) return null;

    const playerX = this.player.x;
    let nearest: DinoObstacle | null = null;
    let minDist = Infinity;

    for (let i = 0; i < children.length; i += 1) {
      const obstacle = children[i];
      if (!obstacle.visible) continue;
      if (obstacle.x <= playerX) continue;

      const dist = obstacle.x - playerX;
      if (dist < minDist) {
        minDist = dist;
        nearest = obstacle;
      }
    }

    return nearest;
  }

  // ============================================================
  // Collision filter
  // ============================================================

  /**
   * During a SUCCESSFUL jump sequence (shouldAutoJump /
   * successfulJumpInProgress), skip collision with the current obstacle —
   * the RNG already decided survival.
   */
  private processCollision(
    _player: Phaser.GameObjects.GameObject,
    obstacle: Phaser.GameObjects.GameObject,
  ): boolean {
    if (
      this.currentObstacle &&
      obstacle === this.currentObstacle &&
      (this.successfulJumpInProgress || this.shouldAutoJump)
    ) {
      return false;
    }
    return true;
  }

  // ============================================================
  // Betting mode
  // ============================================================

  private onBettingModeOn(): void {
    this.bettingMode = true;
    this.waitingForJump = false;
    this.obstaclesCleared = 0;
    this.currentObstacle = null;
    this.shouldAutoJump = false;
    this.shouldFailJump = false;
    this.successfulJumpInProgress = false;

    const inputManager = (
      this.player as unknown as {
        inputManager?: { disabled: boolean };
      }
    ).inputManager;
    if (inputManager) inputManager.disabled = true;

    this.overrideObstacleSpawning();
  }

  private onBettingModeOff(): void {
    this.bettingMode = false;
    this.waitingForJump = false;
    this.currentObstacle = null;
    this.shouldAutoJump = false;
    this.shouldFailJump = false;
    this.successfulJumpInProgress = false;

    const inputManager = (
      this.player as unknown as {
        inputManager?: { disabled: boolean };
      }
    ).inputManager;
    if (inputManager) inputManager.disabled = false;

    this.restoreObstacleSpawning();
  }

  /**
   * Only spawn clearable obstacles (small cactuses) during betting mode.
   * Large cactuses have only 4px clearance at peak — impossible.
   */
  private overrideObstacleSpawning(): void {
    if (!this.obstacles) return;

    if (!this.obstacles._originalSpawnItem) {
      this.obstacles._originalSpawnItem = this.obstacles.spawnItem.bind(
        this.obstacles,
      );
    }

    const scene = this;

    this.obstacles.spawnItem = function (
      this: ObstacleGroup,
      speed: number,
      _isMobile: boolean,
    ): void {
      const { CACTUS } = CONFIG.PREFABS.OBSTACLES;
      const { width } = scene.scale.gameSize;

      const maxSize = speed >= 14 ? 3 : speed >= 10 ? 2 : 1;
      const size = Phaser.Math.RND.between(1, maxSize);
      const frame = `cactus-small-${size}`;

      const newObstacle = new Cactus(
        scene,
        width,
        CACTUS.POS.Y,
        frame,
      ) as unknown as DinoObstacle;

      this.add(newObstacle);
      const gap = this.getGap(speed, CACTUS.GAP.MIN, newObstacle.width);
      newObstacle.setGap(gap);
    };
  }

  private restoreObstacleSpawning(): void {
    if (this.obstacles?._originalSpawnItem) {
      this.obstacles.spawnItem = this.obstacles._originalSpawnItem;
      delete this.obstacles._originalSpawnItem;
    }
  }

  /**
   * SUCCESS: resume speed, compute optimal jump distance, enable auto-jump.
   */
  private onJumpSuccess(): void {
    if (!this.waitingForJump) return;

    this.waitingForJump = false;
    this.speed = this.pausedSpeed || 10;

    let jumpDist = 60;
    if (this.currentObstacle) {
      const calculated = this.getJumpDistanceForObstacle(this.currentObstacle);
      if (calculated !== null) jumpDist = calculated;
    }

    this.optimalJumpDistance = jumpDist;
    this.shouldAutoJump = true;
  }

  /**
   * FAIL: resume speed, let the dino run into the obstacle naturally.
   * `currentObstacle` stays set so `processCollision` returns true.
   */
  private onJumpFail(): void {
    if (!this.waitingForJump) return;

    this.waitingForJump = false;
    this.speed = this.pausedSpeed || 10;
    this.shouldFailJump = true;
  }

  // ============================================================
  // Standard game handlers
  // ============================================================

  private onPlayerHitObstacle(): void {
    this.events.emit(CONFIG.EVENTS.GAME_OVER, this.score, this.highScore);
  }

  private onGameStart(): void {
    this.isPlaying = true;
    this.isInitialStart = false;
    this.ui.highScorePanel.setScore(this.highScore);
  }

  private onIntroStart(): void {
    const { width } = this.scale.gameSize;
    this.tweens.add({
      targets: this.cameras.main,
      duration: GameScene.CONFIG.INTRO.DURATION,
      width,
    });
  }

  private onIntroComplete(): void {
    const { canvas, gameSize, parentSize } = this.scale;
    const originalTransition = canvas.style.transition;
    const newTransition = `${CONFIG.SCENES.GAME.STYLES.TRANSITION}, ${originalTransition}`;
    canvas.style.transition = newTransition;
    this.resizeManager.resizeCanvas(gameSize, parentSize);

    canvas.addEventListener("transitionend", () => {
      canvas.style.transition = originalTransition;
      this.resizeManager.resizeCanvas(gameSize, parentSize);
    });
  }

  private onGameRestart(): void {
    this.isPlaying = true;
    this.readyToRestart = false;
    this.distance = 0;
    this.speed = 0;
    this.maxSpeed = 0;
    this.initSpeed();

    // Reset betting state
    this.waitingForJump = false;
    this.obstaclesCleared = 0;
    this.currentObstacle = null;
    this.shouldAutoJump = false;
    this.shouldFailJump = false;
    this.successfulJumpInProgress = false;

    this.physics.resume();

    this.scoreManager
      .getHighScore()
      .then((highScore) => {
        this.highScore = highScore;
      })
      .catch(() => {
        /* ignore */
      });
  }

  private onGameOver(): void {
    const { width: gameWidth, height: gameHeight } = this.scale.gameSize;
    this.isPlaying = false;
    this.physics.pause();
    this.scale.resize(gameWidth, gameHeight);

    if (this.game.device.features.vibration) {
      navigator.vibrate(GameScene.CONFIG.GAMEOVER.VIBRATION);
    }

    if (this.score > this.highScore) {
      this.events.emit(CONFIG.EVENTS.HIGH_SCORE_UPDATE, this.score);
    }
  }

  private onHighScoreUpdate(highScore: number): void {
    this.scoreManager
      .saveHighScore(highScore)
      .then(() => {
        this.highScore = highScore;
      })
      .catch(() => {
        /* ignore */
      });
  }

  private onForceDarkMode(isDark: boolean): void {
    this.forceDarkMode = isDark;
    if (!this.nightMode) return;

    if (isDark && !this.nightMode.isEnabled) {
      this.nightMode.enable();
    } else if (!isDark && this.nightMode.isEnabled) {
      this.nightMode.disable();
    }
  }

  // ============================================================
  // Helpers / accessors
  // ============================================================

  get score(): number {
    return Math.ceil(this.distance * GameScene.CONFIG.GAME.SCORE.COEFFICIENT);
  }

  get shouldNightModeStart(): boolean {
    const { score, nightMode } = this;
    const { DISTANCE } = GameScene.CONFIG.NIGHTMODE;
    return score > 0 && score % DISTANCE === 0 && !nightMode.isEnabled;
  }

  // ============================================================
  // Resize
  // ============================================================

  private onResizeCanvas(
    gameSize: Phaser.Structs.Size,
  ): Phaser.Types.Math.Vector2Like {
    const { width, height } = gameSize;
    if (!this.intro.isComplete) {
      return { x: 0, y: 0, width: width * 0.8, height: height * 0.8 };
    }
    return { x: 0, y: 0, width, height };
  }

  private onResizeGameSpeed(gameSize: Phaser.Structs.Size): void {
    const { MAX, MOBILE_COEFFICIENT } = GameScene.CONFIG.GAME.OBSTACLES.SPEED;
    if (gameSize.width === CONFIG.GAME.WIDTH.LANDSCAPE) {
      this.speed *= MOBILE_COEFFICIENT;
      this.maxSpeed = MAX;
    } else if (gameSize.width === CONFIG.GAME.WIDTH.PORTRAIT) {
      this.speed /= MOBILE_COEFFICIENT;
      this.maxSpeed = MAX / MOBILE_COEFFICIENT;
    }
  }

  private onResizeCamera(gameSize: Phaser.Structs.Size): void {
    const { width, height } = gameSize;
    const { main: mainCamera } = this.cameras;
    mainCamera.setOrigin(0, 0.5);
    if (this.intro.isComplete) {
      mainCamera.setViewport(0, 0, width, height);
    } else {
      mainCamera.setViewport(0, 0, GameScene.CONFIG.INTRO.CAMERA.WIDTH, height);
    }
  }

  private onResizeGameObjects(gameSize: Phaser.Structs.Size): void {
    this.ui.resize(gameSize);
    this.ground.resize(gameSize);
  }
}

export default GameScene;
