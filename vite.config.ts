import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              // Modules publics déjà nécessaires au premier rendu : limiter les petits
              // chunks partagés et la duplication gzip sans charger de domaine ERP.
              {
                name: 'public-shared',
                test: /src[\\/](context[\\/](AuthContext|UIContext|domains[\\/]MarketplaceDomainContext)\.tsx|lib[\\/](supabase|bookingVault|businessTime|marketplace|marketplace-content|apiError)\.ts)$/,
                priority: 40,
              },
              {
                name: 'vendor-react',
                test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/,
                priority: 30,
              },
              {
                name: 'vendor-supabase',
                test: /node_modules[\\/]@supabase[\\/]/,
                priority: 20,
              },
            ],
          },
        },
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
