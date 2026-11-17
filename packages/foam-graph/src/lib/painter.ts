import type { RGBColor } from 'd3-color';
import { traceShape, type NodeShape } from './node-style';

interface Shape {
  x: number;
  y: number;
  radius: number;
  shape: NodeShape;
}

interface Outline extends Shape {
  color: RGBColor;
  background: RGBColor;
  dashed: boolean;
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
  private fillsByColor: Map<RGBColor, Shape[]> = new Map();
  private bordersByColor: Map<RGBColor, Shape[]> = new Map();
  private outlines: Outline[] = [];
  private texts: Label[] = [];
  private screenTexts: Label[] = [];

  private _addShape(shape: Shape, color: RGBColor, isBorder = false): void {
    if (color.opacity <= 0) return;
    const target = isBorder ? this.bordersByColor : this.fillsByColor;
    if (!target.has(color)) target.set(color, []);
    target.get(color)!.push(shape);
  }

  private _areSameColor(a: RGBColor, b: RGBColor): boolean {
    return a.r === b.r && a.g === b.g && a.b === b.b && a.opacity === b.opacity;
  }

  node(
    x: number,
    y: number,
    radius: number,
    shape: NodeShape,
    fill: RGBColor,
    border: RGBColor
  ): this {
    this._addShape({ x, y, radius: radius + 0.2, shape }, border, true);
    if (!this._areSameColor(border, fill)) {
      this._addShape({ x, y, radius, shape }, fill);
    }
    return this;
  }

  /** A node drawn as its outline, over `background` so links don't show through. */
  outlinedNode(
    x: number,
    y: number,
    radius: number,
    shape: NodeShape,
    color: RGBColor,
    background: RGBColor,
    dashed: boolean
  ): this {
    if (color.opacity > 0) {
      this.outlines.push({ x, y, radius, shape, color, background, dashed });
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

  screenText(
    text: string,
    x: number,
    y: number,
    size: number,
    family: string,
    color: RGBColor
  ): this {
    if (color.opacity > 0) {
      this.screenTexts.push({ x, y, text, size, family, color });
    }
    return this;
  }

  paint(ctx: CanvasRenderingContext2D): this {
    // Draw borders first, then fills
    for (const target of [this.bordersByColor, this.fillsByColor]) {
      for (const [color, shapes] of target.entries()) {
        ctx.beginPath();
        ctx.fillStyle = color.toString();
        for (const s of shapes) {
          traceShape(ctx, s.shape, s.x, s.y, s.radius);
        }
        ctx.fill();
      }
      target.clear();
    }

    // Line width and dashes grow with the node, so every outline looks alike
    ctx.save();
    for (const o of this.outlines) {
      ctx.beginPath();
      traceShape(ctx, o.shape, o.x, o.y, o.radius);
      ctx.fillStyle = o.background.toString();
      ctx.fill();
      ctx.strokeStyle = o.color.toString();
      ctx.lineWidth = o.radius / 4;
      ctx.setLineDash(o.dashed ? [o.radius * 0.6, o.radius * 0.5] : []);
      ctx.stroke();
    }
    ctx.restore();
    this.outlines = [];

    // Draw labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (const label of this.texts) {
      ctx.font = `${label.size}px ${label.family}`;
      ctx.fillStyle = label.color.toString();
      ctx.fillText(label.text, label.x, label.y);
    }
    this.texts = [];

    if (this.screenTexts.length > 0) {
      ctx.save();
      const devicePixelRatio = window.devicePixelRatio || 1;
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (const label of this.screenTexts) {
        ctx.font = `${label.size}px ${label.family}`;
        ctx.fillStyle = label.color.toString();
        ctx.fillText(label.text, label.x, label.y);
      }
      ctx.restore();
      this.screenTexts = [];
    }

    return this;
  }
}
