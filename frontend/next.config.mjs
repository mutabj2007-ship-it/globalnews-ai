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
};

export default nextConfig;
