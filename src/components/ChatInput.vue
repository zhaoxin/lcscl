<script setup>
import { ref, computed } from "vue"
import { normalize_msg, send_prompt } from "./lib.js"

const props = defineProps({
    cfg: Object,
    active_chat: Object,
    zen_mode: Boolean,
})

const emit = defineEmits(["new_msg_pushed", "arg_stop_checked", "arg_logitbias_checked"]);

const history_index = ref(0);

const edit_api_key = computed(()=>{
    return !props.cfg.api_key
});

function prompt_pasted(e) {
    if(!props.zen_mode) {
        props.cfg.input_mode = e.clipboardData.getData("text/plain").indexOf("\n") > -1?"multipleline":"singleline";
    }
}

function navigate_history(direction) {
    if(direction != 1 && direction != -1) {
        return
    }
    const history_db = normalize_msg(props.active_chat.messages, props.cfg.compact_mode).filter((m)=>{return m.role == 'user'});
    if(history_db.length < 1) {
        return
    }
    history_index.value += direction;
    if(history_index.value < 0 || history_index.value >= history_db.length) {
        if(direction == -1) {
            history_index.value = history_db.length-1;
        }
        if(direction == 1) {
            history_index.value = 0;
        }
    }
    props.active_chat.new_prompt = history_db[history_index.value].content;
}
</script>
<template>
    <button v-if="cfg.input_mode=='singleline'||zen_mode" 
        :style="zen_mode?'position: relative; top: 10px; margin-bottom: -25px; right: 5px;':'position: relative; top: 5px; margin-bottom: -30px; right: 5px;'" 
        class="btn btn-sm float-end" 
        :class="{'btn-primary':!zen_mode}" 
        :disabled="edit_api_key" 
        @click="send_prompt(active_chat, false, cfg.auto_title, cfg.compact_mode, cfg.use_proxy, cfg.api_key, ()=>{emit('new_msg_pushed')})" 
        aria-label="提交" 
        title="提交"><i class="bi bi-send"></i>
    </button>
    <input v-if="cfg.input_mode=='singleline'||zen_mode" 
        style="padding-right: 40px;" 
        autocomplete="off" 
        class="form-control" 
        :class="zen_mode?'my-2 rounded-0 border-0':'border-2'" 
        :disabled="edit_api_key" 
        :placeholder="edit_api_key?'尚未设置API Key':''" 
        type="text" 
        ref="maininput" 
        v-focus 
        v-model="active_chat.new_prompt" 
        @paste="prompt_pasted" 
        @keyup.enter="send_prompt(active_chat, false, cfg.auto_title, cfg.compact_mode, cfg.use_proxy, cfg.api_key, ()=>{emit('new_msg_pushed')})" 
        @keyup.arrow-up="navigate_history(-1)" 
        @keyup.arrow-down="navigate_history(1)"
    >
    <textarea v-else 
        autocomplete="off" 
        class="form-control border-2" 
        :disabled="edit_api_key" 
        :placeholder="edit_api_key?'尚未设置API Key':''" 
        ref="maininput" 
        v-focus 
        v-model="active_chat.new_prompt" 
        @keyup.ctrl.enter="send_prompt(active_chat, false, cfg.auto_title, cfg.compact_mode, cfg.use_proxy, cfg.api_key, ()=>{emit('new_msg_pushed')})" 
        @keyup.ctrl.arrow-up="navigate_history(-1)" 
        @keyup.ctrl.arrow-down="navigate_history(1)" 
        rows="5">
    </textarea>
    <button v-if="cfg.input_mode!='singleline'&&!zen_mode" 
        class="mt-1 btn btn-sm btn-primary float-end" 
        :disabled="edit_api_key" 
        @click="send_prompt(active_chat, false, cfg.auto_title, cfg.compact_mode, cfg.use_proxy, cfg.api_key, ()=>{emit('new_msg_pushed')})" 
        aria-label="提交" 
        title="提交"><i class="bi bi-send"></i>
    </button>
    <div v-if="!zen_mode&&active_chat&&active_chat.arguments.stream!=true" 
        class="mt-1 fs-8 text-muted fw-light clearfix w-100">
        <template v-if="!edit_api_key"><i class="bi bi-info-circle me-1"></i>当前话题消耗点数：{{active_chat.used_tokens}}</template>
        <i v-else class="bi">&nbsp;</i>
    </div>
</template>