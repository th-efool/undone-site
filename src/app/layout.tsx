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


export const metadata: Metadata = {
  metadataBase: new URL('https://sidequesthq.com'),

  title: {
    default: 'Undone',
    template: '%s | Undone',
  },

  description: 'The easiest way to stay consistent with everything you want to learn.',

  applicationName: 'Undone',

  keywords: [
    'Undone',
    'learning',
    'microlearning',
    'AI',
    'education',
    'knowledge management',
    'learning paths',
    'study',
    'skill development',
  ],

  authors: [
    {
      name: 'Undone',
    },
  ],

  creator: 'Undone',
  publisher: 'Undone',

  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://sidequesthq.com',
    siteName: 'Undone',
    title: 'Undone',
    description: 'The easiest way to stay consistent with everything you want to learn.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Undone',
      },
    ],
  },

  twitter: {
    card: 'summary_large_image',
    title: 'Undone',
    description: 'The easiest way to stay consistent with everything you want to learn.',
    images: ['/og-image.png'],
    creator: '@Undone',
  },

  icons: {
    icon: [
      { url: '/undone-logo.svg', type: 'image/svg+xml' },
      { url: '/undone-logo-light.png', media: '(prefers-color-scheme: light)', type: 'image/png' },
      { url: '/undone-logo-dark.png', media: '(prefers-color-scheme: dark)', type: 'image/png' },
      { url: '/favicon.ico' },
    ],
    apple: [
      { url: '/undone-logo.png' },
    ],
    shortcut: '/favicon.ico',
  },

  manifest: '/site.webmanifest',

  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#FAF7F2',
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


