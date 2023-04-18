<script setup>
import { ref } from "vue"
const props = defineProps({
    cfg: Object,
    active_chat: Object,
});
defineEmits(["export_all", "export_current"]);
const show_export_help = ref(false);
const show_key_help = ref(false);
const show_proxy_help = ref(false);
const show_api_key = ref(false);
const show_title_help = ref(false);
const show_compact_help = ref(false);
const show_input_help = ref(false);
const edit_api_key = ref(props.cfg.api_key?false:true);
function set_api_key() {
    if(props.cfg.api_key) {
        edit_api_key.value = false;
        show_api_key.value = false;
        // nextTick(()=>{
        //     this.$refs.maininput.focus();
        // });
    }
    else {
        unset_api_key();
    }
}
function unset_api_key() {
    props.cfg.api_key = "";
    edit_api_key.value = true;
    show_api_key.value = false;
}
</script>
<template>
    <div class="px-3 w-100 flex-grow-1 overflow-y-auto">
        <div class="h6 fw-bold mt-1 mb-2 pb-1 clearfix">备份<i class="float-end bi bi-question-circle" role="button" @click="show_export_help=!show_export_help"></i></div>
        <div v-if="show_export_help" class="alert alert-warning fs-8 mb-1">我们不在服务器保存任何对话历史，所有数据临时存放在你的浏览器中。请使用导出/导入功能妥善维护你的话题数据。</div>
        <div class="btn-group w-100">
            <button class="btn btn-sm btn-link" @click="$emit('export_all')">
                <i class="bi bi-download me-1"></i>所有话题
            </button>
            <button v-if="active_chat" class="btn btn-sm btn-link" @click="$emit('export_current')">
                <i class="bi bi-download me-1"></i>当前话题
            </button>
        </div>
        <div class="h6 fw-bold mt-5 mb-2 pb-1 clearfix">API Key<i class="float-end bi bi-question-circle" role="button" @click="show_key_help=!show_key_help"></i></div>
        <div v-if="show_key_help" class="alert alert-warning fs-8">我们不在服务器保存任何API Key，只在你的浏览器中用于访问AI接口。API Key是你访问AI接口的唯一凭证，请务必妥善保管。
            <span class="d-none">关于API Key的更多信息请访问<a href="https://platform.openai.com/account/api-keys" target="_blank" rel="noopener">官方文档<i class="ms-1 bi bi-box-arrow-up-right"></i></a></span>
        </div>
        <div>
            <div v-if="edit_api_key">
                <div class="input-group">
                    <div class="input-group-text p-0">
                        <button class="btn btn-sm text-secondary" @click="show_api_key = !show_api_key"><i class="bi" :class="show_api_key?'bi-eye-slash':'bi-eye'"></i></button>
                    </div>
                    <input class="p-1 form-control form-control-sm" :type="show_api_key?'text':'password'" v-model="cfg.api_key" v-focus @keyup.enter="set_api_key">
                    <button class="btn btn-success btn-sm" @click="set_api_key"><i class="bi bi-check-lg"></i></button>
                </div>
                <!-- <div class="fs-8 mt-2">没有API Key？<a href="/register">注册获取免费额度</a></div> -->
            </div>
            <div v-else class="clearfix text-secondary fs-8">
                <i class="bi bi-key me-1"></i>{{cfg.api_key.slice(0, 3)}} . . . {{cfg.api_key.slice(-4)}}
                <i class="bi bi-trash float-end ms-2" @click="unset_api_key" role="button"></i>
                <i class="bi bi-pencil-square float-end" @click="edit_api_key=true" role="button"></i>
            </div>
        </div>
        <div class="h6 fw-bold mt-5 mb-2 pb-1 clearfix">API Proxy<i v-if="cfg.use_proxy!='openai'" class="float-end bi bi-question-circle" role="button" @click="show_proxy_help=!show_proxy_help"></i></div>
        <div v-if="show_proxy_help || cfg.use_proxy=='openai'" class="alert alert-warning fs-8">注意：从官方支持的地区之外直连存在API Key被冻结的风险。</div>
        <select class="form-select form-select-sm" v-model="cfg.use_proxy">
            <option value="openai">直连OpenAI</option>
            <option value="proxy">本站代理</option>
        </select>
        <div class="h6 fw-bold mt-5 mb-2 pb-1 clearfix">自动命名<i v-if="cfg.auto_title=='manual'" class="float-end bi bi-question-circle" role="button" @click="show_title_help=!show_title_help"></i></div>
        <div v-if="show_title_help || cfg.auto_title != 'manual'" class="alert alert-warning fs-8">自动命名会成倍消耗点数，请酌情使用。你可以选择手动模式，在对话进行到合适的阶段点击输入框上方的“总结命名”。</div>
        <select class="form-select form-select-sm" v-model="cfg.auto_title">
            <option value="manual">手动</option>
            <option value="first3r">前三轮对话</option>
            <option value="allr">每轮对话</option>
        </select>
        <div class="h6 fw-bold mt-5 mb-2 pb-1 clearfix">个性化</div>
        <div class="row gx-0 mb-3">
            <label for="ihumanavatar" class="col-5 col-form-label col-form-label-sm">人类头像</label>
            <div class="col-7">
            <input type="text" class="form-control form-control-sm" id="ihumanavatar" v-model="cfg.human_avatar" maxlength="32">
            </div>
        </div>
        <div class="row gx-0 mb-3">
            <label for="irobotavatar" class="col-5 col-form-label col-form-label-sm">AI头像</label>
            <div class="col-7">
            <input type="text" class="form-control form-control-sm" id="irobotavatar" v-model="cfg.robot_avatar" maxlength="32">
            </div>
        </div>
        <div class="row gx-0 mb-3">
            <label class="col-5 col-form-label col-form-label-sm" for="imsgview">对话视图</label>
            <div class="col-7">
                <select class="form-select form-select-sm" v-model="cfg.msg_view">
                    <option value="classic">简洁</option>
                    <option value="chatgpt">ChatGPT</option>
                    <option value="card">卡片</option>
                </select>
            </div>
        </div>
        <div class="h6 fw-bold mt-5 mb-2 pb-1 clearfix">省流模式<i class="float-end bi bi-question-circle" role="button" @click="show_compact_help=!show_compact_help"></i></div>
        <div v-if="show_compact_help" class="alert alert-warning fs-8">省流模式可以成倍节省点数，但是AI无法感知话题的上下文联系。</div>
        <div class="form-check form-switch fs-8">
            <input class="form-check-input" type="checkbox" role="switch" id="flexSwitchCheckChecked" v-model="cfg.compact_mode">
            <label class="form-check-label" for="flexSwitchCheckChecked">{{cfg.compact_mode?'已打开':'已关闭'}}</label>
        </div>
        <div class="h6 fw-bold mt-5 mb-2 pb-1 clearfix">输入模式<i class="float-end bi bi-question-circle" role="button" @click="show_input_help=!show_input_help"></i></div>
        <div v-if="show_input_help" class="alert alert-warning fs-8">单行模式下回车键发送、上/下键查看提问历史；多行模式下Ctrl+回车键发送、Ctrl+上/下键查看问题历史。</div>
        <div class="form-check form-check-inline fs-8">
            <input class="form-check-input" type="radio" id="inlineRadio1" value="singleline" v-model="cfg.input_mode">
            <label class="form-check-label" for="inlineRadio1">单行</label>
        </div>
        <div class="form-check form-check-inline fs-8">
            <input class="form-check-input" type="radio" id="inlineRadio2" value="multipleline" v-model="cfg.input_mode">
            <label class="form-check-label" for="inlineRadio2">多行</label>
        </div>
    </div>
</template>