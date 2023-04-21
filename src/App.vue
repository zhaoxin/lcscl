<script setup>
import { ref, reactive, onMounted, watch } from "vue"
import TopNav from "./components/TopNav.vue"
import ChatList from "./components/ChatList.vue"
import Config from "./components/Config.vue"
import ChatUI from "./components/ChatUI.vue"
import axios from "axios"

const current_path = ref(window.location.pathname);
const view_only = ref(window.location.pathname=="/view");
const zen_mode = ref(false);
const show_cfg_panel = ref(false);
const show_chat_list = ref(true);
const importing = ref(false);
const space_available = ref(0);
const space_used = ref(0);
const chats = reactive([]);
const chat_filter = ref("");
const active_chat = ref(null);
const cfg = reactive({
    theme: "light",
    human_avatar: '❓',
    robot_avatar: '🤖',
    api_key: "",
    use_proxy: "proxy",
    custom_api: "",
    auto_title: "manual",
    compact_mode: false,
    input_mode: "singleline",
    msg_view: "classic",
});

function new_chat() {
    chats.unshift({
        topic: "Untitled"+(chats.length+1),
        messages: [
            {"role": "system", "content": "You are a helpful assistant."}
        ],
        arguments: {
            model: "gpt-3.5-turbo",
            temperature: 1,
            top_p: 1,
            n: 1,
            stream: false,
            stop: null,
            max_tokens: 0, // inf
            presence_penalty: 0,
            frequency_penalty: 0,
            logit_bias: null,
            user: null
        },
        predict_questions: [],
        waiting_for_resp: false,
        waiting_for_title: false,
        waiting_for_predict: false,
        show_predict_questions: false,
        used_tokens: 0
    });
    active_chat.value = chats[0];
    show_chat_list.value = false;
    document.getElementById("imaininput").focus();
}

function switch_chat(chat) {
    show_chat_list.value = false;
    active_chat.value = chat;
    document.getElementById("imaininput").focus();
}

function init() {
    var saved_cfg = null;
    try {
        saved_cfg = JSON.parse(localStorage.getItem("lcscl_cfg"));
    }
    catch(err) {
        console.error(err);
    }
    if(saved_cfg) {
        Object.assign(cfg, saved_cfg);
        if(!cfg.custom_api) {
            cfg.custom_api = "";
        }
    }
    else {
        show_cfg_panel.value = true;
    }
    var saved_chats = null;
    try {
        saved_chats = JSON.parse(localStorage.getItem("lcscl_chats"));
    }
    catch(err) {
        console.error(err);
    }
    if(saved_chats) {
        Object.assign(chats, saved_chats);
    }
    else {
        chats.push({
            topic: "Untitled",
            new_prompt: "",
            messages: [
                {"role": "system", "content": "You are a helpful assistant."}
            ],
            arguments: {
                model: "gpt-3.5-turbo",
                temperature: 1,
                top_p: 1,
                n: 1,
                stream: false,
                stop: null,
                max_tokens: 0, // inf
                presence_penalty: 0,
                frequency_penalty: 0,
                logit_bias: null,
                user: null
            },
            predict_questions: [],
            waiting_for_resp: false,
            waiting_for_title: false,
            waiting_for_predict: false,
            show_predict_questions: false,
            used_tokens: 0
        });
    }
    for(var i=0; i<chats.length; i++) {
        chats[i].waiting_for_resp = false;
        chats[i].waiting_for_title = false;
        chats[i].waiting_for_predict = false;
        chats[i].stream_controller = null;
        chats[i].share_status = 0;
        if(!chats[i].arguments) {
            chats[i].arguments = {
                model: "gpt-3.5-turbo",
                temperature: 1,
                top_p: 1,
                n: 1,
                stream: false,
                stop: null,
                max_tokens: 0, // inf
                presence_penalty: 0,
                frequency_penalty: 0,
                logit_bias: null,
                user: null
            };
        }
    }
    switch_theme(cfg.theme);
    active_chat.value = chats[0];
    if(!cfg.api_key&&cfg.use_proxy!='custom') {
        show_cfg_panel.value = true;
    }
}

function init_viewer() {
    show_cfg_panel.value = false;
    // 从服务器获取share_code对应的对话数据
    const q = new URLSearchParams(window.location.search);
    const share_code = q.get("share_code");
    if(!share_code) {
        return
    }
    axios.get("https://share.lcscl.net?share_code="+share_code)
    .then(function(resp) {
        const shared_obj = resp.data;
        if(shared_obj.cfg) {
            if(shared_obj.cfg.theme) {
                cfg.theme = shared_obj.cfg.theme;
            }
            if(shared_obj.cfg.human_avatar) {
                cfg.human_avatar = shared_obj.cfg.human_avatar;
            }
            if(shared_obj.cfg.robot_avatar) {
                cfg.robot_avatar = shared_obj.cfg.robot_avatar;
            }
            if(shared_obj.cfg.msg_view) {
                cfg.msg_view = shared_obj.cfg.msg_view;
            }
            switch_theme(cfg.theme);
        }
        chats.push(shared_obj.chat);
        for(var i=0; i<chats.length; i++) {
            chats[i].waiting_for_resp = false;
            chats[i].waiting_for_title = false;
            chats[i].waiting_for_predict = false;
            if(!chats[i].arguments) {
                chats[i].arguments = {
                    model: "gpt-3.5-turbo",
                    temperature: 1,
                    top_p: 1,
                    n: 1,
                    stream: false,
                    stop: null,
                    max_tokens: 0, // inf
                    presence_penalty: 0,
                    frequency_penalty: 0,
                    logit_bias: null,
                    user: null
                };
            }
        }
        active_chat.value = chats[0];
    })
    .catch(function(err) {
        if(err.response) {
            alert(err.response.data);
        }
        else {
            alert(err.message);
        }
    })
    .then(function() {});
    switch_theme(cfg.theme);
}

function switch_theme(tv) {
    if(tv=="dark") {
        document.getElementById("ihljscssdefault").rel = "stylesheet alternate";
        document.getElementById("ihljscssdark").rel = "stylesheet";
    }
    else {
        document.getElementById("ihljscssdefault").rel = "stylesheet";
        document.getElementById("ihljscssdark").rel = "stylesheet alternate";
    }
    cfg.theme = tv;
    document.documentElement.setAttribute("data-bs-theme", tv);
}

function import_chats(e) {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
        const content = e.target.result;
        try {
            const payload = JSON.parse(content);
            for(var i=0; i<payload.length; i++) {
                if(payload[i].predict_questions === undefined) {
                    payload[i].predict_questions = [];
                }
                if(payload[i].show_predict_questions === undefined) {
                    payload[i].show_predict_questions = false;
                }
                if(payload[i].arguments === undefined) {
                    payload[i].arguments = {
                        model: "gpt-3.5-turbo",
                        temperature: 1,
                        top_p: 1,
                        n: 1,
                        stream: false,
                        stop: null,
                        max_tokens: 0, // inf
                        presence_penalty: 0,
                        frequency_penalty: 0,
                        logit_bias: null,
                        user: null
                    }
                }
            }
            active_chat.value = null;
            chats.push.apply(chats, payload);
            active_chat.value = chats[chats.length-1];
        }
        catch(err) {
            alert("文件格式不正确。请确认导入的是从此处导出的话题数据。");
        }
    }
    reader.readAsText(file);
    importing.value = false;
}

function export_chats(mode) {
    function destroyClickedElement(event) {
        // remove the link from the DOM
        document.body.removeChild(event.target);
    }
    var jsonfile = new Blob([JSON.stringify(mode==0?chats:[active_chat.value])], {type: "application/json"})
    var downloadLink = document.createElement("a");
    downloadLink.download = mode==0?"lcscl_chats_all.json":"lcscl_chats_"+active_chat.value.topic+".json";
    downloadLink.innerHTML = "Export Chats";
    if (window.webkitURL != null) {
        // Chrome allows the link to be clicked without actually adding it to the DOM.
        downloadLink.href = window.webkitURL.createObjectURL(jsonfile);
    } else {
        // Firefox requires the link to be added to the DOM before it can be clicked.
        downloadLink.href = window.URL.createObjectURL(jsonfile);
        downloadLink.onclick = destroyClickedElement;
        downloadLink.style.display = "none";
        document.body.appendChild(downloadLink);
    }
    downloadLink.click();
}

if(!view_only.value) {
    watch(chats, (nv, ov)=>{
        try {
            localStorage.setItem("lcscl_chats", JSON.stringify(nv));
        }
        catch(err) {
            if(err=="QUOTA_EXCEEDED_ERR") {
                console.error("浏览器存储空间已满。");
            }
        }
        space_used.value = (decodeURIComponent(encodeURIComponent(JSON.stringify(localStorage))).length / 1024 / 1024).toFixed(2);
    });

    watch(cfg, (nv, ov)=>{
        try {
            localStorage.setItem("lcscl_cfg", JSON.stringify(nv));
        }
        catch(err) {
            if(err=="QUOTA_EXCEEDED_ERR") {
                console.error("浏览器存储空间已满。");
            }
        }
        space_used.value = (decodeURIComponent(encodeURIComponent(JSON.stringify(localStorage))).length / 1024 / 1024).toFixed(2);  
    });
}

onMounted(()=>{
    if(view_only.value) {
        console.log("init viewer")
        init_viewer();
    }
    else {
        console.log("init")
        init();
    }
});

</script>

<template>
    <div class="container-fluid vh-100 px-0 d-flex flex-column" v-cloak>
        <!-- 登录登出、全局设置与主题 -->
        <div style="position: absolute;top: 13px; right: 10px; z-index: 1000" class="w-100 clearfix">
            <div v-if="active_chat&&((!show_chat_list&&!show_cfg_panel)||zen_mode)" style="max-width: 60%" class="float-start px-4 pt-1 fw-bold d-sm-block d-md-none text-truncate">{{active_chat.topic}}</div>
            <button @click="zen_mode=!zen_mode" class="float-end btn btn-sm" aria-label="全屏模式" title="全屏模式"><i class="bi" :class="zen_mode?'bi-arrows-angle-contract':'bi-arrows-angle-expand'"></i></button>
            <template v-if="!zen_mode">
                <button v-if="cfg.theme=='light'" @click="switch_theme('dark')" class="float-end btn btn-sm" aria-label="切换到暗黑主题" title="切换到暗黑主题"><i class="bi bi-moon-stars"></i></button>
                <button v-if="cfg.theme=='dark'" @click="switch_theme('light')" class="float-end btn btn-sm" aria-label="切换到明亮主题" title="切换到明亮主题"><i class="bi bi-sun"></i></button>
                <a v-if="view_only" class="float-end btn btn-sm" href="/"><i class="bi bi-house"></i></a>
                <template v-else>
                    <button @click="show_cfg_panel=!show_cfg_panel" class="btn btn-sm float-end" aria-label="设置" title="设置"><i class="bi bi-gear"></i></button>
                    <button v-if="!show_cfg_panel" @click="show_chat_list=!show_chat_list" class="float-end btn btn-sm d-sm-block d-md-none" aria-label="话题列表" title="话题列表"><i class="bi bi-chat"></i></button>
                </template>
            </template>
        </div>
        <TopNav :zen_mode="zen_mode" :topic="active_chat?active_chat.topic:''" :init_theme="cfg.theme"/>
        <div class="row mx-0 flex-grow-1 overflow-y-auto">
            <!-- 左侧话题列表 -->
            <div class="pb-5 h-100 col-md-2" :class="{'border-end': !zen_mode && !view_only, 'col-sm-12': show_chat_list&&!show_cfg_panel&&!zen_mode, 'd-none d-md-block': !show_chat_list||show_cfg_panel||zen_mode}">
                <div v-if="!zen_mode && !view_only" class="h-100 d-flex flex-column">
                    <div class="w-100 mb-2 align-self-start">
                        <div class="mt-5 d-sm-block d-md-none"></div>
                        <div class="mt-3">
                            <button class="btn w-100 btn-primary" @click="new_chat">
                                <i class="bi bi-chat me-2"></i>新话题
                            </button>
                        </div>
                        <div class="clearfix">
                            <button class="float-start btn btn-sm btn-link my-1 disabled"><i class="bi bi-server me-1"></i>{{space_used}} / {{space_available}} MB</button>
                            <button class="float-end btn btn-sm btn-link my-1" @click="export_chats(0)" aria-label="导出" title="导出"><i class="bi bi-download me-1"></i></button>
                            <button class="float-end btn btn-sm btn-link my-1" @click="importing = !importing" aria-label="导入" title="导入"><i class="bi bi-upload me-1"></i>{{importing?'取消':''}}</button>
                        </div>
                        <div v-if="importing">
                            <div class="alert alert-warning fs-8 py-1 mb-2">不要导入不信任来源的JSON文件</div>
                            <input class="form-control form-control-sm mb-2" type="file" @change="import_chats">
                        </div>
                        <div style="position: relative; top: 3px; margin-bottom: -30px; right: 5px;" role="button" class="float-end text-secondary"><i class="bi bi-search"></i></div>
                        <input type="text" class="border-0 border-bottom rounded-0 form-control form-control-sm" v-model="chat_filter" style="padding-right: 30px">
                    </div>
                    <ChatList :chats="chats" :chat_filter="chat_filter" :active_chat="active_chat" @chat_switched="switch_chat"/>
                    <a class="btn" style="position: absolute; bottom: 7px; left: 2px" href="mailto:findheart@gmail.com"><i class="bi bi-headset"></i></a>
                    <a class="btn" style="position: absolute; bottom: 7px; left: 42px" href="https://github.com/zhaoxin/lcscl" target="_blank" rel="noopener"><i class="bi bi-github"></i></a>
                </div>
            </div>
            <!-- 工作区 -->
            <div class="col-sm-12 h-100" :class="{'px-0': cfg.msg_view=='chatgpt'||zen_mode, 'd-none d-md-block col-md-8': ((show_cfg_panel||show_chat_list)&&!zen_mode)&&!view_only, 'col-md-8': zen_mode||view_only, 'col-md-10': (!show_cfg_panel&&!zen_mode)&&!view_only}">
                <ChatUI v-if="active_chat" :view_only="view_only" :cfg="cfg" :chats="chats" :active_chat="active_chat" :zen_mode="zen_mode" @all_chats_removed="new_chat" @chat_removed="(chatidx)=>active_chat=chats[chatidx]" @last_chat_removed="active_chat=chats[chats.length-1]"/>
            </div>
            <!-- 系统设置 -->
            <div v-if="(show_cfg_panel||view_only)&&!zen_mode" class="col-md-2 gx-0 pb-3 h-100" :class="{'d-none': view_only, 'col-sm-12': !view_only&&!show_chat_list, 'border-start': !view_only&&!zen_mode}">
                <div v-if="!view_only&&!zen_mode" class="h-100 d-flex flex-column">
                    <div class="w-100 px-3 align-self-start">
                        <div class="mt-5 d-sm-block d-md-none"></div>
                        <div class="pt-1"><i class="bi bi-x" role="button" @click="show_cfg_panel=false"></i></div>
                    </div>
                    <Config :cfg="cfg" :active_chat="active_chat" @export_all="export_chats(0)" @export_current="export_chats(1)"/>
                </div>
            </div>
        </div>
    </div>
</template>
