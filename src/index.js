import Vue from 'vue/dist/vue.esm.browser'
import App from "./app.vue";

new Vue({
  el: "#app",
  components: {
    App
  },
  render(h) {
    return h("App");
  }
});
