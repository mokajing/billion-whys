import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'

export default [
  js.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['src/h5/**/*.{js,vue}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        __APP_VERSION__: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'warn',
      'vue/multi-word-component-names': 'off',
      'vue/no-v-html': 'off',
    },
  },
  {
    files: ['src/h5/**/__tests__/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        vi: 'readonly',
      },
    },
  },
  {
    files: ['*.config.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    ignores: ['dist/', 'node_modules/', 'src/miniprogram/', 'scripts/', 'content/'],
  },
]
