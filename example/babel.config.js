module.exports = function (api) {
  api.cache(true);
  return {
    // Force resolution of babel-preset-expo from the example's own
    // Expo 54 install. Without `paths`, Node module resolution walks up
    // to the SDK's stale `node_modules/babel-preset-expo@9.5.2` (Expo 49
    // era) which is missing modern plugins like
    // `@babel/plugin-transform-private-methods`.
    presets: [
      require.resolve('babel-preset-expo', {
        paths: [require.resolve('expo/package.json')],
      }),
    ],
  };
};
