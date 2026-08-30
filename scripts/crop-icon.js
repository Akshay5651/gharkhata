const sharp = require('sharp');
const path = require('path');

const SRC = path.join(__dirname, '..', 'assets', 'images', 'logo-source.png');
const ICON_OUT = path.join(__dirname, '..', 'assets', 'images', 'icon.png');
const ADAPTIVE_OUT = path.join(
  __dirname,
  '..',
  'assets',
  'images',
  'adaptive-icon.png',
);

// The pictorial mark only (house/clipboard/worker/₹), found by iterating
// against a preview render — excludes the "GharKhata" wordmark and tagline,
// which Android's adaptive-icon mask would otherwise clip or make
// illegible. Pixel coordinates in the 1254x1254 source.
const MARK_BOX = { left: 90, top: 90, width: 1080, height: 735 };

// Canvas sized off the WIDER axis (the mark is landscape-shaped) so left/
// right margin is real and visible — padding to a canvas sized off a square
// safe-zone percentage gave ~16% side margin but ~27% top/bottom, which read
// as "no side margin at all" next to the generous vertical gap. Sizing off
// width directly makes the mark itself larger too (less empty canvas overall).
//
// 0.20 matches Android's actual adaptive-icon safe zone: only the center 66dp
// of the 108dp foreground is guaranteed visible under every launcher mask
// (circle, squircle, rounded square), which works out to ~19.4% margin per
// side minimum. A smaller margin (0.09) still got clipped by circular masks.
const SIDE_MARGIN_FRACTION = 0.2;
const CANVAS = Math.round(MARK_BOX.width / (1 - 2 * SIDE_MARGIN_FRACTION));

async function run() {
  // Full source logo, used as-is for the general/iOS/store icon — that
  // surface isn't put through Android's aggressive adaptive-icon masking.
  await sharp(SRC).png().toFile(ICON_OUT);

  const padX = Math.round((CANVAS - MARK_BOX.width) / 2);
  const padY = Math.round((CANVAS - MARK_BOX.height) / 2);

  await sharp(SRC)
    .extract(MARK_BOX)
    .extend({
      top: padY,
      bottom: CANVAS - MARK_BOX.height - padY,
      left: padX,
      right: CANVAS - MARK_BOX.width - padX,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .png()
    .toFile(ADAPTIVE_OUT);

  console.log('wrote', ICON_OUT);
  console.log('wrote', ADAPTIVE_OUT);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

