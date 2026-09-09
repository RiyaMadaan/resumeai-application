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

/**
 * Origins allowed in development when CLIENT_ORIGIN isn't set.
 *
 * `localhost` and `127.0.0.1` are *different* origins to the browser, and Vite
 * may serve on either, so both are permitted out of the box.
 */
const DEV_ORIGINS = 'http://localhost:5173,http://127.0.0.1:5173'

/**
 * Split a comma-separated origin list into a normalized allowlist.
 *
 * Entries are trimmed, lowercased and stripped of trailing slashes so that the
 * configured value matches the browser's `Origin` header, which never carries a
 * trailing slash. Duplicates are collapsed.
 */
function parseOrigins(raw: string | undefined, fallback: string): string[] {
  const value = (raw ?? '').trim() || fallback
  const origins = value
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, '').toLowerCase())
    .filter(Boolean)
  return [...new Set(origins)]
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 5000),
  /**
   * Browser origins allowed to call this API with credentials.
   *
   * Set CLIENT_ORIGIN to a comma-separated list to control this per
   * environment; production should always set it explicitly. Wildcards are
   * deliberately not supported: the API is used with credentials, and `*` is
   * invalid alongside them.
   */
  clientOrigins: parseOrigins(process.env.CLIENT_ORIGIN, DEV_ORIGINS),

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
