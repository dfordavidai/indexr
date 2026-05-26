// Engine config singleton — imported by the API route and any other lib that needs it.
// In production you'd persist this to Redis or a SystemConfig DB table.

export type IndexingMode = 'instant' | 'normal'

export const engineConfig = {
  indexingMode: 'normal' as IndexingMode,
  enabledMethods: {
    GOOGLE_API: true,
    INDEXNOW: true,
    SITEMAP_PING: true,
    FETCH_AS_GOOGLE: false,
  },
  rateLimits: {
    GOOGLE_API: 200,
    INDEXNOW: 10000,
    SITEMAP_PING: 500,
  },
  defaultMethodByPlan: {
    free: 'INDEXNOW',
    pro: 'GOOGLE_API',
    enterprise: 'GOOGLE_API',
  },
  retryAttempts: 3,
  retryDelaySeconds: 300,
  creditCostPerUrl: 1,
  blacklistedDomains: [] as string[],
  instantModeMaxUrls: 50,
}
