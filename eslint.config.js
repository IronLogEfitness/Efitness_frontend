// Flat ESLint config for `expo lint` and the CI lint step. Extends Expo's shared
// rules for a React Native + TypeScript project. ESLint 9 flattens the nested
// array, so this works whether eslint-config-expo exports one config or several.
const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...(Array.isArray(expoConfig) ? expoConfig : [expoConfig]),
  {
    ignores: ['dist/*', 'node_modules/*', '.expo/*']
  }
];
