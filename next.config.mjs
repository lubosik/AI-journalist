import withPWA from '@ducanh2912/next-pwa'

const withPWAConfig = withPWA({
  dest: 'public',
  cacheOnFrontEndNav: true,
  reloadOnOnline: true,
  register: false,
  disable: process.env.NODE_ENV === 'development',
  workboxOptions: {
    // Don't cache API responses — dashboard needs live data
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/fonts\.(?:gstatic)\.com\/.*/i,
        handler: 'CacheFirst',
        options: { cacheName: 'google-fonts-webfonts', expiration: { maxEntries: 4, maxAgeSeconds: 31536000 } },
      },
      {
        urlPattern: /^https:\/\/fonts\.(?:googleapis)\.com\/.*/i,
        handler: 'StaleWhileRevalidate',
        options: { cacheName: 'google-fonts-stylesheets', expiration: { maxEntries: 4, maxAgeSeconds: 604800 } },
      },
      {
        urlPattern: /\.(?:eot|otf|ttc|ttf|woff|woff2|font\.css)$/i,
        handler: 'StaleWhileRevalidate',
        options: { cacheName: 'static-font-assets', expiration: { maxEntries: 4, maxAgeSeconds: 604800 } },
      },
      {
        urlPattern: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
        handler: 'StaleWhileRevalidate',
        options: { cacheName: 'static-image-assets', expiration: { maxEntries: 64, maxAgeSeconds: 86400 } },
      },
      {
        urlPattern: /\/_next\/static.+\.js$/i,
        handler: 'CacheFirst',
        options: { cacheName: 'next-static-js-assets', expiration: { maxEntries: 64, maxAgeSeconds: 86400 } },
      },
      {
        urlPattern: /\/_next\/image\?url=.+$/i,
        handler: 'StaleWhileRevalidate',
        options: { cacheName: 'next-image', expiration: { maxEntries: 64, maxAgeSeconds: 86400 } },
      },
      // Pages: always try network first, short cache, no timeout fallback for stale data
      {
        urlPattern: ({ url, sameOrigin }) => sameOrigin && !url.pathname.startsWith('/api/'),
        handler: 'NetworkFirst',
        options: { cacheName: 'pages', networkTimeoutSeconds: 3, expiration: { maxEntries: 32, maxAgeSeconds: 300 } },
      },
    ],
  },
})

export default withPWAConfig({
  async headers() {
    return [
      {
        // Never cache the service worker itself so browsers always pick up updates immediately
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }],
      },
    ]
  },
})
