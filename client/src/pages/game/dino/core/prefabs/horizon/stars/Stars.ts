import Phaser from "phaser";

import CONFIG from "../../../config/game";
import Star from "./Star";

/**
 * Structural interface for anything stored in the Stars group.
 * Only members actually used by the group are required, so the group
 * stays decoupled from the concrete Star class.
 */
interface StarLike extends Phaser.GameObjects.GameObject {
  x: number;
  y: number;
  width: number;
  update(speed: number): void;
  setPosition(x: number, y: number): this;
  setFrame(frame: string | number): this;
}

/**
 * Stars Group
 * @class Stars
 * @extends {Phaser.GameObjects.Group}
 */
class Stars extends Phaser.GameObjects.Group {
  static readonly CONFIG = CONFIG.PREFABS.STAR as Readonly<{
    FRAMES: readonly (string | number)[];
    POS: { Y: { MIN: number; MAX: number } };
  }>;

  /** Cached for the whole group's lifetime — never changes. */
  private static readonly MAX_COUNT =
    CONFIG.SCENES.GAME.NIGHTMODE.STARS.MAX_COUNT;

  constructor(scene: Phaser.Scene) {
    super(scene);
    this.scene.add.existing(this);
  }

  /**
   * Update stars group.
   * @param speed - Current game speed
   */
  update(speed: number): void {
    const { width } = this.scene.scale.gameSize;
    const children = this.getChildren() as StarLike[];

    for (let i = 0; i < children.length; i += 1) {
      const star = children[i];
      star.update(speed);

      if (star.x + star.width < 0) {
        star.setPosition(width, this.getRandomYPos());
        star.setFrame(this.getRandomFrame());
      }
    }
  }

  /**
   * Spawn stars up to MAX_COUNT, then shuffle them.
   */
  spawnItems(): void {
    for (let i = this.getLength(); i < Stars.MAX_COUNT; i += 1) {
      this.add(new Star(this.scene));
    }

    this.shuffleItems();
  }

  /**
   * Randomly reposition each star across the width of the viewport.
   */
  shuffleItems(): void {
    const { width } = this.scene.scale.gameSize;
    const xWidth = width / Stars.MAX_COUNT;

    const children = this.getChildren() as StarLike[];
    for (let i = 0; i < children.length; i += 1) {
      const star = children[i];
      const frame = this.getRandomFrame();
      const x = this.getRandomXPos(xWidth, i);
      const y = this.getRandomYPos();

      star.setPosition(x, y);
      star.setFrame(frame);
    }
  }

  /**
   * Pick a random star frame from the configured list.
   */
  private getRandomFrame(): string | number {
    return Phaser.Math.RND.pick(Stars.CONFIG.FRAMES as (string | number)[]);
  }

  /**
   * Get a random X position within the i-th horizontal slice.
   */
  // eslint-disable-next-line class-methods-use-this
  private getRandomXPos(xWidth: number, i: number): number {
    return Phaser.Math.RND.between(xWidth * i, xWidth * (i + 1));
  }

  /**
   * Get a random Y position within the configured vertical range.
   */
  // eslint-disable-next-line class-methods-use-this
  private getRandomYPos(): number {
    const { MIN, MAX } = Stars.CONFIG.POS.Y;
    return Phaser.Math.RND.between(MIN, MAX);
  }

  /**
   * Destroy all stars.
   */
  reset(): void {
    this.clear(true, true);
  }
}

export default Stars;
