/*eslint-disable*/
// @ts-nocheck
import Phaser from "phaser";
import CONFIG from "../../../config/game";
import BaseScorePanel from "./BaseScorePanel";
import { addSafeText, setTintFill } from "@/utils/phaserCompat";

/** Score text can be a bitmap font or a plain Text — both share the API we use. */
type ScoreText = Phaser.GameObjects.Text | Phaser.GameObjects.BitmapText;

/** Shape of the HIGH_SCORE config we consume. */
interface HighScoreConfig {
  GAMEOVER: {
    FLASH: {
      DURATION: number;
      ITERATIONS: number;
    };
  };
}

/**
 * High score panel
 * @class HighScorePanel
 * @extends {BaseScorePanel}
 */
class HighScorePanel extends BaseScorePanel {
  static readonly CONFIG = CONFIG.SCENES.GAME.GAME
    .HIGH_SCORE as unknown as HighScoreConfig;

  /**
   * Narrow the inherited `scoreText` type from `any` to a proper union
   * so downstream calls type-check without casts.
   */
  declare scoreText: ScoreText;

  /**
   * Creates an instance of HighScorePanel.
   * @param scene - The Scene to which this panel belongs
   * @param disableReset - Is resetting disabled (default false)
   */
  constructor(scene: Phaser.Scene, disableReset = false) {
    super(scene);

    this.scene = scene;
    this.defaultString = "HI ";

    // Register event handlers
    this.scene.events.on(
      CONFIG.EVENTS.HIGH_SCORE_FETCH.SUCCESS,
      this.onFetchScore,
      this,
    );
    this.scene.events.on(
      CONFIG.EVENTS.HIGH_SCORE_SAVE.SUCCESS,
      this.onSaveScore,
      this,
    );

    if (!disableReset) {
      this.scoreText.on("pointerdown", this.onClick, this);
    }
  }

  /**
   * Create the score text object.
   * Uses the bitmap font if loaded, otherwise a normal Text fallback.
   */
  override createScoreText(): void {
    const t = addSafeText(this.scene, 0, 0, "", 32) as ScoreText;

    // Fill tint (Phaser 3 & 4 compatible).
    setTintFill(t, 0x757575);

    // Both Text and BitmapText implement these in Phaser 3 & 4.
    if (typeof t.setOrigin === "function") t.setOrigin(1, 0);
    if (typeof t.setDepth === "function") t.setDepth(9999);

    this.scoreText = t;
  }

  /**
   * Create the flash tween used on game-over.
   */
  protected override createFlashTween(): Phaser.Tweens.Tween {
    const { DURATION, ITERATIONS } = HighScorePanel.CONFIG.GAMEOVER.FLASH;

    const onStart = () => {
      if (typeof this.scoreText.clearTint === "function") {
        this.scoreText.clearTint();
      }
    };
    const onComplete = () => {
      setTintFill(this.scoreText, 0x757575);
    };

    return super.createFlashTween(DURATION, ITERATIONS, onStart, onComplete);
  }

  /**
   * Handle high score fetch success.
   */
  private onFetchScore(highScore: number): void {
    this.setScore(highScore);
  }

  /**
   * Handle high score save success.
   */
  private onSaveScore(highScore: number): void {
    this.setScore(highScore);
  }

  /**
   * Handle click on the score text.
   */
  private onClick(): void {
    if (!this.isFlashing) {
      this.flashScore();
    } else {
      this.reset();
      this.scoreText.disableInteractive();
      this.scene.events.emit(CONFIG.EVENTS.HIGH_SCORE_UPDATE, 0);
    }
  }

  /**
   * Handle game restart.
   */
  override onRestart(): void {
    this.reset();
    this.scoreText.disableInteractive();
    super.onRestart();
  }

  /**
   * Handle game over — enable pointer interaction for reset.
   */
  override onGameOver(): void {
    super.onGameOver();

    const { width, height } = this.scoreText;
    this.scoreText.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(0, 0, width, height),
    });
  }
}

export default HighScorePanel;
