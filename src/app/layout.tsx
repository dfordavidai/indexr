import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Indexr — Fast URL Indexing for SEOs',
  description: 'Submit backlinks and URLs to Google\'s index engine. Get Googlebot knocking within hours. Bulk URL indexing via Google Indexing API.',
  keywords: 'url indexing, backlink indexer, google indexing api, seo indexing tool, force google index',
  openGraph: {
    title: 'Indexr — Fast URL Indexing for SEOs',
    description: 'Bulk URL indexing via Google Indexing API. Track crawl and index status in real-time.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
