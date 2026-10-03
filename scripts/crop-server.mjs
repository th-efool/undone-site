import http from 'node:http';
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

const htmlContent = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Crop Server Page</title></head>
<body>
  <h2>Cropping Assets...</h2>
  <img id="ref" src="data:image/jpeg;base64,${refBase64}" style="display:none" />
  <div id="status">Processing...</div>
  <script>
    const CROPS = ${JSON.stringify(crops)};
    async function processAndSend() {
      const img = document.getElementById('ref');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const results = {};

      for (const item of CROPS) {
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
            if (r > 218 && g > 210 && b > 195 && Math.abs(r - g) < 22 && Math.abs(g - b) < 26) {
              data[i+3] = 0;
            }
          }
          ctx.putImageData(imgData, 0, 0);
        }

        results[item.name] = canvas.toDataURL('image/png');
      }

      document.getElementById('status').innerText = 'Sending to server...';
      const resp = await fetch('/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(results)
      });
      const res = await resp.json();
      document.getElementById('status').innerText = 'Complete: ' + JSON.stringify(res);
    }

    const img = document.getElementById('ref');
    if (img.complete) {
      processAndSend();
    } else {
      img.onload = processAndSend;
    }
  </script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(htmlContent);
  } else if (req.method === 'POST' && req.url === '/save') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const assets = JSON.parse(body);
        const outDir = path.resolve('public/images/hero-collage');
        if (!fs.existsSync(outDir)) {
          fs.mkdirSync(outDir, { recursive: true });
        }
        let count = 0;
        for (const [filename, dataUrl] of Object.entries(assets)) {
          const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
          const buffer = Buffer.from(base64Data, 'base64');
          fs.writeFileSync(path.join(outDir, filename), buffer);
          count++;
        }
        console.log(`Successfully saved ${count} assets to ${outDir}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, count }));
        setTimeout(() => {
          server.close();
          process.exit(0);
        }, 500);
      } catch (err) {
        console.error('Error saving assets:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(3333, () => {
  console.log('Cropper server listening on http://localhost:3333');
});
