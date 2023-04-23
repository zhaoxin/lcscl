<script setup>
import { ref } from "vue"
import ChatUI from "./ChatUI.vue"
import { send_prompt } from "./lib.js"

const props = defineProps({
    max_preview_panel: Boolean,
    active_prompt: Object,
    prompts: Object,
    cfg: Object,
    show_cfg_panel: Boolean
});
const emit = defineEmits(["all_prompts_removed", "last_prompt_removed", "prompt_removed"]);

const confirming_remove_prompt = ref(false);
const test_chat = ref(null);


function remove_prompt(prompt) {
    confirming_remove_prompt.value = false;
    const idx = props.prompts.indexOf(prompt);
    props.prompts.splice(idx, 1);
    if(props.prompts.length < 1) {
        emit("all_prompts_removed"); // 通知上级组件；上级进行new_prompt时内部会给active_prompt赋值
    }
    else if(idx >= props.prompts.length) {
        emit("last_prompt_removed");
    }
    else {
        emit("prompt_removed", idx);
    }
}

function run_test(p) {
    test_chat.value = {topic: "test", messages: JSON.parse(JSON.stringify(p.messages)), arguments: JSON.parse(JSON.stringify(p.arguments))};
    if(test_chat.value.messages[test_chat.value.messages.length-1].role == "user") {
        test_chat.value.messages[test_chat.value.messages.length-1]._ts = (new Date()).toLocaleString();
    }
    test_chat.value.used_tokens = 0;
    send_prompt(test_chat.value, true, "manual", false, props.cfg.use_proxy, props.cfg.custom_api, props.cfg.api_key, scrollToBottom);
}

function scrollToBottom() {
    const pg = document.getElementById("iplayground");
    if(pg) {
        pg.scrollTop = pg.scrollHeight;
    }
}
</script>
<template>
    <div v-if="!max_preview_panel || !test_chat" class="h-100 py-3" :class="test_chat?'col-md-4 col-sm-6':'col-md-8 col-sm-12'">
        <div v-if="active_prompt" class="h-100 d-flex flex-column">
            <div class="w-100 align-self-start">
                <h5 class="pb-2 fw-bold clearfix">指令设计
                    <button :disabled="!active_prompt.messages || active_prompt.messages.length<1 || !active_prompt.workflow || active_prompt.workflow.length<1" 
                        class="float-end btn btn-sm btn-success" 
                        @click="run_test(active_prompt)">
                        <i class="bi bi-play me-1"></i>测试
                    </button>
                    <button v-if="confirming_remove_prompt" class="float-end btn btn-sm btn-outline-danger me-2" @click="confirming_remove_prompt=false">
                        <i class="bi bi-x-lg"></i>
                    </button>
                    <button v-if="confirming_remove_prompt" class="float-end btn btn-sm btn-outline-danger me-2" @click="remove_prompt(active_prompt)">
                        <i class="bi bi-check-lg"></i>
                    </button>
                    <button class="float-end btn btn-sm btn-outline-danger me-2" @click="confirming_remove_prompt=true">
                        <i class="bi bi-trash me-1"></i>{{ confirming_remove_prompt?'确认删除？':'删除' }}
                    </button>
                </h5>
            </div>
            <div style="flex: 1; overflow-y: auto;">
                <div class="row mb-3 g-2 mx-0">
                    <div class="col">
                        <label class="form-label fw-bold" for="iprptname">名称</label>
                        <input id="iprptname" type="text" class="form-control form-control" v-model="active_prompt.name">
                    </div>
                </div>
                <div class="row mb-3 g-2 mx-0">
                    <div class="col">
                        <label class="form-label fw-bold" for="iprpticon">图标</label>
                        <input id="iprpticon" type="text" class="form-control form-control" v-model="active_prompt.icon">
                    </div>
                </div>
                <div class="row g-2 mx-0">
                    <div class="col">
                        <label class="form-label fw-bold">起始指令</label>
                    </div>
                </div>
                <button v-if="active_prompt.messages.length < 1" class="btn text-primary-emphasis" @click="active_prompt.messages.splice(1, 0, {role: 'system', content: ''})"><i class="bi bi-plus-circle"></i></button>
                <div v-for="msg,midx in active_prompt.messages" class="d-flex flex-row mb-2 mx-0 justify-content-between">
                    <div>
                        <select class="form-select" v-model="msg.role">
                            <option value="system">系统</option>
                            <option value="user">用户</option>
                            <option value="assistant">AI</option>
                        </select>
                    </div>
                    <div class="flex-grow-1 px-1">
                        <!-- <input type="text" class="form-control col-auto" v-model="msg.content"> -->
                        <textarea class="form-control" v-model="msg.content" rows="2"></textarea>
                    </div>
                    <div class="px-1">
                        <button class="btn text-primary-emphasis" @click="active_prompt.messages.splice(midx+1, 0, {role: 'user', content: ''})"><i class="bi bi-plus-circle"></i></button>
                        <button class="btn text-danger-emphasis" @click="active_prompt.messages.splice(midx, 1)"><i class="bi bi-dash-circle"></i></button>
                    </div>
                </div>
                <div class="row g-2 mx-0 mt-3">
                    <div class="col">
                        <label class="form-label fw-bold">处理响应</label>
                    </div>
                </div>
                <button v-if="active_prompt.workflow.length < 1" class="btn text-primary-emphasis" @click="active_prompt.workflow.splice(1, 0, {action: 'chat'})"><i class="bi bi-plus-circle"></i></button>
                <div v-for="node, nidx in active_prompt.workflow" class="d-flex mb-2 mx-0">
                    <div>
                        <select class="form-select" v-model="node.action">
                            <option value="chat">对话</option>
                            <option value="render">显示</option>
                            <option value="run_js">运行JavaScript</option>
                            <option value="run_python">运行Python</option>
                            <option value="download">下载</option>
                            <option value="redirect">转发</option>
                        </select>
                    </div>
                    <div>
                        <button class="btn text-primary-emphasis" @click="active_prompt.workflow.splice(nidx+1, 0, {action: 'chat'})"><i class="bi bi-plus-circle"></i></button>
                        <button class="btn text-danger-emphasis" @click="active_prompt.workflow.splice(nidx, 1)"><i class="bi bi-dash-circle"></i></button>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div v-if="test_chat" class="h-100 py-3 d-flex flex-column" :class="max_preview_panel?'col-md-7 col-sm-12':'col-md-4 col-sm-6'">
        <div class="clearfix">
            <button class="btn btn-sm text-secondary-emphasis float-start" @click="run_test(active_prompt)"><i class="bi bi-arrow-repeat"></i></button>
            <button class="btn btn-sm text-secondary-emphasis float-start" @click="test_chat=null"><i class="bi bi-x-lg"></i></button>
            <button class="btn btn-sm text-secondary-emphasis float-end" @click="max_preview_panel=!max_preview_panel"><i class="bi" :class="max_preview_panel?'bi-layout-sidebar':'bi-layout-sidebar-inset'"></i></button>
        </div>
        <ChatUI :view_only="false" :cfg="cfg" :chats="[test_chat]" :active_chat="test_chat" :zen_mode="false"/>
    </div>
</template>
<style scoped>
    input, select {
        border-bottom: 1px solid;
        border-top: 0!important;
        border-left: 0!important;
        border-right: 0!important;
        border-radius: 0!important;
        border-color: var(--bs-border-color);
    }
    textarea {
        border: 1px solid var(--bs-border-color)!important;
    }
</style>