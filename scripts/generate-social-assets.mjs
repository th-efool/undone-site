import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const publicDir = path.join(projectRoot, 'public');
const appDir = path.join(projectRoot, 'src', 'app');

async function main() {
  console.log('--- Generating Undone Social Assets & App Icons ---');

  // 1. Generate App Icons (apple-touch-icon, pwa icons, favicons)
  // Base Undone SVG logo mark with amber dot
  const createIconSvg = (size, padding = 0.16, bg = '#FAF7F2', arcColor = '#0E1738', dotColor = '#ffb000') => {
    const strokeWidth = 96;
    return `
    <svg width="${size}" height="${size}" viewBox="0 0 1248 1248" xmlns="http://www.w3.org/2000/svg">
      ${bg ? `<rect width="100%" height="100%" fill="${bg}" rx="${size > 100 ? '240' : '0'}"/>` : ''}
      <g transform="translate(${1248 * padding}, ${1248 * padding}) scale(${1 - padding * 2})">
        <path d="M483 925 A405 405 0 1 1 948 748" fill="none" stroke="${arcColor}" stroke-width="${strokeWidth}" stroke-linecap="round"/>
        <circle cx="860" cy="856" r="86" fill="${dotColor}"/>
      </g>
    </svg>`;
  };

  // Apple Touch Icon (180x180, iOS requires solid background, rounded corners added by iOS)
  const appleSvg = `
  <svg width="180" height="180" viewBox="0 0 1248 1248" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#FAF7F2"/>
    <rect x="24" y="24" width="1200" height="1200" rx="260" fill="none" stroke="#DDD6C9" stroke-width="24"/>
    <g transform="translate(180, 180) scale(0.71)">
      <path d="M483 925 A405 405 0 1 1 948 748" fill="none" stroke="#0E1738" stroke-width="104" stroke-linecap="round"/>
      <circle cx="860" cy="856" r="92" fill="#ffb000"/>
    </g>
  </svg>`;
  await sharp(Buffer.from(appleSvg)).png().toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('✓ Created public/apple-touch-icon.png (180x180)');

  // Favicon 32x32 & 16x16
  await sharp(Buffer.from(createIconSvg(32, 0.08, null))).png().toFile(path.join(publicDir, 'favicon-32x32.png'));
  await sharp(Buffer.from(createIconSvg(16, 0.05, null))).png().toFile(path.join(publicDir, 'favicon-16x16.png'));
  console.log('✓ Created public/favicon-32x32.png and public/favicon-16x16.png');

  // PWA Standard Icons (192 & 512)
  await sharp(Buffer.from(createIconSvg(192, 0.14, '#FAF7F2'))).png().toFile(path.join(publicDir, 'icon-192.png'));
  await sharp(Buffer.from(createIconSvg(512, 0.14, '#FAF7F2'))).png().toFile(path.join(publicDir, 'icon-512.png'));
  console.log('✓ Created public/icon-192.png and public/icon-512.png');

  // PWA Maskable Icons (safe zone requires 20% margin, full bleed background)
  const createMaskableSvg = (size) => `
  <svg width="${size}" height="${size}" viewBox="0 0 1248 1248" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#FAF7F2"/>
    <g transform="translate(250, 250) scale(0.6)">
      <path d="M483 925 A405 405 0 1 1 948 748" fill="none" stroke="#0E1738" stroke-width="110" stroke-linecap="round"/>
      <circle cx="860" cy="856" r="95" fill="#ffb000"/>
    </g>
  </svg>`;
  await sharp(Buffer.from(createMaskableSvg(192))).png().toFile(path.join(publicDir, 'icon-maskable-192.png'));
  await sharp(Buffer.from(createMaskableSvg(512))).png().toFile(path.join(publicDir, 'icon-maskable-512.png'));
  console.log('✓ Created maskable icons (192 & 512)');

  // 2. Web App Manifest
  const manifest = {
    name: 'Undone — For a more curious you',
    short_name: 'Undone',
    description: 'Turn curiosity into lasting understanding. Seamlessly learn from YouTube, articles, and podcasts in everyday moments without managing courses or schedules.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#FAF7F2',
    theme_color: '#FAF7F2',
    icons: [
      {
        src: '/favicon-16x16.png',
        sizes: '16x16',
        type: 'image/png'
      },
      {
        src: '/favicon-32x32.png',
        sizes: '32x32',
        type: 'image/png'
      },
      {
        src: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png'
      },
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png'
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png'
      },
      {
        src: '/icon-maskable-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable'
      },
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      }
    ]
  };
  fs.writeFileSync(path.join(publicDir, 'site.webmanifest'), JSON.stringify(manifest, null, 2));
  console.log('✓ Created public/site.webmanifest');

  // 3. Social Media Sharing Card (1200 x 630 OpenGraph / Twitter Card)
  // Load paper texture if available for authentic craft background
  const paperTexturePath = path.join(publicDir, 'images', 'hero-collage', 'real-paper-texture.jpg');
  let paperTextureBase64 = '';
  if (fs.existsSync(paperTexturePath)) {
    const rawTex = fs.readFileSync(paperTexturePath);
    paperTextureBase64 = `data:image/jpeg;base64,${rawTex.toString('base64')}`;
  }

  // Load Caveat and Manrope fonts as base64 for reliable SVG font rendering
  const caveatPath = path.join(publicDir, 'fonts', 'Caveat-Bold.ttf');
  const manropeBoldPath = path.join(publicDir, 'fonts', 'Manrope-Bold.ttf');
  const manropeMedPath = path.join(publicDir, 'fonts', 'Manrope-Medium.ttf');

  let fontFaceCss = '';
  if (fs.existsSync(caveatPath)) {
    const b64 = fs.readFileSync(caveatPath).toString('base64');
    fontFaceCss += `
      @font-face {
        font-family: 'Caveat';
        src: url(data:font/truetype;charset=utf-8;base64,${b64}) format('truetype');
        font-weight: 700;
        font-style: normal;
      }
    `;
  }
  if (fs.existsSync(manropeBoldPath)) {
    const b64 = fs.readFileSync(manropeBoldPath).toString('base64');
    fontFaceCss += `
      @font-face {
        font-family: 'Manrope';
        src: url(data:font/truetype;charset=utf-8;base64,${b64}) format('truetype');
        font-weight: 700;
        font-style: normal;
      }
    `;
  }
  if (fs.existsSync(manropeMedPath)) {
    const b64 = fs.readFileSync(manropeMedPath).toString('base64');
    fontFaceCss += `
      @font-face {
        font-family: 'Manrope';
        src: url(data:font/truetype;charset=utf-8;base64,${b64}) format('truetype');
        font-weight: 500;
        font-style: normal;
      }
    `;
  }

  const ogCardSvg = `
  <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <style>
        .serif-title {
          font-family: 'Playfair Display', Georgia, 'Times New Roman', serif;
        }
        .serif-italic {
          font-family: 'Playfair Display', Georgia, 'Times New Roman', serif;
          font-style: italic;
        }
        .sans-text {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        }
      </style>
      <linearGradient id="cardGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#FAF7F2"/>
        <stop offset="60%" stop-color="#FAF7F2"/>
        <stop offset="100%" stop-color="#F3ECE1"/>
      </linearGradient>
      <radialGradient id="auraGlow" cx="65%" cy="35%" r="55%">
        <stop offset="0%" stop-color="#1F299D" stop-opacity="0.07"/>
        <stop offset="100%" stop-color="#FAF7F2" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="amberGlow" cx="95%" cy="10%" r="40%">
        <stop offset="0%" stop-color="#ffb000" stop-opacity="0.12"/>
        <stop offset="100%" stop-color="#FAF7F2" stop-opacity="0"/>
      </radialGradient>
    </defs>

    <!-- Base Canvas -->
    <rect width="1200" height="630" fill="url(#cardGrad)"/>

    <!-- Background Atmospheric Glows -->
    <rect width="1200" height="630" fill="url(#auraGlow)"/>
    <rect width="1200" height="630" fill="url(#amberGlow)"/>

    <!-- Subtle Paper Texture Overlay -->
    ${paperTextureBase64 ? `
    <image href="${paperTextureBase64}" x="0" y="0" width="1200" height="630" opacity="0.08" preserveAspectRatio="none" />
    ` : ''}

    <!-- Double Border Editorial Frame -->
    <rect x="24" y="24" width="1152" height="582" rx="24" fill="none" stroke="#DDD6C9" stroke-width="2"/>
    <rect x="36" y="36" width="1128" height="558" rx="16" fill="none" stroke="#EAE3D8" stroke-width="1"/>

    <!-- Top-Right Ribbon Lines -->
    <path d="M 880 0 C 990 40, 1100 120, 1200 230" fill="none" stroke="#1F299D" stroke-width="3" stroke-linecap="round" opacity="0.32"/>
    <path d="M 930 0 C 1020 50, 1120 140, 1200 260" fill="none" stroke="#1F299D" stroke-width="1.5" stroke-dasharray="5,6" opacity="0.25"/>

    <!-- Bottom-Left Decorative Corner Ribbon (Safe from text) -->
    <path d="M 0 575 C 60 590, 130 610, 210 630" fill="none" stroke="#1F299D" stroke-width="2.5" stroke-linecap="round" opacity="0.3"/>
    <path d="M 0 600 C 50 610, 100 620, 150 630" fill="none" stroke="#ffb000" stroke-width="2" stroke-linecap="round" opacity="0.4"/>

    <!-- Top-Left 8-Point Star Doodle -->
    <g transform="translate(68, 62) scale(0.9)" opacity="0.7">
      <line x1="12" y1="2" x2="12" y2="22" stroke="#1F299D" stroke-width="2" stroke-linecap="round"/>
      <line x1="2" y1="12" x2="22" y2="12" stroke="#1F299D" stroke-width="2" stroke-linecap="round"/>
      <line x1="5" y1="5" x2="19" y2="19" stroke="#1F299D" stroke-width="1.4" stroke-linecap="round" opacity="0.8"/>
      <line x1="19" y1="5" x2="5" y2="19" stroke="#1F299D" stroke-width="1.4" stroke-linecap="round" opacity="0.8"/>
      <circle cx="12" cy="12" r="1.5" fill="#1F299D"/>
    </g>

    <!-- Top-Right Golden Star Doodle -->
    <g transform="translate(1106, 64) scale(1.1)" opacity="0.85">
      <line x1="12" y1="2" x2="12" y2="22" stroke="#ffb000" stroke-width="2.2" stroke-linecap="round"/>
      <line x1="2" y1="12" x2="22" y2="12" stroke="#ffb000" stroke-width="2.2" stroke-linecap="round"/>
      <line x1="5" y1="5" x2="19" y2="19" stroke="#ffb000" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="19" y1="5" x2="5" y2="19" stroke="#ffb000" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="12" cy="12" r="1.8" fill="#ffb000"/>
    </g>

    <!-- HEADER: Brand Emblem & Wordmark -->
    <g transform="translate(80, 72)">
      <!-- Undone Emblem (Arc + Amber Dot) -->
      <g transform="translate(0, 0) scale(0.065)">
        <path d="M483 925 A405 405 0 1 1 948 748" fill="none" stroke="#0E1738" stroke-width="96" stroke-linecap="round"/>
        <circle cx="860" cy="856" r="86" fill="#ffb000"/>
      </g>
      <!-- UNDONE Brand Title -->
      <text x="96" y="44" class="serif-title" font-size="34" font-weight="800" letter-spacing="7" fill="#0E1738">UNDONE</text>
      <!-- Editorial Tagline in Italic Serif -->
      <text x="98" y="74" class="serif-italic" font-size="20" fill="#8E867A">For a more curious you.</text>
    </g>

    <!-- HEADER RIGHT: Structured Curiosity Pill -->
    <g transform="translate(860, 80)">
      <rect x="0" y="0" width="250" height="46" rx="23" fill="#F1F3FD" stroke="#DFD8CD" stroke-width="1.5"/>
      <circle cx="26" cy="23" r="5" fill="#1F299D"/>
      <text x="44" y="29" class="sans-text" font-size="14" font-weight="700" fill="#1F299D" letter-spacing="1.4">STRUCTURED CURIOSITY</text>
    </g>

    <!-- MAIN EDITORIAL HEADLINE -->
    <g transform="translate(80, 240)">
      <text x="0" y="0" class="serif-title" font-size="62" font-weight="700" fill="#0E1738" letter-spacing="-0.5">Turn existing curiosity</text>
      <text x="0" y="76" class="serif-title" font-size="62" font-weight="700" fill="#1F299D" letter-spacing="-0.5">into lasting understanding.</text>

      <!-- Hand-drawn double underline flourish under 'understanding' -->
      <g transform="translate(370, 92) scale(2.4, 1.4)">
        <path d="M3 10.5C28 13.2 58 14.5 88 11.5C118 8.5 142 5.5 157 7.2" stroke="#ffb000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M14 13.2C44 15 76 14.8 106 12.2C128 10.2 146 7.8 155 9.2" stroke="#ffb000" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/>
      </g>
    </g>

    <!-- VALUE PROPOSITION DESCRIPTION -->
    <g transform="translate(80, 375)">
      <text x="0" y="0" class="sans-text" font-size="22" font-weight="500" fill="#363E52" letter-spacing="0.1">
        Learn from YouTube, articles, and podcasts in the spare moments of everyday life.
      </text>
      <text x="0" y="34" class="sans-text" font-size="21" font-weight="400" fill="#6A7282" letter-spacing="0.1">
        No courses to manage. No study schedules to reconstruct. Open and continue immediately.
      </text>
    </g>

    <!-- FEATURE PILLS ROW (Crisp Custom SVG Icons) -->
    <g transform="translate(80, 465)">
      <!-- YouTube Pill -->
      <g transform="translate(0, 0)">
        <rect x="0" y="0" width="168" height="44" rx="12" fill="#FFFFFF" stroke="#DFD8CD" stroke-width="1.5"/>
        <!-- Clean YouTube Play Icon -->
        <rect x="18" y="14" width="22" height="16" rx="4.5" fill="#E60000"/>
        <polygon points="27,18 27,26 33,22" fill="#FFFFFF"/>
        <text x="50" y="28" class="sans-text" font-size="15" font-weight="600" fill="#0E1738">YouTube</text>
      </g>

      <!-- Articles Pill -->
      <g transform="translate(182, 0)">
        <rect x="0" y="0" width="164" height="44" rx="12" fill="#FFFFFF" stroke="#DFD8CD" stroke-width="1.5"/>
        <!-- Document Icon -->
        <g transform="translate(18, 12)">
          <rect x="2" y="2" width="15" height="18" rx="2.5" fill="none" stroke="#1F299D" stroke-width="1.8"/>
          <line x1="6" y1="6" x2="13" y2="6" stroke="#1F299D" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="6" y1="10" x2="14" y2="10" stroke="#1F299D" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="6" y1="14" x2="11" y2="14" stroke="#1F299D" stroke-width="1.5" stroke-linecap="round"/>
        </g>
        <text x="48" y="28" class="sans-text" font-size="15" font-weight="600" fill="#0E1738">Articles</text>
      </g>

      <!-- Podcasts Pill -->
      <g transform="translate(360, 0)">
        <rect x="0" y="0" width="170" height="44" rx="12" fill="#FFFFFF" stroke="#DFD8CD" stroke-width="1.5"/>
        <!-- Microphone / Audio Icon -->
        <g transform="translate(18, 12)">
          <rect x="7" y="2" width="6" height="10" rx="3" fill="#7C3AED"/>
          <path d="M 4 8 C 4 13, 16 13, 16 8" fill="none" stroke="#7C3AED" stroke-width="1.6" stroke-linecap="round"/>
          <line x1="10" y1="14" x2="10" y2="18" stroke="#7C3AED" stroke-width="1.6" stroke-linecap="round"/>
        </g>
        <text x="48" y="28" class="sans-text" font-size="15" font-weight="600" fill="#0E1738">Podcasts</text>
      </g>

      <!-- Cohorts Pill -->
      <g transform="translate(544, 0)">
        <rect x="0" y="0" width="190" height="44" rx="12" fill="#FFFFFF" stroke="#DFD8CD" stroke-width="1.5"/>
        <!-- Community Icon -->
        <g transform="translate(18, 12)">
          <circle cx="8" cy="6" r="3.5" fill="#059669"/>
          <path d="M 2 17 C 2 13, 5 12, 8 12 C 11 12, 14 13, 14 17" fill="#059669"/>
          <circle cx="16" cy="7" r="3" fill="#10B981"/>
          <path d="M 14 17 C 14 14, 16 13, 18 13 C 20.5 13, 22 14, 22 17" fill="#10B981"/>
        </g>
        <text x="48" y="28" class="sans-text" font-size="15" font-weight="600" fill="#0E1738">Study Cohorts</text>
      </g>
    </g>

    <!-- FOOTER BAR: Loop cycle & Domain badge -->
    <g transform="translate(80, 552)">
      <!-- Learning Loop in subtle pill badge -->
      <g transform="translate(0, -18)">
        <rect x="0" y="0" width="460" height="40" rx="20" fill="rgba(255,255,255,0.7)" stroke="#DFD8CD" stroke-width="1"/>
        <text x="24" y="25" class="sans-text" font-size="14" font-weight="700" fill="#8E867A" letter-spacing="1.2">THE LOOP:</text>
        <text x="122" y="25" class="sans-text" font-size="15" font-weight="600" fill="#0E1738">Open</text>
        <text x="172" y="25" class="sans-text" font-size="15" font-weight="400" fill="#8E867A">→</text>
        <text x="196" y="25" class="sans-text" font-size="15" font-weight="600" fill="#0E1738">Learn</text>
        <text x="248" y="25" class="sans-text" font-size="15" font-weight="400" fill="#8E867A">→</text>
        <text x="272" y="25" class="sans-text" font-size="15" font-weight="600" fill="#0E1738">Return</text>
        <text x="336" y="25" class="sans-text" font-size="15" font-weight="400" fill="#8E867A">→</text>
        <text x="360" y="25" class="sans-text" font-size="15" font-weight="700" fill="#1F299D">Understand</text>
      </g>

      <!-- Domain pill on right -->
      <g transform="translate(830, -18)">
        <rect x="0" y="0" width="200" height="40" rx="20" fill="#0E1738"/>
        <text x="100" y="25" class="sans-text" font-size="15" font-weight="700" fill="#FAF7F2" text-anchor="middle" letter-spacing="1.4">sidequesthq.in</text>
      </g>
    </g>
  </svg>`;

  // Export 1200x630 og-image.png
  await sharp(Buffer.from(ogCardSvg)).png({ quality: 95 }).toFile(path.join(publicDir, 'og-image.png'));
  console.log('✓ Created public/og-image.png (1200x630)');

  // Export 1200x630 twitter-image.png
  await sharp(Buffer.from(ogCardSvg)).png({ quality: 95 }).toFile(path.join(publicDir, 'twitter-image.png'));
  console.log('✓ Created public/twitter-image.png (1200x630)');

  // Also write to src/app/ for Next.js App Router native file-based metadata
  await sharp(Buffer.from(ogCardSvg)).png({ quality: 95 }).toFile(path.join(appDir, 'opengraph-image.png'));
  await sharp(Buffer.from(ogCardSvg)).png({ quality: 95 }).toFile(path.join(appDir, 'twitter-image.png'));
  console.log('✓ Created src/app/opengraph-image.png & src/app/twitter-image.png');

  // Copy favicon to src/app/icon.png & src/app/apple-icon.png
  await sharp(Buffer.from(appleSvg)).png().toFile(path.join(appDir, 'apple-icon.png'));
  await sharp(Buffer.from(createIconSvg(32, 0.08, null))).png().toFile(path.join(appDir, 'icon.png'));
  console.log('✓ Created src/app/apple-icon.png and src/app/icon.png');

  console.log('--- All Social & App Assets Generated Successfully! ---');
}

main().catch((err) => {
  console.error('Asset generation failed:', err);
  process.exit(1);
});
