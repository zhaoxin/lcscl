<script setup>
import { ref, reactive, onMounted, watch } from "vue"
import TopNav from "./components/TopNav.vue"
import PromptList from "./components/PromptList.vue"
import Config from "./components/Config.vue"
import PromptDesigner from "./components/PromptDesigner.vue"
import axios from "axios"

const current_path = ref(window.location.pathname);
const show_cfg_panel = ref(false);
const show_prompt_list = ref(true);
const importing = ref(false);
const space_available = ref(0);
const space_used = ref(0);
const prompt_apps = reactive([]);
const prompt_filter = ref("");
const active_prompt = ref(null);
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

function new_prompt_app() {
    prompt_apps.unshift({
        name: "Untitled"+(prompt_apps.length+1),
        icon: "❓",
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
        workflow: []
    });
    active_prompt.value = prompt_apps[0];
    show_prompt_list.value = false;
    // document.getElementById("imaininput").focus();
}

function switch_prompt(prompt) {
    show_prompt_list.value = false;
    active_prompt.value = prompt;
    if(active_prompt.value.confirming_remove_prompt === undefined) {
        active_prompt.value.confirming_remove_prompt = false;
    }
    if(active_prompt.value.test_chat === undefined) {
        active_prompt.value.test_chat = null;
    }
    if(active_prompt.value.max_preview_panel === undefined) {
        active_prompt.value.max_preview_panel = false;
    }
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
    var saved_prompts = null;
    try {
        saved_prompts = JSON.parse(localStorage.getItem("lcscl_prompts"));
    }
    catch(err) {
        console.error(err);
    }
    if(saved_prompts) {
        Object.assign(prompt_apps, saved_prompts);
    }
    else {
        prompt_apps.push({
            name: "Untitled",
            icon: "❓",
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
            workflow: []
        });
    }
    for(var i=0;i<prompt_apps.length;i++) {
        for(var j=0;j<prompt_apps[i].workflow.length;j++) {
            if(prompt_apps[i].workflow[j].trigger === undefined) {
                prompt_apps[i].workflow[j].trigger = {operator:"==", value: ""};
            }
        }
    }
    switch_theme(cfg.theme);
    active_prompt.value = prompt_apps[0];
    if(!cfg.api_key&&cfg.use_proxy!='custom') {
        show_cfg_panel.value = true;
    }
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

function import_prompts(e) {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
        const content = e.target.result;
        try {
            const payload = JSON.parse(content);
            for(var i=0; i<payload.length; i++) {
                if(payload[i].workflow === undefined) {
                    payload[i].workflow = [];
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
            active_prompt.value = null;
            prompt_apps.push.apply(prompt_apps, payload);
            active_prompt.value = prompt_apps[prompt_apps.length-1];
        }
        catch(err) {
            alert("文件格式不正确。请确认导入的是从此处导出的工作流数据。");
        }
    }
    reader.readAsText(file);
    importing.value = false;
}

function export_prompts(mode) {
    function destroyClickedElement(event) {
        // remove the link from the DOM
        document.body.removeChild(event.target);
    }
    var jsonfile = new Blob([JSON.stringify(mode==0?prompt_apps:[active_prompt.value])], {type: "application/json"})
    var downloadLink = document.createElement("a");
    downloadLink.download = mode==0?"lcscl_prompts_all.json":"lcscl_prompts_"+active_prompt.value.name+".json";
    downloadLink.innerHTML = "Export Prompts";
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

watch(prompt_apps, (nv, ov)=>{
    try {
        localStorage.setItem("lcscl_prompts", JSON.stringify(nv));
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

onMounted(()=>{
    init();
});

</script>

<template>
    <div class="container-fluid vh-100 px-0 d-flex flex-column" v-cloak>
        <!-- 登录登出、全局设置与主题 -->
        <div style="position: absolute;top: 13px; right: 10px; z-index: 1000" class="w-100 clearfix">
            <div v-if="active_prompt&&(!show_prompt_list&&!show_cfg_panel)" style="max-width: 60%" class="float-start px-4 pt-1 fw-bold d-sm-block d-md-none text-truncate">{{active_prompt.name}}</div>
            <button v-if="cfg.theme=='light'" @click="switch_theme('dark')" class="float-end btn btn-sm" aria-label="切换到暗黑主题" title="切换到暗黑主题"><i class="bi bi-moon-stars"></i></button>
            <button v-if="cfg.theme=='dark'" @click="switch_theme('light')" class="float-end btn btn-sm" aria-label="切换到明亮主题" title="切换到明亮主题"><i class="bi bi-sun"></i></button>
            <button @click="show_cfg_panel=!show_cfg_panel" class="btn btn-sm float-end" aria-label="设置" title="设置"><i class="bi bi-gear"></i></button>
            <button v-if="!show_cfg_panel" @click="show_prompt_list=!show_prompt_list" class="float-end btn btn-sm d-sm-block d-md-none" aria-label="话题列表" title="话题列表"><i class="bi bi-chat"></i></button>
            <a class="float-end btn btn-sm" href="/"><i class="bi bi-house"></i></a>
        </div>
        <TopNav :zen_mode="false" :topic="active_prompt?active_prompt.name:''" :init_theme="cfg.theme"/>
        <div class="row mx-0 flex-grow-1 overflow-y-auto">
            <!-- 左侧话题列表 -->
            <div class="pb-5 h-100 col-md-2 border-end" :class="{'col-sm-12': show_prompt_list&&!show_cfg_panel, 'd-none d-md-block': !show_prompt_list||show_cfg_panel}">
                <div class="h-100 d-flex flex-column">
                    <div class="w-100 mb-2 align-self-start">
                        <div class="mt-5 d-sm-block d-md-none"></div>
                        <div class="mt-3">
                            <button class="btn w-100 btn-success" @click="new_prompt_app">
                                <i class="bi bi-magic me-2"></i>新工作流
                            </button>
                        </div>
                        <div class="clearfix">
                            <button class="float-start btn btn-sm btn-link my-1 disabled"><i class="bi bi-server me-1"></i>{{space_used}} / {{space_available}} MB</button>
                            <button class="float-end btn btn-sm btn-link my-1" @click="export_prompts(0)" aria-label="导出" title="导出"><i class="bi bi-download me-1"></i></button>
                            <button class="float-end btn btn-sm btn-link my-1" @click="importing = !importing" aria-label="导入" title="导入"><i class="bi bi-upload me-1"></i>{{importing?'取消':''}}</button>
                        </div>
                        <div v-if="importing">
                            <div class="alert alert-warning fs-8 py-1 mb-2">不要导入不信任来源的JSON文件</div>
                            <input class="form-control form-control-sm mb-2" type="file" @change="import_prompts">
                        </div>
                        <div style="position: relative; top: 3px; margin-bottom: -30px; right: 5px;" role="button" class="float-end text-secondary"><i class="bi bi-search"></i></div>
                        <input type="text" class="border-0 border-bottom rounded-0 form-control form-control-sm" v-model="prompt_filter" style="padding-right: 30px">
                    </div>
                    <PromptList :prompts="prompt_apps" :prompt_filter="prompt_filter" :active_prompt="active_prompt" @prompt_switched="switch_prompt"/>
                    <a class="btn" style="position: absolute; bottom: 7px; left: 2px" href="mailto:findheart@gmail.com"><i class="bi bi-headset"></i></a>
                    <a class="btn" style="position: absolute; bottom: 7px; left: 42px" href="https://github.com/zhaoxin/lcscl" target="_blank" rel="noopener"><i class="bi bi-github"></i></a>
                </div>
            </div>
            <!-- 工作区 -->
            <PromptDesigner v-if="active_prompt" :show_cfg_panel="show_cfg_panel" :cfg="cfg" :prompts="prompt_apps" :active_prompt="active_prompt" @all_prompts_removed="new_prompt_app" @prompt_removed="(promptidx)=>active_prompt=prompt_apps[promptidx]" @last_prompt_removed="active_prompt=prompt_apps[prompt_apps.length-1]"/>
            <!-- 系统设置 -->
            <div v-if="show_cfg_panel" class="col-md-2 gx-0 pb-3 h-100 border-start" :class="{'col-sm-12': !show_prompt_list}">
                <div class="h-100 d-flex flex-column">
                    <div class="w-100 px-3 align-self-start">
                        <div class="mt-5 d-sm-block d-md-none"></div>
                        <div class="pt-1"><i class="bi bi-x" role="button" @click="show_cfg_panel=false"></i></div>
                    </div>
                    <Config :cfg="cfg" :active_obj="active_prompt" @export_all="export_prompts(0)" @export_current="export_prompts(1)"/>
                </div>
            </div>
        </div>
    </div>
</template>
