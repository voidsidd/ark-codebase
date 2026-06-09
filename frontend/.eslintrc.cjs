module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'node_modules'],
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    // Relax rules that fire heavily on TypeScript files without @typescript-eslint
    'no-unused-vars': 'off',
    'no-undef': 'off',
    'no-redeclare': 'off',
  },
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  overrides: [
    {
      // TypeScript files — skip JS-only rules that TS already enforces
      files: ['*.ts', '*.tsx'],
      rules: {
        'no-unused-vars': 'off',
        'no-undef': 'off',
      },
    },
  ],
}
