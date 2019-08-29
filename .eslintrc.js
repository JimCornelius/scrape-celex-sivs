module.exports = {
  env: {
    browser: true,
    node: true,
    es6: true,
  },
  extends: [
    'airbnb-base',
  ],
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly',
  },
  parser: 'babel-eslint',
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
  },
  rules: {
    "quote-props": "off",
    "no-console": "off",
    "no-prototype-builtins": "off",
    "no-param-reassign": ["error", { "props": false }],
    "import/extensions": ["error", "ignorePackages"]
  },
};
