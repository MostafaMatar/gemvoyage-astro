// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: cloudflare(),
  site: 'https://gemvoyage.net', // Update with your actual domain
  integrations: [
    tailwind({
      // Apply Tailwind's base styles
      applyBaseStyles: false, // We'll handle this in global.css
    })
  ],
  vite: {
    define: {
      global: 'globalThis',
    },
    optimizeDeps: {
      exclude: ['undici']
    }
  }
});