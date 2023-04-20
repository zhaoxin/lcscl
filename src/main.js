import { createApp, nextTick } from 'vue'
import App from './App.vue'

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js');
    });
}

const app = createApp(App);
app.directive("focus", {
    mounted: (el)=> {
        nextTick(()=>{
            el.focus();
        });
    }
});
app.mount('#app')
