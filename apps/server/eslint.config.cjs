// Flat config (ESLint v9+). Estende o preset compartilhado do monorepo.
const shared = require('@boardzando/eslint-config');

module.exports = [{ ignores: ['dist/**'] }, ...shared];
