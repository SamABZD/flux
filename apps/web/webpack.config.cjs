const path = require('node:path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

module.exports = (_env, argv) => {
  const production = argv.mode === 'production';
  const apiBaseUrl = process.env.WEB_API_BASE_URL || 'http://localhost:3001';
  const relativeApiPath = /^\/[a-z0-9/_-]*$/i.test(apiBaseUrl) && !apiBaseUrl.includes('..');
  if (!relativeApiPath) {
    let apiUrl;
    try {
      apiUrl = new URL(apiBaseUrl);
    } catch {
      throw new Error('WEB_API_BASE_URL must be an HTTP(S) URL or a same-origin path.');
    }
    if (!['http:', 'https:'].includes(apiUrl.protocol) || apiUrl.username || apiUrl.password) {
      throw new Error('WEB_API_BASE_URL must be a public HTTP(S) URL without credentials.');
    }
  }
  const port = Number(process.env.WEB_PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('WEB_PORT must be a port between 1 and 65535.');
  }

  return {
    entry: './src/main.tsx',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: production ? '[name].[contenthash].js' : '[name].js',
      publicPath: '/',
      clean: true,
    },
    devtool: production ? false : 'eval-cheap-module-source-map',
    resolve: { extensions: ['.tsx', '.ts', '.js'], alias: { '@': path.resolve(__dirname, 'src') } },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          use: { loader: 'ts-loader', options: { compilerOptions: { noEmit: false } } },
        },
        { test: /\.css$/, use: ['style-loader', 'css-loader'] },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({ template: './public/index.html' }),

      new webpack.DefinePlugin({ __API_BASE_URL__: JSON.stringify(apiBaseUrl.replace(/\/$/, '')) }),
    ],
    optimization: { runtimeChunk: 'single' },
    devServer: {
      host: 'localhost',
      port,
      historyApiFallback: true,
      hot: true,
      client: { overlay: true },
    },
    performance: production
      ? { hints: 'error', maxEntrypointSize: 425 * 1024, maxAssetSize: 425 * 1024 }
      : false,
  };
};
