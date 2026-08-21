/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Live news providers (GNews and any future real provider) serve
    // article images from an unbounded, provider-controlled set of
    // domains — there is no fixed list to whitelist. A wildcard
    // remotePattern is the officially recommended approach for this
    // case instead of hand-maintaining a domain allowlist.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },

  /**
   * PWA — two response headers, both load-bearing.
   *
   * /sw.js must never be cached by a browser, a proxy or a CDN. If an
   * intermediary pins an old service worker, users are stranded on it and the
   * update path this application relies on (skipWaiting + clients.claim, see
   * public/sw.js) can never run. `Service-Worker-Allowed: /` states the scope
   * explicitly rather than depending on the script's own path.
   *
   * /manifest.webmanifest needs `application/manifest+json`. Static-file
   * content-type resolution varies by host and a wrong type can make a browser
   * reject the manifest outright — which fails installability silently, with no
   * console error worth the name.
   *
   * Nothing above this block changes: reactStrictMode and the wildcard
   * remotePatterns are exactly as they were.
   */
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/manifest.webmanifest',
        headers: [{ key: 'Content-Type', value: 'application/manifest+json' }],
      },
    ];
  },
};

export default nextConfig;
