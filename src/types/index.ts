export type UserRole = 'USER' | 'ADMIN'
export type IndexStatus = 'PENDING' | 'QUEUED' | 'SUBMITTED' | 'CRAWLED' | 'INDEXED' | 'FAILED' | 'SKIPPED'
export type IndexMethod = 'GOOGLE_API' | 'SITEMAP_PING' | 'FETCH_AS_GOOGLE' | 'INDEXNOW'

export interface JWTPayload {
  userId: string
  email: string
  role: UserRole
  iat?: number
  exp?: number
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface SubmissionResult {
  url: string
  status: 'queued' | 'duplicate' | 'invalid' | 'insufficient_credits'
  submissionId?: string
}

export interface DashboardStats {
  totalSubmissions: number
  indexedCount: number
  pendingCount: number
  failedCount: number
  creditsRemaining: number
  creditsUsedThisMonth: number
}

export interface PlanFeature {
  name: string
  included: boolean
}

export interface PricingPlan {
  id: string
  name: string
  slug: string
  price: number
  creditsPerMonth: number
  features: string[]
  stripePriceId?: string
}
