module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2021: true
  },
  extends: [
    'eslint:recommended',
    'plugin:vue/vue3-recommended',
    'plugin:@typescript-eslint/recommended'
  ],
  parser: 'vue-eslint-parser',
  parserOptions: {
    parser: '@typescript-eslint/parser',
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  plugins: [
    'vue',
    '@typescript-eslint'
  ],
  rules: {
    // 여기에 프로젝트별 규칙을 추가할 수 있습니다.
    // 예: 'vue/multi-word-component-names': 'off'
  },
  ignorePatterns: [
    'dist',
    'dist-electron',
    'node_modules',
    'release',
    'playwright-report',
    'test-results'
  ]
};
