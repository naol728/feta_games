import Phaser from "phaser";

import CONFIG from "../../../config/game";

/** Frame can be either an atlas frame name or a numeric index. */
type StarFrame = string | number;

/** Shape of the STAR config we actually consume. */
interface StarConfig {
  FRAMES: readonly StarFrame[];
}

/**
 * Star
 * @class Star
 * @extends {Phaser.GameObjects.Image}
 */
class Star extends Phaser.GameObjects.Image {
  static readonly CONFIG = CONFIG.PREFABS.STAR as unknown as StarConfig;

  /**
   * Creates an instance of Star.
   * @param scene - The Scene to which this Star belongs
   * @param x - Horizontal position of this Star in the world (default 0)
   * @param y - Vertical position of this Star in the world (default 0)
   * @param frame - The frame to display (defaults to a random one)
   */
  constructor(
    scene: Phaser.Scene,
    x = 0,
    y = 0,
    frame: StarFrame = Phaser.Math.RND.pick(Star.CONFIG.FRAMES as StarFrame[]),
  ) {
    super(scene, x, y, "dino", frame);

    // Init image
    this.setOrigin(0, 0);
    this.setDepth(100);

    this.scene.add.existing(this);
  }

  /**
   * Update star.
   * @param speed - Current game speed
   */
  update(speed: number): void {
    this.move(speed);
  }

  /**
   * Move star horizontally by `speed` pixels.
   * @param speed - Current game speed
   */
  private move(speed: number): void {
    this.x -= speed;
  }
}

export default Star;
