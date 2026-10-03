import fs from 'node:fs';
import path from 'node:path';

const refPath = path.resolve('artifacts/reference.jpg');
const refBase64 = fs.readFileSync(refPath).toString('base64');

const crops = [
  { id: 'paper-bg', name: 'paper-bg.png', x: 260, y: 50, w: 200, h: 200 },
  { id: 'l1-window', name: 'l1-window-photo.png', x: 0, y: 0, w: 240, h: 290 },
  { id: 'l2-ideas', name: 'l2-ideas-paper.png', x: 75, y: 230, w: 125, h: 135 },
  { id: 'l3-botanical', name: 'l3-botanical.png', x: 8, y: 265, w: 75, h: 105, keyOutPaper: true },
  { id: 'l4-mountains', name: 'l4-mountains.png', x: 0, y: 345, w: 145, h: 175 },
  { id: 'l5-curiosity', name: 'l5-curiosity-note.png', x: 30, y: 435, w: 105, h: 85 },
  { id: 'l6-moon', name: 'l6-moon-circle.png', x: 112, y: 395, w: 82, h: 85 },
  { id: 'l7-blue', name: 'l7-blue-scrap.png', x: 135, y: 265, w: 75, h: 100 },
  { id: 'r1-galaxy', name: 'r1-galaxy.png', x: 810, y: 0, w: 214, h: 140 },
  { id: 'r2-curious', name: 'r2-curious-tomorrow.png', x: 750, y: 55, w: 140, h: 180 },
  { id: 'r3-disciplines', name: 'r3-disciplines.png', x: 895, y: 135, w: 100, h: 100 },
  { id: 'r4-origami', name: 'r4-origami-crane.png', x: 775, y: 240, w: 75, h: 90, keyOutPaper: true },
  { id: 'r5-map', name: 'r5-map-scrap.png', x: 730, y: 315, w: 95, h: 120 },
  { id: 'r6-mug', name: 'r6-mug-books.png', x: 835, y: 205, w: 189, h: 195 },
  { id: 'r7-cathedral', name: 'r7-cathedral.png', x: 805, y: 365, w: 140, h: 155 },
  { id: 'r8-collect', name: 'r8-collect-repeat.png', x: 915, y: 360, w: 109, h: 125 },
  { id: 'r9-banner', name: 'r9-blue-banner.png', x: 675, y: 410, w: 125, h: 110 },
  { id: 'tape-strip', name: 'tape-strip.png', x: 60, y: 20, w: 50, h: 24 }
];

const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Asset Cropper</title>
</head>
<body>
  <h1>Asset Cropper</h1>
  <img id="ref" src="data:image/jpeg;base64,${refBase64}" style="display:none" />
  <div id="status">Ready</div>
  <script>
    window.CROPS = ${JSON.stringify(crops)};
    window.croppedAssets = {};

    function runCrops() {
      const img = document.getElementById('ref');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      for (const item of window.CROPS) {
        canvas.width = item.w;
        canvas.height = item.h;
        ctx.clearRect(0, 0, item.w, item.h);
        ctx.drawImage(img, item.x, item.y, item.w, item.h, 0, 0, item.w, item.h);

        if (item.keyOutPaper) {
          const imgData = ctx.getImageData(0, 0, item.w, item.h);
          const data = imgData.data;
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i+1];
            const b = data[i+2];
            // Check if pixel is the warm cream background (approx rgb(240-250, 235-245, 220-235))
            if (r > 218 && g > 210 && b > 195 && Math.abs(r - g) < 22 && Math.abs(g - b) < 26) {
              data[i+3] = 0; // Transparent
            }
          }
          ctx.putImageData(imgData, 0, 0);
        }

        window.croppedAssets[item.name] = canvas.toDataURL('image/png');
      }
      document.getElementById('status').innerText = 'Done';
      window.isDone = true;
    }

    const img = document.getElementById('ref');
    if (img.complete) {
      runCrops();
    } else {
      img.onload = runCrops;
    }
  </script>
</body>
</html>`;

fs.writeFileSync('scripts/cropper.html', html, 'utf-8');
console.log('scripts/cropper.html created successfully.');
