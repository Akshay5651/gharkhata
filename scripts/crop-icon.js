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

// The adaptive-icon safe zone is roughly the center 66% of the canvas —
// launchers mask everything outside a circle/squircle/rounded-square of
// that size. Padding the mark to ~55% of canvas width keeps real margin.
const CANVAS = 1600;

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

