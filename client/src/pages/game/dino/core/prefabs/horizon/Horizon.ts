import CONFIG from "../../config/game";

import Ground from "./ground/Ground";
import Obstacles from "./obstacles/Obstacles";
import Clouds from "./clouds/Clouds";
import NightMode from "./NightMode";

/**
 * Structural interface for the scene bits Horizon touches.
 * Keeps Horizon decoupled from GameScene.
 */
interface HorizonScene extends Phaser.Scene {
  speed: number;
  forceDarkMode: boolean;
}

/**
 * Horizon
 * @class Horizon
 */
class Horizon {
  static readonly CONFIG = {
    OBSTACLES: CONFIG.SCENES.GAME.GAME.OBSTACLES,
    CLOUDS: CONFIG.PREFABS.CLOUD,
  } as const;

  readonly scene: HorizonScene;
  readonly ground: Ground;
  readonly obstacles: Obstacles;
  readonly clouds: Clouds;
  readonly nightMode: NightMode;

  /**
   * Creates an instance of Horizon.
   */
  constructor(scene: HorizonScene) {
    this.scene = scene;
    this.ground = new Ground(scene);
    this.obstacles = new Obstacles(scene);
    this.clouds = new Clouds(scene);
    this.nightMode = new NightMode(scene);

    // Register event handlers
    this.scene.events.on(CONFIG.EVENTS.GAME_INTRO_COMPLETE, this.start, this);
    this.scene.events.on(CONFIG.EVENTS.GAME_RESTART, this.reset, this);
  }

  /**
   * Set first horizon state (called when intro completes).
   */
  private start(): void {
    const { speed } = this.scene;
    this.spawnInitialCloud();
    this.spawnInitialObstacle(speed, false);
  }

  /**
   * Spawn 1st cloud.
   */
  private spawnInitialCloud(): void {
    this.clouds.spawnItem();
  }

  /**
   * Spawn 1st obstacle after a short delay.
   */
  private spawnInitialObstacle(speed: number, isMobile: boolean): void {
    const obstacleSpawnDelay = Horizon.CONFIG.OBSTACLES.SPAWN.DELAY;
    this.scene.time.delayedCall(obstacleSpawnDelay, () => {
      this.obstacles.spawnItem(speed, isMobile);
    });
  }

  /**
   * Update horizon.
   */
  update(speed: number, isMobile: boolean): void {
    this.ground.update(speed);
    this.obstacles.update(speed, isMobile);
    this.clouds.update(Horizon.CONFIG.CLOUDS.SPEED, true);
    this.nightMode.update();
  }

  /**
   * Reset horizon.
   */
  private reset(): void {
    const { speed } = this.scene;
    this.ground.reset();
    this.obstacles.reset();
    this.nightMode.reset();
    this.spawnInitialObstacle(speed, false);
  }
}

export default Horizon;
