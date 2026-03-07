import type { RGBColor } from 'd3-color';

interface Circle {
  x: number;
  y: number;
  radius: number;
}

interface Label {
  x: number;
  y: number;
  text: string;
  size: number;
  family: string;
  color: RGBColor;
}

export class Painter {
  private circlesByColor: Map<RGBColor, Circle[]> = new Map();
  private bordersByColor: Map<RGBColor, Circle[]> = new Map();
  private texts: Label[] = [];

  private _addCircle(
    x: number,
    y: number,
    radius: number,
    color: RGBColor,
    isBorder = false
  ): void {
    if (color.opacity <= 0) return;
    const target = isBorder ? this.bordersByColor : this.circlesByColor;
    if (!target.has(color)) target.set(color, []);
    target.get(color)!.push({ x, y, radius });
  }

  private _areSameColor(a: RGBColor, b: RGBColor): boolean {
    return a.r === b.r && a.g === b.g && a.b === b.b && a.opacity === b.opacity;
  }

  circle(x: number, y: number, radius: number, fill: RGBColor, border: RGBColor): this {
    this._addCircle(x, y, radius + 0.2, border, true);
    if (!this._areSameColor(border, fill)) {
      this._addCircle(x, y, radius, fill);
    }
    return this;
  }

  text(
    text: string,
    x: number,
    y: number,
    size: number,
    family: string,
    color: RGBColor
  ): this {
    if (color.opacity > 0) {
      this.texts.push({ x, y, text, size, family, color });
    }
    return this;
  }

  paint(ctx: CanvasRenderingContext2D): this {
    // Draw borders first, then fills
    for (const target of [this.bordersByColor, this.circlesByColor]) {
      for (const [color, circles] of target.entries()) {
        ctx.beginPath();
        ctx.fillStyle = color.toString();
        for (const c of circles) {
          ctx.arc(c.x, c.y, c.radius, 0, 2 * Math.PI, false);
        }
        ctx.closePath();
        ctx.fill();
      }
      target.clear();
    }

    // Draw labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (const label of this.texts) {
      ctx.font = `${label.size}px ${label.family}`;
      ctx.fillStyle = label.color.toString();
      ctx.fillText(label.text, label.x, label.y);
    }
    this.texts = [];

    return this;
  }
}
