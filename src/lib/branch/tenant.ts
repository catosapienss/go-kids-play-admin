// ─── Tenant / Subdomain Foundation ────────────────────────────────────────────
//
// Currently a single-tenant deployment. This module sketches how multi-tenant
// hosting will work later (e.g. `kadikoy.gokidsplay.com`, `levent.gokidsplay.com`)
// without forcing changes on the rest of the codebase.
//
// All callers should read the active tenant slug through `getTenantSlug()`;
// when subdomain routing is enabled in production, only this function changes.

export interface TenantInfo {
  /** Slug from URL (subdomain), or null if root domain. */
  slug: string | null
  /** True if app is currently in tenant mode (subdomain routing). */
  isTenantHost: boolean
  /** Top-level domain used for marketing site (single source of truth). */
  rootDomain: string
}

const ROOT_DOMAIN = "gokidsplay.com"

/**
 * Parses the hostname into a tenant slug. Examples:
 *   "gokidsplay.com"               → null  (root)
 *   "www.gokidsplay.com"           → null  (root)
 *   "kadikoy.gokidsplay.com"       → "kadikoy"
 *   "localhost"                    → null  (dev — root)
 *   "kadikoy.localhost:3003"       → "kadikoy"  (dev subdomain)
 */
export function parseTenant(hostname: string): TenantInfo {
  if (!hostname) return { slug: null, isTenantHost: false, rootDomain: ROOT_DOMAIN }
  const host = hostname.toLowerCase().split(":")[0]

  // Dev: localhost or *.localhost
  if (host === "localhost") return { slug: null, isTenantHost: false, rootDomain: ROOT_DOMAIN }
  if (host.endsWith(".localhost")) {
    const sub = host.slice(0, -".localhost".length)
    return { slug: sub || null, isTenantHost: !!sub, rootDomain: ROOT_DOMAIN }
  }

  // IP or non-domain — treat as root.
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    return { slug: null, isTenantHost: false, rootDomain: ROOT_DOMAIN }
  }

  // Production matching against ROOT_DOMAIN.
  if (host === ROOT_DOMAIN || host === `www.${ROOT_DOMAIN}`) {
    return { slug: null, isTenantHost: false, rootDomain: ROOT_DOMAIN }
  }
  if (host.endsWith(`.${ROOT_DOMAIN}`)) {
    const sub = host.slice(0, -(`.${ROOT_DOMAIN}`).length)
    return { slug: sub || null, isTenantHost: !!sub, rootDomain: ROOT_DOMAIN }
  }

  // Unknown host (e.g. Vercel preview): treat as root.
  return { slug: null, isTenantHost: false, rootDomain: ROOT_DOMAIN }
}

/** Returns the active tenant slug for the current browser context. */
export function getTenantSlug(): string | null {
  if (typeof window === "undefined") return null
  return parseTenant(window.location.hostname).slug
}

/** Build a URL to switch to another tenant subdomain. */
export function buildTenantUrl(slug: string | null, path = "/"): string {
  if (typeof window === "undefined") return path
  const proto = window.location.protocol
  const port = window.location.port ? `:${window.location.port}` : ""
  const host = slug ? `${slug}.${ROOT_DOMAIN}` : ROOT_DOMAIN
  // In dev, use *.localhost so the foundation works locally too.
  if (window.location.hostname.endsWith("localhost") || window.location.hostname === "localhost") {
    const devHost = slug ? `${slug}.localhost` : "localhost"
    return `${proto}//${devHost}${port}${path}`
  }
  return `${proto}//${host}${path}`
}
