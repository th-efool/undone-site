import type { Metadata, Viewport } from 'next';
import { Caveat, Dancing_Script, Geist, Geist_Mono, Manrope, Lora } from 'next/font/google';
import { CapacitorBridge } from '@/src/client/components/global/CapacitorBridge/CapacitorBridge';
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


export const metadata: Metadata = {
  metadataBase: new URL('https://sidequesthq.com'),

  title: {
    default: 'SideQuestHQ',
    template: '%s | SideQuestHQ',
  },

  description: 'The easiest way to stay consistent with everything you want to learn.',

  applicationName: 'SideQuestHQ',

  keywords: [
    'SideQuestHQ',
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
      name: 'SideQuestHQ',
    },
  ],

  creator: 'SideQuestHQ',
  publisher: 'SideQuestHQ',

  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://sidequesthq.com',
    siteName: 'SideQuestHQ',
    title: 'SideQuestHQ',
    description: 'The easiest way to stay consistent with everything you want to learn.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'SideQuestHQ',
      },
    ],
  },

  twitter: {
    card: 'summary_large_image',
    title: 'SideQuestHQ',
    description: 'The easiest way to stay consistent with everything you want to learn.',
    images: ['/og-image.png'],
    creator: '@SideQuestHQ',
  },

  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
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
      className={`${geistSans.variable} ${geistMono.variable} ${manrope.variable} ${caveat.variable} ${dancingScript.variable} ${lora.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background text-text font-sans antialiased">
        <CapacitorBridge />
        {children}
      </body>
    </html>
  );
}


