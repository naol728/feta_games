import Phaser from "phaser";

/**
 * Structural type for anything in a HorizonItems group.
 * We only ever call these members from the base class.
 */
export interface HorizonItem extends Phaser.GameObjects.GameObject {
  x: number;
  y: number;
  width: number;
  gap: number;
  visible: boolean;
  update(speed: number): void;
  die(): void;
  reset(): void;
}

/**
 * HorizonItems Group
 * @class HorizonItems
 * @extends {Phaser.Physics.Arcade.Group}
 */
abstract class HorizonItems extends Phaser.Physics.Arcade.Group {
  constructor(scene: Phaser.Scene) {
    super(scene.physics.world, scene);
  }

  /**
   * Update horizon items group.
   */
  update(speed: number, isMobile: boolean): void {
    const { width } = this.scene.scale.gameSize;
    const items = this.getChildren() as HorizonItem[];

    for (let i = 0; i < items.length; i += 1) {
      items[i].update(speed);
    }

    const lastItem = this.getLast(true) as HorizonItem | null;
    if (lastItem && lastItem.x + lastItem.width + lastItem.gap < width) {
      this.clearItems();
      this.spawnItem(speed, isMobile);
    }
  }

  /**
   * Spawn horizon item. Must be implemented by subclass.
   */
  abstract spawnItem(speed: number, isMobile: boolean): void;

  /**
   * Clear every invisible item.
   */
  protected clearItems(): void {
    const items = this.getChildren() as HorizonItem[];
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (!item.visible) item.die();
    }
  }

  /**
   * Reset horizon items group.
   */
  reset(): void {
    const items = this.getChildren() as HorizonItem[];
    for (let i = 0; i < items.length; i += 1) {
      items[i].reset();
    }
    this.clear(true, true);
  }
}

export default HorizonItems;
