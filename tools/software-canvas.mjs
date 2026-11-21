// A software canvas: the small piece of the 2D canvas API the game's
// renderer uses (fillRect, paths of lines and arcs, fill and stroke),
// rasterised into an RGB buffer. The screenshot tool runs the game's own
// scenes through the game's own drawing code on this canvas.
export class SoftwareCanvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.pixels = new Uint8Array(width * height * 3);
    this.fillStyle = '#000000';
    this.strokeStyle = '#000000';
    this.lineWidth = 1;
    this._path = [];
    this._arc = null;
  }

  _parse(style) {
    if (typeof style !== 'string') return [0, 0, 0, 1];
    const s = style.trim();
    if (s.startsWith('#')) {
      const hex = s.slice(1);
      if (hex.length === 3) {
        return [parseInt(hex[0] + hex[0], 16), parseInt(hex[1] + hex[1], 16), parseInt(hex[2] + hex[2], 16), 1];
      }
      return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16), 1];
    }
    const m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)$/.exec(s);
    if (m) return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])];
    return [0, 0, 0, 1];
  }

  _blend(x, y, r, g, b, a) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 3;
    if (a >= 1) {
      this.pixels[i] = r;
      this.pixels[i + 1] = g;
      this.pixels[i + 2] = b;
    } else {
      this.pixels[i] = Math.round(r * a + this.pixels[i] * (1 - a));
      this.pixels[i + 1] = Math.round(g * a + this.pixels[i + 1] * (1 - a));
      this.pixels[i + 2] = Math.round(b * a + this.pixels[i + 2] * (1 - a));
    }
  }

  fillRect(x, y, w, h) {
    const [r, g, b, a] = this._parse(this.fillStyle);
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.width, Math.ceil(x + w));
    const y1 = Math.min(this.height, Math.ceil(y + h));
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) this._blend(xx, yy, r, g, b, a);
    }
  }

  beginPath() {
    this._path = [];
    this._arc = null;
  }

  moveTo(x, y) {
    this._path.push({ x, y });
  }

  lineTo(x, y) {
    this._path.push({ x, y });
  }

  closePath() {
    // The fill routine closes the polygon itself.
  }

  arc(x, y, r) {
    this._arc = { x, y, r };
  }

  _fillPolygon(pts) {
    const [r, g, b, a] = this._parse(this.fillStyle);
    if (pts.length < 3) return;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    for (let y = Math.max(0, Math.floor(minY)); y < Math.min(this.height, Math.ceil(maxY)); y++) {
      const cy = y + 0.5;
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const p1 = pts[i];
        const p2 = pts[(i + 1) % pts.length];
        if ((p1.y <= cy && p2.y > cy) || (p2.y <= cy && p1.y > cy)) {
          xs.push(p1.x + ((cy - p1.y) * (p2.x - p1.x)) / (p2.y - p1.y));
        }
      }
      xs.sort((u, v) => u - v);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const x0 = Math.max(0, Math.ceil(xs[k]));
        const x1 = Math.min(this.width, Math.floor(xs[k + 1]));
        for (let x = x0; x < x1; x++) this._blend(x, y, r, g, b, a);
      }
    }
  }

  fill() {
    if (this._arc) {
      const { x, y, r } = this._arc;
      const pts = [];
      for (let i = 0; i < 28; i++) {
        const a = (i / 28) * Math.PI * 2;
        pts.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r });
      }
      this._fillPolygon(pts);
      return;
    }
    this._fillPolygon(this._path);
  }

  _dot(x, y, rad) {
    const [r, g, b, a] = this._parse(this.strokeStyle);
    const rr = Math.max(1, Math.ceil(rad));
    for (let yy = Math.floor(y) - rr; yy <= Math.floor(y) + rr; yy++) {
      for (let xx = Math.floor(x) - rr; xx <= Math.floor(x) + rr; xx++) {
        if (Math.hypot(xx - x, yy - y) <= rad) this._blend(xx, yy, r, g, b, a);
      }
    }
  }

  stroke() {
    if (this._arc) {
      const { x, y, r } = this._arc;
      const [cr, cg, cb, ca] = this._parse(this.strokeStyle);
      const half = this.lineWidth / 2;
      const r0 = Math.max(0, r - half);
      const r1 = r + half;
      for (let yy = Math.floor(y - r1); yy <= Math.ceil(y + r1); yy++) {
        for (let xx = Math.floor(x - r1); xx <= Math.ceil(x + r1); xx++) {
          const d = Math.hypot(xx - x, yy - y);
          if (d >= r0 && d <= r1) this._blend(xx, yy, cr, cg, cb, ca);
        }
      }
      return;
    }
    const rad = this.lineWidth / 2;
    for (let i = 0; i + 1 < this._path.length; i++) {
      const p1 = this._path[i];
      const p2 = this._path[i + 1];
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const steps = Math.max(1, Math.ceil(dist));
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        this._dot(p1.x + (p2.x - p1.x) * t, p1.y + (p2.y - p1.y) * t, rad);
      }
    }
  }
}
