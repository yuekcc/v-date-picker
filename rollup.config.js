import nodeResolve from "rollup-plugin-node-resolve";
import commonjs from "rollup-plugin-commonjs";
import svelte from "rollup-plugin-svelte";

export default {
  input: "src/index.js",
  output: {
    file: "dist/index.js",
    format: "umd",
    name: "VCal",
    sourceMap: true
  },
  plugins: [svelte(), nodeResolve(), commonjs()]
};
