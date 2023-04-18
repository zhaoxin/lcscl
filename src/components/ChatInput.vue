<script setup>
import { ref, computed, nextTick } from "vue"
import axios from "axios"
import { fetchEventSource, EventStreamContentType } from "@microsoft/fetch-event-source"

const props = defineProps({
    cfg: Object,
    active_chat: Object,
    zen_mode: Boolean,
})

const emit = defineEmits(["new_msg_pushed", "arg_stop_checked", "arg_logitbias_checked"]);

const new_prompt = ref("");
const history_index = ref(0);

const edit_api_key = computed(()=>{
    return !props.cfg.api_key
});

function prompt_pasted(e) {
    if(!props.zen_mode) {
        props.cfg.input_mode = e.clipboardData.getData("text/plain").indexOf("\n") > -1?"multipleline":"singleline";
    }
}

function normalize_msg(msgs) {
    const rslt = msgs.filter((m)=>{return m.role == "system" || m.role == "user" || m.role == "assistant"}).map((m)=>{return {role: m.role, content: m.content}});
    if(props.cfg.compact_mode) {
        for(var i=rslt.length-1; i >= 0; i--) {
            if(rslt[i].role=="user") {
                return [rslt[0], rslt[i]];
            }
        }
    }
    else {
        return rslt;
    }
}

function navigate_history(direction) {
    if(direction != 1 && direction != -1) {
        return
    }
    const history_db = normalize_msg(props.active_chat.messages).filter((m)=>{return m.role == 'user'});
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
    new_prompt.value = history_db[history_index.value].content;
}

function send_moderation(msg2moderate) {
    msg2moderate._flagged = 0;
    const req_body = {"model": "text-moderation-latest", "input": msg2moderate.content};
    axios.post(
        props.cfg.use_proxy=="openai"?"https://api.openai.com/v1/moderations":"https://moderate.lcscl.net", 
        req_body, 
        {
            headers:{"Authorization": "Bearer "+props.cfg.api_key}
        }
    )
    .then(function(resp) {
        if(resp.data.results && resp.data.results[0] && resp.data.results[0].flagged==true) {
            msg2moderate._flagged = 2;
        }
    })
    .catch(function(err) {
        if(err.response && err.response.status == 401) {
            msg2moderate._flagged = -1;
        }
        else {
            msg2moderate._flagged = 1;
        }
    })
    .then(function(){
        if(msg2moderate._flagged > 0 && msg2moderate.role == "assistant") {
            msg2moderate.content = "**********"//.repeat(msg2moderate.content.length);
        }
    });                
}

function validate_argument(chat, arg) {
    if(!arg || arg=="stop") {
        try {
            var prefix = "";
            var postfix = "";
            if(chat.arguments.stop && chat.arguments.stop[0] != "[" && chat.arguments.stop[0] != '"' && chat.arguments.stop[chat.arguments.stop.length-1] != "]" && chat.arguments.stop[chat.arguments.stop.length-1] != '"') {
                prefix = '"';
                postfix = '"';
            }
            const s = JSON.parse(prefix + chat.arguments.stop + postfix);
            emit("arg_stop_checked", true);
            return true;
        }
        catch(err) {
            emit("arg_stop_checked", false);
            return false;
        }
    }
    if(!arg || arg=="logit_bias") {
        try {
            if(chat.arguments.logit_bias && (chat.arguments.logit_bias[0] != "{" || chat.arguments.logit_bias[chat.arguments.logit_bias.length-1] != '}')) {
                emit("arg_logitbias_checked", false);
                return false;
            }
            const s = JSON.parse(chat.arguments.logit_bias);
            emit("arg_logitbias_checked", true);
            return true;
        }
        catch(err) {
            emit("arg_logitbias_checked", false);
            return false;
        }
    }
}

function compose_arguments(chat) {
    if(chat.arguments.temperature < 0 || chat.arguments.temperature > 2) {
        chat.arguments.temperature = 1;
    }
    if(chat.arguments.top_p < 0 || chat.arguments.top_p > 1) {
        chat.arguments.top_p = 1;
    }
    if(chat.arguments.presence_penalty < -2 || chat.arguments.presence_penalty > 2) {
        chat.arguments.presence_penalty = 0;
    }
    if(chat.arguments.frequency_penalty < -2 || chat.arguments.frequency_penalty > 2) {
        chat.arguments.frequency_penalty = 0;
    }
    if(!validate_argument(chat, "stop")) {
        chat.arguments.stop = null;
    }
    if(!validate_argument(chat, "logit_bias")) {
        chat.arguments.logit_bias = null;
    }
    if(chat.arguments.max_tokens < 1) {
        chat.arguments.max_tokens = 0;
    }
    const arg2use = {
        messages: normalize_msg(chat.messages),
        model: "gpt-3.5-turbo",
        temperature: chat.arguments.temperature,
        top_p: chat.arguments.top_p,
        presence_penalty: chat.arguments.presence_penalty,
        frequency_penalty: chat.arguments.frequency_penalty,
        stop: chat.arguments.stop,
        stream: chat.arguments.stream,
    };
    if(chat.arguments.max_tokens >= 1) {
        arg2use["max_tokens"] = chat.arguments.max_tokens;
    }
    if(chat.arguments.logit_bias) {
        arg2use["logit_bias"] = chat.arguments.logit_bias;
    }
    return arg2use
}

function stop_streaming(chat) {
    chat.stream_controller.abort();
    chat.stream_controller = null;
    chat.waiting_for_resp = false;
}

function stream_prompt(chat) {
    var new_answer = "";
    var counter = 0
    const msgidx = chat.messages.length;
    chat.stream_controller = new AbortController();
    fetchEventSource(
        props.cfg.use_proxy=="openai"?"https://api.openai.com/v1/chat/completions":"https://stream.lcscl.net", 
        {
            method: "POST",
            body: JSON.stringify(compose_arguments(chat)), 
            headers:{"Authorization": "Bearer "+props.cfg.api_key, "Content-Type": "application/json"}, 
            signal: chat.stream_controller.signal,
            onopen(resp) {
                if(resp.ok && resp.headers.get("content-type") === EventStreamContentType) {
                    console.log("Connected.")
                }
            },
            onmessage(ev) {
                if(ev.data != "[DONE]") {
                    const chunk = JSON.parse(ev.data);
                    counter += 1
                    if(counter == 1) {
                        console.log("first chunk!")
                        chat.messages.push({
                            "role": "assistant", 
                            "content": "", 
                            "_render_mode": "html", 
                            "_used_tokens": NaN, 
                            "_created_ts": (new Date(chunk.created * 1000)).toLocaleString(),
                            "_received_ts": (new Date()).toLocaleString()
                        });
                    }
                    const delta = chunk.choices[0].delta;
                    if(delta.content) {
                        new_answer += delta.content;
                        chat.messages.splice(
                            msgidx, 
                            1, 
                            {
                                "role": "assistant", 
                                "content": new_answer, 
                                "_render_mode": "html", 
                                "_used_tokens": NaN, 
                                "_created_ts": (new Date(chunk.created * 1000)).toLocaleString(),
                                "_received_ts": (new Date()).toLocaleString()
                            }
                        );
                    }
                }
                else {
                    // 审核回复
                    send_moderation(chat.messages[chat.messages.length - 1]);
                    // 自动命名
                    const round_count = chat.messages.filter(m=>m.role=="assistant").length;
                    if(props.cfg.auto_title == "allr" || (props.cfg.auto_title == "first3r" && round_count > 0 && round_count <= 3)) {
                        get_title(chat);
                    }
                }
                nextTick(()=>{emit("new_msg_pushed")});
            },
            onclose() {
                console.log("Server closed.");
                chat.waiting_for_resp = false;
            },
            onerror(err) {
                chat.waiting_for_resp = false;
                chat.messages.push({"role": "_local", "content": err});
                console.error(err);
                throw err;
            }
        }
    );
}

function send_prompt(callback_chat, is_retry) {
    if((new_prompt.value || is_retry) && !callback_chat.waiting_for_resp) {
        callback_chat.waiting_for_resp = true;
        if(!is_retry) {
            const msg = new_prompt.value;
            new_prompt.value = "";
            callback_chat.messages.push({"role": "user", "content": msg, "_ts": (new Date()).toLocaleString()});
        }
        // 审核输入
        send_moderation(callback_chat.messages[callback_chat.messages.length - 1]);
        nextTick(()=>{emit("new_msg_pushed");});
        if(callback_chat.arguments.stream) {
            stream_prompt(callback_chat);
        }
        else {
            axios.post(
                props.cfg.use_proxy=="openai"?"https://api.openai.com/v1/chat/completions":"https://api.lcscl.net", 
                compose_arguments(callback_chat), 
                {headers:{"Authorization": "Bearer "+props.cfg.api_key}})
            .then(function(resp) {
                if(resp.data.choices && resp.data.choices[0] && resp.data.choices[0].message) {
                    const new_answer = resp.data.choices[0].message;
                    callback_chat.messages.push(new_answer);
                    new_answer._used_tokens = NaN;
                    new_answer._render_mode = "html";
                    new_answer._created_ts = (new Date(resp.data.created * 1000)).toLocaleString();
                    new_answer._received_ts = (new Date()).toLocaleString();
                    const round_count = callback_chat.messages.filter(m=>m.role=="assistant").length;
                    if(resp.data.usage) {
                        new_answer._used_tokens = resp.data.usage.total_tokens;
                        callback_chat.used_tokens += resp.data.usage.total_tokens;
                    }
                    // 审核回复
                    send_moderation(callback_chat.messages[callback_chat.messages.length - 1]);
                    // 自动命名
                    if(props.cfg.auto_title == "allr" || (props.cfg.auto_title == "first3r" && round_count > 0 && round_count <= 3)) {
                        get_title(callback_chat);
                    }
                }
            })
            .catch(function(err) {
                if(err.response && err.response.status==401) {
                    callback_chat.messages.push({"role": "_local", "content": "无效的API key"});
                }
                else {
                    callback_chat.messages.push({"role": "_local", "content": err.message});
                }
            })
            .then(function(){
                callback_chat.waiting_for_resp = false;
                emit("new_msg_pushed");
            });
        }
    }
}

function get_title(chat) {
    // this.confirming_remove_chat = false;
    // this.confirming_clear_chat = false;
    // this.show_share_panel = false;
    const cntxt = normalize_msg(chat.messages);
    const round_count = cntxt.filter(m=>m.role=="assistant").length;
    if(!chat.waiting_for_title && round_count > 0) {
        chat.waiting_for_title = true;
        axios.post(
            props.cfg.use_proxy=="openai"?"https://api.openai.com/v1/chat/completions":"https://api.lcscl.net", 
            {
                "model": "gpt-3.5-turbo", "messages": cntxt.concat([{"role": "user", "content": "Please give this conversation a title in less than 10 words. Without any punctuation."}]), 
                "temperature": 0
            }, 
            {headers:{"Authorization": "Bearer "+props.cfg.api_key}})
        .then(function(resp) {
            if(resp.data.choices && resp.data.choices[0] && resp.data.choices[0].message) {
                chat.topic = resp.data.choices[0].message.content;
                if(chat.topic.endsWith(".") || chat.topic.endsWith("。")) {
                    chat.topic = chat.topic.slice(0, -1);
                }
            }
        })
        .catch(function(err) {
            console.log(err.message);
        })
        .then(function(){
            chat.waiting_for_title = false;
        });
    }
}
</script>
<template>
    <button v-if="cfg.input_mode=='singleline'||zen_mode" 
        :style="zen_mode?'position: relative; top: 10px; margin-bottom: -25px; right: 5px;':'position: relative; top: 5px; margin-bottom: -30px; right: 5px;'" 
        class="btn btn-sm float-end" 
        :class="{'btn-primary':!zen_mode}" 
        :disabled="edit_api_key" 
        @click="send_prompt(active_chat, false)" 
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
        v-model="new_prompt" 
        @paste="prompt_pasted" 
        @keyup.enter="send_prompt(active_chat, false)" 
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
        v-model="new_prompt" 
        @keyup.ctrl.enter="send_prompt(active_chat, false)" 
        @keyup.ctrl.arrow-up="navigate_history(-1)" 
        @keyup.ctrl.arrow-down="navigate_history(1)" 
        rows="5">
    </textarea>
    <button v-if="cfg.input_mode!='singleline'&&!zen_mode" 
        class="mt-1 btn btn-sm btn-primary float-end" 
        :disabled="edit_api_key" 
        @click="send_prompt(active_chat, false)" 
        aria-label="提交" 
        title="提交"><i class="bi bi-send"></i>
    </button>
    <div v-if="!zen_mode&&active_chat&&active_chat.arguments.stream!=true" 
        class="mt-1 fs-8 text-muted fw-light clearfix w-100">
        <template v-if="!edit_api_key"><i class="bi bi-info-circle me-1"></i>当前话题消耗点数：{{active_chat.used_tokens}}</template>
        <i v-else class="bi">&nbsp;</i>
    </div>
</template>