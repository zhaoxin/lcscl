<script setup>
import hljs from "highlight.js"
import { marked } from "marked"
import DOMPurify from "dompurify"
import { ref, computed, nextTick } from "vue"
import SystemMsg from "./SystemMsg.vue"
import ChatToolBar from "./ChatToolBar.vue"
import ChatInput from "./ChatInput.vue"
import { send_prompt, stop_streaming, try_again, predict_question } from "./lib.js"

const props = defineProps({
    cfg: Object,
    chats: Object,
    active_chat: Object,
    zen_mode: Boolean,
    view_only: Boolean,
    show_params: Boolean,
    allow_input: Boolean,
    agent_meta: Object,
})

const emit = defineEmits(["all_chats_removed", "last_chat_removed", "chat_removed"]);

const show_system_msg = ref(false);
const editing_user_msg = ref(null);
const editing_msg_backup = ref("");
const removing_msg = ref(false);
const editpromptinput = ref([]);
const editprompttextarea = ref([]);

const edit_api_key = computed(()=>{
    return !props.cfg.api_key&&props.cfg.use_proxy!="custom"
});

function _cleanUrl(sanitize, base, href) {
    if (sanitize) {
        var prot;
        try {
            prot = decodeURIComponent(decodeURI(href)).replace(nonWordAndColonTest, '').toLowerCase();
        } catch (e) {
            return null;
        }
        if (prot.indexOf('javascript:') === 0 || prot.indexOf('vbscript:') === 0 || prot.indexOf('data:') === 0) {
            return null;
        }
    }
    if (base && !originIndependentUrl.test(href)) {
        href = resolveUrl(base, href);
    }
    try {
        href = encodeURI(href).replace(/%25/g, '%');
    } catch (e) {
        return null;
    }
    return href;
}

const escapeTest = /[&<>"']/;
const escapeReplace = new RegExp(escapeTest.source, 'g');
const escapeTestNoEncode = /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/;
const escapeReplaceNoEncode = new RegExp(escapeTestNoEncode.source, 'g');
const escapeReplacements = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
};
const getEscapeReplacement = (ch) => escapeReplacements[ch];

function _escape(html, encode) {
    if (encode) {
        if (escapeTest.test(html)) {
        return html.replace(escapeReplace, getEscapeReplacement);
        }
    } else {
        if (escapeTestNoEncode.test(html)) {
        return html.replace(escapeReplaceNoEncode, getEscapeReplacement);
        }
    }

    return html;
}

const renderer = {
    link(href, title, text) {
        href = _cleanUrl(this.options.sanitize, this.options.baseUrl, href);
        if (href === null) {
            return text;
        }
        let out = '<a href="' + href + '"';
        if (title) {
            out += ' title="' + title + '"';
        }
        out += ' rel="noopener" target="_blank">' + text + '</a>';
        return out;
    },
    table(header, body) {
        if (body) body = `<tbody>${body}</tbody>`;

        return '<div class="overflow-x-auto"><table class="table table-bordered w-100 fs-8">\n'
        + '<thead>\n'
        + header
        + '</thead>\n'
        + body
        + '</table></div>\n';
    },
    code(code, infostring, escaped) {
        const lang = (infostring || '').match(/\S*/)[0];
        if (this.options.highlight) {
            const out = this.options.highlight(code, lang);
            if (out != null && out !== code) {
                escaped = true;
                code = out;
            }
        }

        code = code.replace(/\n$/, '') + '\n';

        if (!lang) {
            return '<pre><code><div class="clearfix border-bottom pb-1 mb-1 w-100"><button class="btn btn-sm text-success-emphasis float-start copycodebutton" aria-label="复制代码" title="复制代码"><i class="bi bi-clipboard copycodeicon"></i></button></div>'
                + (escaped ? code : _escape(code, true))
                + '</code></pre>\n';
        }

        return '<pre><span class="text-uppercase py-1 fw-bold float-end">'
        + _escape(lang)   
        + '</span><code class="'
        + this.options.langPrefix
        + _escape(lang)
        + '"><div class="clearfix border-bottom pb-1 mb-1 w-100"><button class="btn btn-sm text-success-emphasis float-start copycodebutton" aria-label="复制代码" title="复制代码"><i class="bi bi-clipboard copycodeicon"></i></button></div>'
        + (escaped ? code : _escape(code, true))
        + '</code></pre>\n';
    }
}
marked.setOptions({
    highlight: function(c, l) {
        return hljs.highlightAuto(c, [l]).value;
    }
});
marked.use({ renderer });

function purify(msg) {
    return DOMPurify.sanitize(marked.parse(msg.content), {ADD_ATTR: ["target"]});
}

function copy_code(e) {
    var code2copy = "";
    var h = null;
    if(e.target.classList.contains("copycodeicon")) {
        h = e.target.parentElement;
        code2copy = h.parentElement.parentElement.innerText;
    }
    else if(e.target.classList.contains("copycodebutton")) {
        h = e.target;
        code2copy = h.parentElement.parentElement.innerText;
    }
    else {
        return
    }
    navigator.clipboard.writeText(code2copy).then(
        () => {
            h.innerHTML = '<i class="bi bi-clipboard-check-fill copycodeicon"></i>';
        },
        () => {
            h.innerHTML = '<i class="bi bi-clipboard-x-fill text-danger-emphasis copycodeicon"></i>';
        }
    );
}

function copy_msg(e, msg) {
    var h = e.target;
    navigator.clipboard.writeText(msg.content).then(
        () => {
            h.className = "bi bi-clipboard-check-fill float-end ms-2";
        },
        () => {
            h.className = "bi bi-clipboard-x-fill text-danger-emphasis float-end ms-2";
        }
    );
}

function non_assistant_msg_class(role) {
    if(role == "system") {
        if((props.cfg && props.cfg.msg_view=="chatgpt")||props.zen_mode) {
            return "w-100 mb-0 px-4 pt-0 pb-0";
        }
        else {
            return "w-100 mb-0 px-1 pt-0 pb-0";
        }
    }
    else if((props.cfg && props.cfg.msg_view == "chatgpt")||props.zen_mode) {
        if(role == "_local") {
            return "w-100 text-danger-emphasis mb-0 px-0 pt-2 pb-0 chatgpt-msg-padding"+(props.zen_mode?"-zen":" border-bottom");
        }
        else {
            return "w-100 mb-0 px-0 pt-2 pb-0 chatgpt-msg-padding"+(props.zen_mode?"-zen":" border-bottom");                        
        } 
    }
    else if(props.cfg && props.cfg.msg_view == "card") {
        if(role == "_local") {
            return "alert alert-danger float-start mb-3 p-2 px-3";
        }
        else {
            return "alert alert-light float-end mb3 p-2 px-3";
        }
    }
    else {
        if(role == "_local") {
            return "w-100 text-danger-emphasis mb-1";
        }
        else {
            return "w-100 mb-1";
        } 
    }
}

function non_assistant_footer_class(role, is_bottom) {
    if(role == "system" && !show_system_msg.value) {
        return "pb-0 mb-0";
    }
    else if((props.cfg && props.cfg.msg_view == "chatgpt")||props.zen_mode) {
        if(role == "system") {
            return (is_bottom&&!props.zen_mode?"":"border-bottom ")+"pb-2";
        }
        else {
            return "mt-2 pb-3 text-secondary fs-8";
        }
    }
    else if(props.cfg && props.cfg.msg_view == "card") {
        if(role == "_local") {
            return "border-top mt-2 pt-2 border-danger-subtle text-secondary fs-8";
        }
        else if(role == "system") {
            return (is_bottom?"":"border-bottom ")+"pb-2 mb-3";
        }
        else {
            return "border-top mt-2 pt-2 text-secondary fs-8";
        }
    }
    else {
        if(role == "system") {
            return (is_bottom?"":"border-bottom ")+"pb-2 mb-2";
        }
        else {
            return (is_bottom?"":"border-bottom ")+"pb-3 mt-2 text-secondary fs-8";
        }
    }
}

function assistant_msg_class(is_bottom) {
    if((props.cfg && props.cfg.msg_view == "chatgpt")||props.zen_mode) {
        return "px-0 pt-2 pb-0 mb-0 w-100 chatgpt-msg-padding"+(props.zen_mode?"-zen":(is_bottom?"":" border-bottom"));
    }
    else if(props.cfg && props.cfg.msg_view == "card") {
        return "card border-success mb-3 mw-100 text-success-emphasis";
    }
    else {
        return "py-2 mb-1 w-100 text-success-emphasis";
    }
}

function assistant_footer_class(is_bottom) {
    if((props.cfg && props.cfg.msg_view == "chatgpt")||props.zen_mode) {
        return "pb-3";
    }
    else if(props.cfg && props.cfg.msg_view == "card") {
        return "border-success";
    }
    else {
        return is_bottom?"pb-3":"border-bottom pb-3";
    }
}

function waiting_resp_class() {
    if((props.cfg && props.cfg.msg_view == "chatgpt")||props.zen_mode) {
        return "px-0 pt-2 pb-2 mb-0 w-100 chatgpt-msg-padding"+(props.zen_mode?"-zen":"");
    }
    else if(props.cfg && props.cfg.msg_view == "card") {
        return "p-2 float-start mb-3 alert alert-info";
    }
    else {
        return "p-2 float-start mb-3";
    }
}

function prepare_update_prompt(msg) {
    editing_msg_backup.value = msg.content;
    editing_user_msg.value = msg;
    if(props.cfg.input_mode == "singleline"||props.zen_mode) {
        nextTick(()=>{
            for(var i=0;i<editpromptinput.value.length;i++) {
                const epi = editpromptinput.value[i];
                epi.style.width = epi.scrollWidth + 10 + "px";
                epi.focus();
            }
        })
    }
    else {
        nextTick(()=>{
            for(var i=0;i<editprompttextarea.value.length;i++) {
                editprompttextarea.value[i].focus();
            }
        })
    }
}

function cancel_update_prompt() {
    editing_user_msg.value.content = editing_msg_backup.value;
    editing_user_msg.value = null;
    editing_msg_backup.value = "";
}

function scrollToBottom() {
    const pg = document.getElementById("iplayground");
    if(pg) {
        pg.scrollTop = pg.scrollHeight;
    }
}

function update_prompt(msg) {
    const msgidx = props.active_chat.messages.indexOf(msg);
    if(msg.role != "user") {
        return
    }
    // 从指定的message开始重新生成问题
    editing_user_msg.value = null;
    editing_msg_backup.value = "";
    props.active_chat.messages.splice(msgidx + 1, props.active_chat.messages.length - msgidx - 1);
    send_prompt(props.active_chat, true, props.cfg.auto_title, props.cfg.compact_mode, props.cfg.use_proxy, props.cfg.custom_api, props.cfg.api_key, scrollToBottom, null);
}

function select_predict_question(q) {
    props.active_chat.new_prompt = q;
    document.getElementById("imaininput").focus();
}
</script>
<template>
    <div class="h-100 pt-3 d-flex flex-column">
        <div class="mt-5 d-sm-block d-md-none"></div>
        <div v-if="active_chat" class="overflow-y-auto flex-grow-1" id="iplayground" :class="{'px-0': cfg.msg_view=='chatgpt'||zen_mode, 'px-2': cfg.msg_view!='chatgpt'&&!zen_mode, 'mb-3': view_only&&zen_mode}">
            <template v-if="active_chat.messages.length > 0">
                <template v-for="msg, msgidx in active_chat.messages">
                <div v-if="msg._visible===false"></div>
                <div v-else-if="!zen_mode||msg.role != 'system'" class="clearfix" :class="{'bg-body-tertiary': cfg.msg_view=='chatgpt'&&msgidx>0&&msgidx%2==0&&!zen_mode}">
                    <div v-if="msg.role != 'assistant'" class="d-inline-block mw-100" 
                    :class="non_assistant_msg_class(msg.role)">
                        <div class="d-flex flex-row">
                            <div v-if="msg.role=='user'" class="me-2 float-start py-2 align-self-start" :class="{'bi bi-person': zen_mode||!cfg.human_avatar, 'fs-7': cfg.msg_view=='card', 'fs-5': cfg.msg_view!='card'&&!zen_mode}">{{zen_mode?'':cfg.human_avatar}}</div>
                            <template v-else-if="msg.role=='system'">
                                <div v-if="show_params" role="button" aira-label="高级参数设置" title="高级参数设置" class="me-2 bi bi-sliders float-start fs-6 align-self-start" :class="show_system_msg?'py-0':'py-0'" @click="show_system_msg=!show_system_msg"></div>
                                <div v-else class="fw-bold border-bottom w-100 pb-1 mb-2">工作流预览</div>
                            </template>
                            <div v-else class="me-2 bi bi-cpu px-1 float-start py-2 align-self-start" :class="{'fs-7': cfg.msg_view=='card', 'fs-5': cfg.msg_view!='card'}"></div>
                            <template v-if="msg.role=='system'">
                            <SystemMsg v-if="show_params&&show_system_msg" :params_only="false" :msg="msg" :active_chat="active_chat" :view_only="view_only"/>
                            </template>
                            <div v-else-if="editing_user_msg===msg" class="flex-grow-1 overflow-x-auto">
                                <input v-if="cfg.input_mode=='singleline'||zen_mode" type="text" autocomplete="off" class="form-control mw-100" ref="editpromptinput" v-model="msg.content">
                                <textarea v-else class="form-control" autocomplete="off" v-model="msg.content" rows="5" cols="60" ref="editprompttextarea"></textarea>
                            </div>
                            <span v-else class="fs-7 py-2 float-start flex-grow-1 overflow-x-auto" :class="{'text-danger':msg._flagged === 1||msg._flagged===2}">
                                {{msg.content}}
                            </span>
                        </div>
                        <div v-if="msg._flagged===1||msg._flagged===2||msg._flagged===-1" class="badge text-bg-danger" :class="msg._flagged===2?'text-bg-danger':'text-bg-warning'">
                            <i class="bi bi-exclamation-triangle me-1"></i>{{msg._flagged===1?'网络不畅，未完成审核':(msg._flagged===2?'话题含有不适宜内容':'API key无效，未完成审核')}}
                            <i v-if="msg._flagged===1 || msg._flagged===-1" class="ms-1 bi bi-x" role="button" @click="msg._flagged=0"></i>
                        </div>
                        <div class="clearfix" :class="non_assistant_footer_class(msg.role, msgidx==active_chat.messages.length-1)">
                            <span class="float-start" v-if="msg._ts">{{msg._ts}}</span>
                            <template v-if="!view_only">
                                <template v-if="(msg.role=='user' && editing_user_msg!=msg)||msg.role=='_local'">
                                <span v-if="removing_msg===msg" class="float-end ms-2 text-danger-emphasis">
                                    <i class="bi bi-trash me-1"></i><!-- 确定删除？ -->
                                    <i class="bi bi-check-circle me-2" style="cursor: pointer" @click="active_chat.messages.splice(msgidx, 1)"></i>
                                    <i class="bi bi-x-circle me-1" @click="removing_msg=null" style="cursor: pointer"></i>
                                </span>
                                <i v-else class="bi bi-trash ms-2 float-end" style="cursor: pointer" @click="removing_msg=msg"></i>
                                <i v-if="msg.role=='user'" class="bi bi-pencil-square float-end ms-2" style="cursor: pointer" @click="prepare_update_prompt(msg)"></i>
                                <i v-if="msg.role=='user'&&msgidx>=active_chat.messages.length-2" 
                                    class="bi bi-arrow-repeat float-end ms-5" 
                                    role="button" 
                                    @click="try_again(active_chat, msgidx, cfg.auto_title, cfg.compact_mode, cfg.use_proxy, cfg.custom_api, cfg.api_key, scrollToBottom)"></i>    
                                </template>
                                <span v-if="msg.role=='user' && editing_user_msg===msg" class="float-end ms-5">
                                    <i class="bi bi-send-fill text-success" style="cursor: pointer" @click="update_prompt(msg)"></i>
                                    <i class="bi bi-x-circle ms-2" style="cursor: pointer" @click="cancel_update_prompt"></i>
                                </span>
                            </template>
                            <span v-if="msg.role=='system'&&show_system_msg&&show_params">
                                <i class="bi bi-x" role="button" aria-label="关闭高级参数面板" title="关闭高级参数面板" style="cursor: pointer" @click="show_system_msg=false"></i>
                            </span>
                        </div>
                    </div>
                    <div v-else :class="assistant_msg_class(msgidx==active_chat.messages.length-1)" class="d-inline-block mw-100">
                        <!-- 卡片视图 -->
                        <template v-if="cfg.msg_view=='card'&&!zen_mode">
                        <div class="card-header py-1 border-success clearfix fs-7">
                            <span class="float-start" :class="{'bi bi-robot': zen_mode||!cfg.robot_avatar}">{{zen_mode?'':cfg.robot_avatar}}</span>
                        </div>
                        <div class="card-body" style="overflow-x: auto;">
                            <span v-if="msg._render_mode=='text' || msg._flagged===1 || msg._flagged===2" class="fs-7" :class="{'text-danger':msg._flagged===1 || msg._flagged===2}">{{msg.content}}</span>
                            <div v-else style="overflow-x: auto;" class="fs-7" v-html="purify(msg)" @click="copy_code($event)"></div>
                            <div v-if="!view_only&&active_chat.stream_controller&&active_chat.arguments.stream==true&&msgidx==active_chat.messages.length-1">
                                <i v-if="active_chat.waiting_for_resp" role="button" class="cursor-pointer text-danger bi bi-stop-fill me-1" @click="stop_streaming(active_chat)"></i>
                                <i v-else class="text-success bi bi-check2-all"></i>
                            </div>
                        </div>
                        </template>
                        <!-- 简洁和chatgpt视图 -->
                        <template v-else>
                            <div style="display: flex; flex-direction: row;">
                                <div class="me-2 py-2 float-start" :class="{'bi bi-robot': zen_mode||!cfg.robot_avatar, 'fs-5': !zen_mode}" style="align-self: flex-start;">{{zen_mode?'':cfg.robot_avatar}}</div>
                                <div class="float-start" style="overflow-x: auto; flex: 1">
                                    <div v-if="msg._render_mode=='text' || msg._flagged===1 || msg._flagged===2" class="fs-7 py-2" :class="{'text-danger':msg._flagged===1 || msg._flagged===2}">{{msg.content}}</div>
                                    <div v-else style="overflow-x: auto;" class="fs-7 py-2" v-html="purify(msg)" @click="copy_code($event)"></div>
                                    <div v-if="!view_only&&active_chat.stream_controller&&active_chat.arguments.stream==true&&msgidx==active_chat.messages.length-1">
                                        <i v-if="active_chat.waiting_for_resp" role="button" class="cursor-pointer text-danger bi bi-stop-fill me-1" @click="stop_streaming(active_chat)"></i>
                                        <i v-else class="text-success bi bi-check2-all"></i>
                                    </div>
                                </div>
                            </div>
                        </template>
                        <div v-if="msg._flagged === 1 || msg._flagged === 2" class="badge text-bg-danger" :class="{'ms-2 mb-2': cfg.msg_view=='card'}">
                            <i class="bi bi-exclamation-triangle me-1"></i>{{msg._flagged===1?'未完成审核，回复可能含有不适宜内容':'回复含有不适宜内容'}}
                            <i v-if="msg._flagged===1" class="ms-1 bi bi-x" style="cursor: pointer" @click="msg._flagged=0"></i>
                        </div>
                        <div class="card-footer py-2 text-secondary clearfix fs-8" :class="assistant_footer_class(msgidx==active_chat.messages.length-1)">
                            <span class="float-start">{{msg._received_ts}}</span>
                            <template v-if="!view_only">
                                <span v-if="removing_msg===msg" class="float-end ms-2 text-danger-emphasis">
                                    <i class="bi bi-trash me-1"></i><!-- 确定删除？-->
                                    <i class="bi bi-check-circle me-2" style="cursor: pointer" @click="active_chat.messages.splice(msgidx, 1)"></i>
                                    <i class="bi bi-x-circle me-1" @click="removing_msg=null" style="cursor: pointer"></i>
                                </span>
                                <i v-else class="bi bi-trash ms-2 float-end" style="cursor: pointer" @click="removing_msg=msg"></i>
                            </template>
                            <i style="cursor: pointer" class="bi bi-clipboard float-end ms-2" @click="copy_msg($event, msg)"></i>
                            <i style="cursor: pointer" class="bi float-end ms-5" :class="msg._render_mode=='text'?'bi-blockquote-left':'bi-code-slash'" @click="msg._render_mode = msg._render_mode=='text'?'html':'text'"></i>
                        </div>
                    </div>
                </div>
                <div v-else></div>
                </template>
            </template>
            <div v-else class="container px-5">
                <div class="row row-cols-4 gx-5">
                    <div class="col mb-5" style="min-height: 90px" v-for="app in prompt_apps">
                        <div class="border p-3 rounded-3 shadow-sm w-100 h-100 d-flex align-items-center" style="cursor: pointer; background-color: var(--bs-tertiary-bg)">
                            <div class="text-center w-100">{{app.name}}</div>
                        </div>
                    </div>
                </div>
            </div>
            <!-- 等待回复... -->
            <div v-if="active_chat.waiting_for_resp && active_chat.messages[active_chat.messages.length-1].role=='user'" class="clearfix">
                <div style="display: inline-block" :class="waiting_resp_class()">
                    <div class="clearfix" style="overflow-x: auto;">
                        <span class="me-2"><i class="bi bi-send"></i></span>
                        <span class="spinner-grow spinner-grow-sm"></span>
                    </div>
                </div>
            </div>
        </div>
        <div v-else class="flex-grow-1"></div>
        <div class="w-100 align-self-end" :class="{'chatgpt-msg-padding-zen': zen_mode, 'pb-3': !zen_mode, 'border-top': !edit_api_key&&!zen_mode&&!(view_only&&allow_input), 'pt-2': view_only&&allow_input, 'px-2': cfg.msg_view=='chatgpt'||zen_mode}">
            <template v-if="!view_only&&!edit_api_key&&!zen_mode">
                <div id="ipredicts" class="fs-8" v-if="active_chat && active_chat.show_predict_questions">
                    <button class="btn btn-sm btn-link mt-2" :disabled="active_chat.waiting_for_predict" @click="predict_question(active_chat, true, cfg.compact_mode, cfg.use_proxy, cfg.custom_api, cfg.api_key)">
                        <i :class="active_chat.waiting_for_predict?'spinner-grow spinner-grow-sm':'bi bi-arrow-repeat'"></i>
                    </button>
                    <button class="btn btn-sm btn-link border rounded-pill mt-2 me-1" style="color: var(--bs-secondary-text); background-color: var(--bs-secondary-bg-subtle); border-color: var(--bs-secondary-border-subtle)" v-for="pq in active_chat.predict_questions" @click="select_predict_question(pq)">{{pq}}</button>
                </div>
                <ChatToolBar v-if="active_chat" :chats="chats" :active_chat="active_chat" :cfg="cfg" @all_chats_removed="emit('all_chats_removed')" @last_chat_removed="emit('last_chat_removed')" @chat_removed="(chatidx)=>emit('chat_removed', chatidx)"/>
            </template>
            <ChatInput v-if="!view_only||allow_input" :agent_meta="agent_meta" :cfg="cfg" :active_chat="active_chat" :zen_mode="zen_mode" @new_msg_pushed="scrollToBottom"/>
            <template v-else>
                <div v-if="!zen_mode" class="mt-1 fs-8 text-muted fw-light clearfix w-100">
                    <template v-if="!edit_api_key && active_chat && active_chat.used_tokens"><i class="bi bi-info-circle me-1"></i>当前话题累计消耗token：{{active_chat.used_tokens}}</template>
                    <template v-else>
                        <i class="bi">&nbsp;</i>
                        <!-- <i class="bi bi-info-circle me-1"></i>关于API Key：<a href="https://platform.openai.com/account/api-keys" target="_blank" rel="noopener">https://platform.openai.com/account/api-keys<i class="ms-1 bi bi-box-arrow-up-right"></i></a> -->
                    </template>
                </div>
            </template>
        </div>
    </div>
</template>