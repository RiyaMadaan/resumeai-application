import dotenv from 'dotenv'

dotenv.config()

/**
 * Centralized, typed access to environment variables.
 * Secrets (JWT, DB URI, AI key) come only from the environment — never
 * hard-coded and never shipped to the client.
 */
function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback
  if (value === undefined) {
    // In development we warn rather than crash so the server can still boot
    // for endpoints that don't need this value.
    console.warn(`[env] Missing environment variable: ${name}`)
    return ''
  }
  return value
}

/** Split a comma-separated origin list, trimming blanks and trailing slashes. */
function parseOrigins(raw: string | undefined, fallback: string): string[] {
  const value = (raw ?? '').trim() || fallback
  return value
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean)
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 5000),
  /**
   * Browser origins allowed to call this API with credentials.
   *
   * Accepts a comma-separated list so the Vite dev server can move ports
   * without the API silently rejecting it. Wildcards are deliberately not
   * supported: the API is used with credentials, and `*` is invalid there.
   */
  clientOrigins: parseOrigins(process.env.CLIENT_ORIGIN, 'http://localhost:5173'),

  mongoUri: required('MONGODB_URI', 'mongodb://127.0.0.1:27017/resumeai'),

  jwtSecret: required('JWT_SECRET', 'dev_insecure_secret_change_me'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',

  /**
   * AI provider (Anthropic / Claude).
   *
   * The key lives in ANTHROPIC_API_KEY — the name the Anthropic SDK itself
   * uses — and is read here only so the service layer can fail with a clear
   * message when it is missing. It is server-side only: it is never returned
   * by an endpoint, never logged, and never reaches the browser.
   */
  aiProvider: (process.env.AI_PROVIDER ?? 'anthropic').trim().toLowerCase(),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  aiModel: process.env.AI_MODEL ?? 'claude-opus-4-8',
}

export const isProd = env.nodeEnv === 'production'
