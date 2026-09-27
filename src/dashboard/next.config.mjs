const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_DISCORD_CLIENT_ID: process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || process.env.DISCORD_CLIENT_ID || '',
  },

  // next-auth v4's server-side route handler pulls in openid-client/jose,
  // which use private class fields. Left to Next's default webpack bundling,
  // those classes can end up split across more than one compiled chunk, and
  // an instance created in one chunk then fails with "Cannot read private
  // member #state from an object whose class did not declare it" when used
  // from another. Keeping them external makes Next require() them straight
  // from node_modules instead. Only these two - not "next-auth" itself,
  // since next-auth/react's client hooks (useSession, SessionProvider) must
  // stay bundled normally or they break during prerendering.
  serverExternalPackages: ['openid-client', 'jose'],

  experimental: {
    externalDir: true,
  },
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias || {}),
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    return config;
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
