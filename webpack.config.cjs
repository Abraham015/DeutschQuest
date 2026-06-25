const path = require("path");
const fs = require("fs");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const webpack = require("webpack");

function loadDotEnv() {
  const envPath = path.resolve(__dirname, ".env");
  if (!fs.existsSync(envPath)) return {};

  return fs.readFileSync(envPath, "utf8").split(/\r?\n/).reduce((values, line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return values;

    const separator = trimmed.indexOf("=");
    if (separator === -1) return values;

    values[trimmed.slice(0, separator)] = trimmed.slice(separator + 1);
    return values;
  }, {});
}

const localEnv = loadDotEnv();
const supabaseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || localEnv.SUPABASE_URL || localEnv.REACT_APP_SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY || localEnv.SUPABASE_ANON_KEY || localEnv.REACT_APP_SUPABASE_ANON_KEY || "";

module.exports = {
  entry: "./src/main.tsx",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "assets/[name].[contenthash].js",
    clean: true,
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: "ts-loader",
      },
      {
        test: /\.css$/i,
        use: ["style-loader", "css-loader"],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: "./index.html",
    }),
    new webpack.DefinePlugin({
      "process.env.SUPABASE_URL": JSON.stringify(supabaseUrl),
      "process.env.SUPABASE_ANON_KEY": JSON.stringify(supabaseAnonKey),
      "process.env.REACT_APP_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "process.env.REACT_APP_SUPABASE_ANON_KEY": JSON.stringify(supabaseAnonKey),
    }),
  ],
  devServer: {
    historyApiFallback: true,
    hot: true,
    open: false,
    port: 5173,
  },
};
