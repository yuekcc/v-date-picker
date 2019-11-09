import nodeResolve from "rollup-plugin-node-resolve";
import commonjs from "rollup-plugin-commonjs";
import vue from "rollup-plugin-vue";

export default {
  input: "src/index.js",
  output: {
    file: "dist/index.js",
    format: "umd",
    name: "VCal",
    sourceMap: true
  },
  plugins: [nodeResolve(), commonjs(), vue({ css: true })]
};
