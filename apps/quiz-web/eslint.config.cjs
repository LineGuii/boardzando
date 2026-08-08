const shared = require('@boardzando/eslint-config');
const reactHooks = require('eslint-plugin-react-hooks');

module.exports = [
  { ignores: ['dist/**'] },
  ...shared,
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];
