import { createApp, nextTick } from "vue"
import App from "./App.vue"
import Studio from "./Studio.vue"

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js');
    });
}

const app = createApp(window.location.pathname=="/prompts"?Studio:App);
app.directive("focus", {
    mounted: (el)=> {
        nextTick(()=>{
            el.focus();
        });
    }
});
app.mount('#app')
