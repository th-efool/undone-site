import type { Metadata, Viewport } from 'next';
import { resolveMetadataBase } from '@/src/shared/lib/metadataBase';
import { Caveat, Dancing_Script, Geist, Geist_Mono, Manrope, Lora, Playfair_Display } from 'next/font/google';
import { CapacitorBridge } from '@/src/client/components/global/CapacitorBridge/CapacitorBridge';
import { ReactQueryProvider } from '@/src/client/providers/ReactQueryProvider';
import { MotionProvider } from '@/src/client/providers/MotionProvider';
import { SliderProgressEngine } from '@/src/client/components/ui/Slider/SliderProgressEngine';
import { SessionProvider } from 'next-auth/react';
import { DevLoggerInit } from '@/src/client/providers/DevLoggerInit';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
  preload: true,
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
  preload: true,
});

const manrope = Manrope({
  variable: '--font-manrope-next',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  display: 'swap',
  preload: true,
});

const caveat = Caveat({
  variable: '--font-caveat-next',
  subsets: ['latin'],
  weight: ['700'],
  display: 'swap',
  preload: false,
});

const dancingScript = Dancing_Script({
  variable: '--font-dancing-script-next',
  subsets: ['latin'],
  weight: ['700'],
  display: 'swap',
  preload: false,
});

const lora = Lora({
  variable: '--font-lora',
  subsets: ['latin'],
  style: ['italic'],
  display: 'swap',
  preload: false,
});

const playfairDisplay = Playfair_Display({
  variable: '--font-playfair-display',
  subsets: ['latin'],
  style: ['normal', 'italic'],
  weight: ['400', '600', '700'],
  display: 'swap',
  preload: false,
});


const metadataBase = resolveMetadataBase(process.env.NEXT_PUBLIC_APP_URL);
const siteUrl = metadataBase.href;

export const metadata: Metadata = {
  metadataBase,

  title: {
    default: 'Undone',
    template: 'Undone > %s',
  },

  description: 'Turn existing curiosity into lasting understanding. Seamlessly learn from YouTube, articles, and podcasts in the spare moments of everyday life — without managing courses or schedules.',

  applicationName: 'Undone',

  keywords: [
    'Undone',
    'curiosity',
    'structured curiosity',
    'self-directed learning',
    'microlearning',
    'learning paths',
    'study cohorts',
    'YouTube learning',
    'knowledge management',
    'education',
  ],

  authors: [
    {
      name: 'Undone',
      url: siteUrl,
    },
  ],

  creator: 'Undone',
  publisher: 'Undone',

  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: 'Undone',
    title: 'Undone > For a more curious you',
    description: 'Turn existing curiosity into lasting understanding. Seamlessly learn from YouTube, articles, and podcasts in the spare moments of everyday life — without managing courses or schedules.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Undone — Turn curiosity into lasting understanding',
        type: 'image/png',
      },
    ],
  },

  twitter: {
    card: 'summary_large_image',
    title: 'Undone > For a more curious you',
    description: 'Turn existing curiosity into lasting understanding. Seamlessly learn from YouTube, articles, and podcasts in the spare moments of everyday life.',
    images: ['/twitter-image.png'],
    creator: '@Undone',
  },

  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
      { url: '/favicon-16x16.png', type: 'image/png', sizes: '16x16' },
      { url: '/undone-logo-transparent.svg', type: 'image/svg+xml' },
      { url: '/undone-logo-light.png', media: '(prefers-color-scheme: light)', type: 'image/png' },
      { url: '/undone-logo-dark.png', media: '(prefers-color-scheme: dark)', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      { url: '/undone-logo-transparent.svg' },
    ],
    shortcut: '/favicon.ico',
  },

  manifest: '/site.webmanifest',

  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Undone',
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FAF7F2' },
    { media: '(prefers-color-scheme: dark)', color: '#090C12' },
  ],
  viewportFit: 'cover',
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: Readonly<RootLayoutProps>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${manrope.variable} ${caveat.variable} ${dancingScript.variable} ${lora.variable} ${playfairDisplay.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          id="ud-theme-init"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=window.location.pathname;var r={'/play':'dark','/explore':'dark','/message':'dark','/notes':'dark','/create-cohort':'dark','/studyroom':'dark'};var t=null;for(var k in r){if(p===k||p.indexOf(k+'/')===0){t=r[k];break;}}if(!t){t=localStorage.getItem('undone_theme');}if(!t&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches){t='dark';}t=t||'light';document.documentElement.setAttribute('data-theme',t);document.documentElement.style.colorScheme=t;}catch(e){}})();`,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="https://fonts.gstatic.com" />
        <link rel="preconnect" href="https://i.ytimg.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://i.ytimg.com" />
        <link rel="preconnect" href="https://images.unsplash.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://images.unsplash.com" />
      </head>
      <body className="min-h-screen bg-background text-text font-sans antialiased">
        <SessionProvider refetchOnWindowFocus={false}>
          <DevLoggerInit />
          <a
            href="#main-content"
            className="absolute left-[-9999px] top-4 z-50 rounded-md bg-background p-4 text-text focus:left-4 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            Skip to main content
          </a>
          <SliderProgressEngine />
          <CapacitorBridge />
          <ReactQueryProvider>
            <MotionProvider>{children}</MotionProvider>
          </ReactQueryProvider>
        </SessionProvider>
      </body>
    </html>
  );
}


