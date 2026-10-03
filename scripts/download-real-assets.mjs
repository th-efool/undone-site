import fs from 'node:fs';
import path from 'node:path';

const assets = [
  {
    name: 'real-window-person.jpg',
    url: 'https://images.unsplash.com/photo-1516962215378-7fa2e137ae93?w=800&auto=format&fit=crop&q=85',
    description: 'Black and white photograph of woman sitting in contemplative pose by a window'
  },
  {
    name: 'real-galaxy.jpg',
    url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop&q=85',
    description: 'Spiral galaxy and deep cosmic starry nebula'
  },
  {
    name: 'real-mountains.jpg',
    url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&auto=format&fit=crop&q=85',
    description: 'Snowy alpine mountain peaks and rocky ridge'
  },
  {
    name: 'real-cathedral.jpg',
    url: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800&auto=format&fit=crop&q=85',
    description: 'Classical European cathedral architectural dome'
  },
  {
    name: 'real-mug-books.jpg',
    url: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800&auto=format&fit=crop&q=85',
    description: 'Ceramic coffee cup resting on vintage hardcover books'
  },
  {
    name: 'real-moon.jpg',
    url: 'https://images.unsplash.com/photo-1532693322450-2cb5c511067d?w=800&auto=format&fit=crop&q=85',
    description: 'Detailed monochrome lunar crater sphere'
  },
  {
    name: 'real-map.jpg',
    url: 'https://images.unsplash.com/photo-1524654458049-e36be0721fa2?w=800&auto=format&fit=crop&q=85',
    description: 'Antique vintage topographical world map'
  },
  {
    name: 'real-paper-texture.jpg',
    url: 'https://images.unsplash.com/photo-1606041008023-472dfb5e530f?w=800&auto=format&fit=crop&q=85',
    description: 'Vintage warm fibrous textured paper background'
  }
];

const destDir = path.resolve('public/images/hero-collage');
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

async function downloadAll() {
  console.log('Downloading real photography assets from Unsplash...');
  for (const item of assets) {
    const dest = path.join(destDir, item.name);
    try {
      const res = await fetch(item.url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arrayBuffer = await res.arrayBuffer();
      fs.writeFileSync(dest, Buffer.from(arrayBuffer));
      console.log(`✓ Saved ${item.name} (${arrayBuffer.byteLength} bytes)`);
    } catch (err) {
      console.error(`✗ Failed ${item.name}:`, err.message);
    }
  }
  console.log('Asset download complete.');
}

downloadAll();
