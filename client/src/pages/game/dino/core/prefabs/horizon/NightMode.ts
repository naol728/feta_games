/*eslint-disable*/
// @ts-nocheck
import CONFIG from "../../config/game";
import Stars from "./stars/Stars";
import Moon from "./moon/Moon";

/** Structural interface for the scene bits NightMode touches. */
interface NightModeScene extends Phaser.Scene {
  forceDarkMode?: boolean;
  game: Phaser.Game & {
    canvas: HTMLCanvasElement;
    scale: Phaser.Scale.ScaleManager & {
      parent: HTMLElement;
    };
  };
}

/**
 * NightMode
 * @class NightMode
 */
class NightMode {
  static readonly CONFIG = {
    NIGHTMODE: CONFIG.SCENES.GAME.NIGHTMODE,
    MOON: CONFIG.PREFABS.MOON,
    STARS: CONFIG.PREFABS.STAR,
  } as const;

  readonly scene: NightModeScene;
  readonly moon: Moon;
  readonly stars: Stars;
  readonly canvas: HTMLCanvasElement;
  readonly parent: HTMLElement;

  private enabled = false;

  /**
   * Creates an instance of NightMode.
   */
  constructor(scene: NightModeScene) {
    const { FADE_DURATION } = NightMode.CONFIG.NIGHTMODE;
    const gameWidth = scene.scale.gameSize.width;

    this.scene = scene;
    this.enabled = false;

    // Moon
    this.moon = new Moon(scene, gameWidth - 50, NightMode.CONFIG.MOON.POS.Y);
    this.moon.setAlpha(0);

    // Stars
    this.stars = new Stars(scene);
    this.stars.spawnItems();

    // Fade stars in opacity=0 initially (Phaser-4 safe iteration)
    const starChildren =
      this.stars.getChildren() as Phaser.GameObjects.GameObject[];
    for (let i = 0; i < starChildren.length; i += 1) {
      (
        starChildren[i] as unknown as Phaser.GameObjects.Components.Alpha
      ).setAlpha(0);
    }

    // DOM canvas and parent elements
    this.canvas = scene.game.canvas;
    this.parent = scene.game.scale.parent;

    // Set DOM elements transitions
    this.canvas.style.transition = `filter ${FADE_DURATION}ms linear`;
    this.parent.style.transition = `background-color ${FADE_DURATION}ms linear`;
  }

  /**
   * Update nightmode.
   */
  update(): void {
    if (!this.enabled) return;

    const { width } = this.scene.scale.gameSize;
    const { moon, stars } = this;

    moon.update(NightMode.CONFIG.MOON.SPEED);
    stars.update(NightMode.CONFIG.STARS.SPEED);

    if (moon.x + moon.width < 0) {
      moon.setX(width);
    }
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  set isEnabled(value: boolean) {
    this.enabled = value;
  }

  /**
   * Enable nightmode.
   */
  enable(): void {
    this.stars.shuffleItems();

    this.scene.tweens.add({
      targets: [this.moon, ...this.stars.getChildren()],
      duration: NightMode.CONFIG.NIGHTMODE.FADE_DURATION,
      alpha: 1,
      onStart: () => {
        this.enabled = true;
        this.canvas.style.filter = "invert(1)";
        this.parent.style.backgroundColor = "#000";
      },
    });
  }

  /**
   * Disable nightmode.
   */
  disable(onComplete: () => void = () => {}): void {
    this.scene.tweens.add({
      targets: [this.moon, ...this.stars.getChildren()],
      duration: NightMode.CONFIG.NIGHTMODE.FADE_DURATION,
      alpha: 0,
      onStart: () => {
        this.canvas.style.filter = "invert(0)";
        this.parent.style.backgroundColor = "#fff";
      },
      onComplete: () => {
        this.enabled = false;
        this.moon.nextPhase();
        onComplete();
      },
    });
  }

  /**
   * Reset nightmode.
   */
  reset(): void {
    if (this.scene.forceDarkMode) {
      this.moon.reset();
      return;
    }
    this.disable(() => this.moon.reset());
  }
}

export default NightMode;
