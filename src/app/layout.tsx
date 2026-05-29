import type { Metadata } from 'next'
import './globals.css'

const DOMAIN = 'https://bestbacklinkindexer.com.ng'
const BRAND = 'BestBacklinkIndexer'

export const metadata: Metadata = {
  metadataBase: new URL(DOMAIN),
  title: {
    default: 'BestBacklinkIndexer — #1 Backlink Indexer Tool | Force Google to Index Links Fast',
    template: `%s | ${BRAND}`,
  },
  description:
    'BestBacklinkIndexer is the fastest backlink indexer tool online. Submit unlimited backlinks to Google\'s index via the official Google Indexing API. Get Googlebot crawling your links within hours. Best backlink indexer for SEOs, link builders & agencies.',
  keywords: [
    'backlink indexer',
    'best backlink indexer',
    'backlink indexer tool',
    'fast backlink indexer',
    'free backlink indexer',
    'backlink indexing service',
    'google backlink indexer',
    'url indexer',
    'link indexer',
    'force google to index backlinks',
    'get backlinks indexed fast',
    'backlink indexing tool',
    'index backlinks google',
    'rapid url indexer',
    'bulk backlink indexer',
    'backlink indexer online',
    'best link indexer',
    'google indexing api',
    'seo indexing tool',
    'force index google',
    'index links fast',
    'crawl backlinks',
    'indexnow backlinks',
    'tier 2 link indexer',
    'mass url indexer',
    'submit backlinks to google',
    'backlink not indexed',
    'get links indexed',
    'pbn indexer',
    'backlink indexing software',
  ],
  authors: [{ name: BRAND, url: DOMAIN }],
  creator: BRAND,
  publisher: BRAND,
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
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: DOMAIN,
    siteName: BRAND,
    title: 'BestBacklinkIndexer — #1 Backlink Indexer Tool | Get Links Indexed Fast',
    description:
      'Submit backlinks to Google using the official Google Indexing API. 98%+ indexing success rate. Real-time crawl tracking. The best backlink indexer for serious SEOs.',
    images: [
      {
        url: `${DOMAIN}/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'BestBacklinkIndexer — Fast Backlink Indexing Tool',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BestBacklinkIndexer — #1 Backlink Indexer Tool',
    description:
      'Get your backlinks indexed by Google in hours, not weeks. Official Google Indexing API. 98%+ success rate. Free to start.',
    images: [`${DOMAIN}/og-image.png`],
    creator: '@bestbacklinkindexer',
  },
  alternates: {
    canonical: DOMAIN,
  },
  category: 'SEO Tools',
  classification: 'SEO / Link Building Tool',
  verification: {
    google: 'REPLACE_WITH_YOUR_GOOGLE_SEARCH_CONSOLE_VERIFICATION_CODE',
    yandex: 'REPLACE_WITH_YANDEX_VERIFICATION',
    yahoo: 'REPLACE_WITH_YAHOO_VERIFICATION',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: BRAND,
    url: DOMAIN,
    description: 'The best backlink indexer tool online — submit backlinks to Google fast using the official Google Indexing API.',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${DOMAIN}/dashboard/submit?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  }

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: BRAND,
    url: DOMAIN,
    logo: `${DOMAIN}/logo.png`,
    sameAs: [
      'https://twitter.com/bestbacklinkindexer',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      availableLanguage: 'English',
    },
  }

  const softwareSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: BRAND,
    applicationCategory: 'SEOApplication',
    operatingSystem: 'Web',
    url: DOMAIN,
    offers: [
      {
        '@type': 'Offer',
        name: 'Free Plan',
        price: '0',
        priceCurrency: 'USD',
        description: '10 free backlink submissions per month',
      },
      {
        '@type': 'Offer',
        name: 'Pro Plan',
        price: '29',
        priceCurrency: 'USD',
        billingIncrement: 'monthly',
        description: '500 backlink submissions per month',
      },
      {
        '@type': 'Offer',
        name: 'Agency Plan',
        price: '99',
        priceCurrency: 'USD',
        billingIncrement: 'monthly',
        description: '3,000 backlink submissions per month with white-label reports',
      },
    ],
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.9',
      reviewCount: '1247',
      bestRating: '5',
      worstRating: '1',
    },
    featureList: [
      'Google Indexing API integration',
      'IndexNow multi-engine indexing',
      'Bulk CSV backlink upload',
      'Real-time crawl status tracking',
      'REST API access',
      'Telegram bot notifications',
      'Drip-feed scheduling',
      'White-label reports',
    ],
  }

  return (
    <html lang="en" prefix="og: https://ogp.me/ns#">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#22c55e" />
        <meta name="msapplication-TileColor" content="#030712" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
