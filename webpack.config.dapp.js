const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const webpack = require('webpack')

module.exports = {
  entry: ['babel-polyfill', path.join(__dirname, "src/dapp")],
  output: {
    path: path.join(__dirname, "prod/dapp"),
    filename: "bundle.js"
  },
  module: {
    rules: [{
        test: /\.(js|jsx)$/,
        use: "babel-loader",
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"]
      },
      {
        test: /\.(png|svg|jpg|gif)$/,
        use: [
          'file-loader'
        ]
      },
      {
        test: /\.html$/,
        use: "html-loader",
        exclude: /node_modules/
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.join(__dirname, "src/dapp/index.html")
    }),
    new HtmlWebpackPlugin({ // Also generate a test.html
      filename: 'airlines.html',
      template: 'src/dapp/airlines.html'
    }),
    new HtmlWebpackPlugin({ // Also generate a test.html
      filename: 'passengers.html',
      template: 'src/dapp/passengers.html'
    }),
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
    }),
    new webpack.ProvidePlugin({
      process: 'process/browser',
    }),

  ],
  resolve: {
    extensions: [".js"],
    fallback: {
      "url": require.resolve("url/"),
      "os": require.resolve("os-browserify/browser"),
      "https": require.resolve("https-browserify"),
      "http": require.resolve("stream-http"),
      "assert": require.resolve("assert/"),
      "crypto": require.resolve("crypto-browserify"),
      "stream": require.resolve("stream-browserify"),
      "buffer": require.resolve("buffer")
    }
  },
  devServer: {
    static: path.join(__dirname, "dapp"),
    port: 8000,
  }
};