import type { Metadata, Viewport } from 'next';
import { Caveat, Dancing_Script, Geist, Geist_Mono, Manrope, Lora, Playfair_Display } from 'next/font/google';
import { CapacitorBridge } from '@/src/client/components/global/CapacitorBridge/CapacitorBridge';
import { ReactQueryProvider } from '@/src/client/providers/ReactQueryProvider';
import { SliderProgressEngine } from '@/src/client/components/ui/Slider/SliderProgressEngine';
import { SessionProvider } from 'next-auth/react';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const manrope = Manrope({
  variable: '--font-manrope-next',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
});

const caveat = Caveat({
  variable: '--font-caveat-next',
  subsets: ['latin'],
  weight: ['700'],
});

const dancingScript = Dancing_Script({
  variable: '--font-dancing-script-next',
  subsets: ['latin'],
  weight: ['700'],
});

const lora = Lora({
  variable: '--font-lora',
  subsets: ['latin'],
  style: ['italic'],
});

const playfairDisplay = Playfair_Display({
  variable: '--font-playfair-display',
  subsets: ['latin'],
});


const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sidequesthq.in';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),

  title: {
    default: 'Undone — For a more curious you',
    template: '%s | Undone',
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
    title: 'Undone — For a more curious you',
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
    title: 'Undone — For a more curious you',
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
      <body className="min-h-screen bg-background text-text font-sans antialiased">
        <SessionProvider>
          <a
            href="#main-content"
            className="absolute left-[-9999px] top-4 z-50 rounded-md bg-background p-4 text-text focus:left-4 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            Skip to main content
          </a>
          <SliderProgressEngine />
          <CapacitorBridge />
          <ReactQueryProvider>{children}</ReactQueryProvider>
        </SessionProvider>
      </body>
    </html>
  );
}


