import { defineConfig } from '@playwright/test';

/**
 * Playwright E2E 테스트 설정
 * Electron 앱 테스트를 위한 구성
 */
export default defineConfig({
  testDir: './tests/e2e',
  
  // 테스트 타임아웃 (Electron 앱 시작 시간 고려)
  timeout: 30 * 1000,
  
  // 병렬 실행 비활성화 (Electron 단일 인스턴스)
  fullyParallel: false,
  workers: 1,
  
  // 실패 시 재시도
  retries: process.env.CI ? 2 : 0,
  
  // 리포터 설정
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],
  
  use: {
    // 스크린샷 및 트레이스 설정
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  // Electron 테스트 프로젝트
  projects: [
    {
      name: 'electron',
      testMatch: '**/*.spec.ts',
    },
  ],
});
