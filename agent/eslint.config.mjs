export default [{
  files: ['src/**/*.mjs', 'tests/**/*.mjs'],
  languageOptions: {
    ecmaVersion: 'latest', sourceType: 'module',
    globals: { console: 'readonly', process: 'readonly', URL: 'readonly', Buffer: 'readonly' },
  },
  rules: {
    'no-undef': 'error', 'no-unused-vars': 'error', 'no-unreachable': 'error',
    'no-dupe-keys': 'error', eqeqeq: 'error',
  },
}];
