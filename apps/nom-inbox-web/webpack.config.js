const webpack = require("webpack");
const createConfig = require("webpack-config");

require("dotenv").config();

module.exports = (...args) => {
  const config = createConfig(...args, { htmlTitle: "NOM Inbox" });
  return {
    ...config,
    entry: "./src/entry.js",
    plugins: [
      ...config.plugins,
      new webpack.EnvironmentPlugin({
        PUSHER_KEY: undefined,
        INFURA_PROJECT_ID: null,
        CLOUDFLARE_ACCT_HASH: null,
        DEV: null,
        SENTRY_DSN: null,
        WALLET_CONNECT_PROJECT_ID: null,
      }),
    ],
  };
};