import withPWA from '@ducanh2912/next-pwa'

const withPWAConfig = withPWA({
  dest: 'public',
  cacheOnFrontEndNav: true,
  reloadOnOnline: true,
  // Manual registration so we can wrap in try/catch and handle CacheStorage errors
  register: false,
  disable: process.env.NODE_ENV === 'development',
})

export default withPWAConfig({})
