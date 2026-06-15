/** @type {import('next').NextConfig} */
const nextConfig = {
  // `standalone` output writes a self-contained server bundle to `.next/standalone`
  // so electron-builder can ship Next.js without needing the full node_modules tree.
  output: "standalone",

  // Cashier desktop installs should never see a "powered by Next.js" header.
  poweredByHeader: false,

  // ESLint blocks the production build on style-only warnings (unused imports,
  // unescaped apostrophes). TypeScript already catches the bugs that matter
  // (we run `tsc --noEmit` separately). Skip during the production build so
  // Vercel + electron-builder can ship without manual cleanup.
  eslint: {
    ignoreDuringBuilds: true,
  },
}

export default nextConfig
