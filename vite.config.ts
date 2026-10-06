/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages는 /<저장소이름>/ 아래에서 서비스되므로 배포 시 BASE_PATH로 지정한다.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: '우리 가족 학습 스테이션',
        short_name: '학습스테이션',
        description: '첫째, 둘째, 보호자를 위한 매일 학습 미션',
        lang: 'ko',
        theme_color: '#4f46e5',
        background_color: '#f5f3ff',
        display: 'standalone',
        start_url: base,
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
    }),
  ],
  test: {
    environment: 'node',
  },
});
