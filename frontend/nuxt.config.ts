// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  
  // Disable devtools in production
  devtools: { enabled: process.env.NODE_ENV !== 'production' },
  
  modules: ['@nuxt/eslint', '@nuxt/ui'],
  
  // Runtime config - can be overridden by environment variables
  runtimeConfig: {
    public: {
      // API URL - set via NUXT_PUBLIC_API_URL env var
      apiUrl: process.env.NUXT_PUBLIC_API_URL || 'http://localhost:3001'
    }
  },

  // SSR configuration
  ssr: true,

  // App configuration
  app: {
    head: {
      title: 'Life Counter - MTG Commander',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no' },
        { name: 'description', content: 'Magic: The Gathering Commander life counter with real-time sync' },
        { name: 'theme-color', content: '#0a0a0a' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' }
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }
      ]
    }
  },

  // Nitro server configuration
  nitro: {
    // Compress responses
    compressPublicAssets: true
  }
})
