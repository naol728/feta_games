/*eslint-disable*/
// @ts-nocheck
import Phaser from "phaser";

/**
 * Phaser 3 & 4 compatible "fill tint".
 * Phaser 4 removed setTintFill; the equivalent is:
 *   setTint(color).setTintMode(Phaser.TintModes.FILL)
 */
export function setTintFill(obj: any, color: number) {
  if (typeof obj?.setTintMode === "function" && (Phaser as any).TintModes) {
    obj.setTint(color);
    obj.setTintMode((Phaser as any).TintModes.FILL);
  } else if (typeof obj?.setTintFill === "function") {
    obj.setTintFill(color);
  } else {
    obj?.setTint?.(color);
  }
  return obj;
}

export function clearTint(obj: any) {
  if (typeof obj?.clearTint === "function") obj.clearTint();
  // In Phaser 4 you may need to reset tint mode too
  if (typeof obj?.setTintMode === "function" && (Phaser as any).TintModes) {
    obj.setTintMode((Phaser as any).TintModes.MULTIPLY);
  }
  return obj;
}

/**
 * Create a text object using the bitmap font "joystix" if it loaded,
 * otherwise fall back to a normal Phaser text with a monospace font.
 * Never returns undefined.
 */
export function addSafeText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size: number,
): Phaser.GameObjects.Text | Phaser.GameObjects.BitmapText {
  const hasBitmap = scene.cache.bitmapFont?.exists?.("joystix");
  if (hasBitmap) {
    return scene.add.bitmapText(x, y, "joystix", text, size);
  }
  // Fallback: normal text. Still looks fine on canvas.
  const fallback = scene.add.text(x, y, text, {
    fontFamily: "monospace",
    fontSize: `${size}px`,
    color: "#757575",
  });
  // Provide a minimal compatible surface so downstream calls don't crash.
  // (setTint / clearTint / setTintFill exist on Text in both versions.)
  return fallback;
}
