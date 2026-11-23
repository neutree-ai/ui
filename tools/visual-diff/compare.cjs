/**
 * Compares two screenshots. A pixel differs when any channel moves by more
 * than TOLERANCE; an image that is taller or wider than the other differs
 * wherever the other has no pixel.
 */

const { decode, encode } = require("./png.cjs");

const TOLERANCE = 2;

/**
 * @returns {{ changed: number, width: number, height: number, diff: Buffer }}
 *   `diff` is a PNG of the head image faded, with every differing pixel red.
 */
function compare(basePng, headPng) {
  const base = decode(basePng);
  const head = decode(headPng);
  const width = Math.max(base.width, head.width);
  const height = Math.max(base.height, head.height);
  const out = Buffer.alloc(width * height * 4);
  let changed = 0;

  const at = (img, x, y) =>
    x < img.width && y < img.height ? (y * img.width + x) * 4 : -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const b = at(base, x, y);
      const h = at(head, x, y);
      const o = (y * width + x) * 4;
      let differs = b < 0 || h < 0;
      if (!differs) {
        for (let c = 0; c < 4; c++) {
          if (Math.abs(base.data[b + c] - head.data[h + c]) > TOLERANCE) {
            differs = true;
            break;
          }
        }
      }
      if (differs) {
        changed++;
        out[o] = 255;
        out[o + 1] = 0;
        out[o + 2] = 60;
        out[o + 3] = 255;
      } else {
        for (let c = 0; c < 3; c++) {
          out[o + c] = 255 - Math.round((255 - head.data[h + c]) * 0.25);
        }
        out[o + 3] = 255;
      }
    }
  }
  return { changed, width, height, diff: encode({ width, height, data: out }) };
}

module.exports = { compare, TOLERANCE };
