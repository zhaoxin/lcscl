<script setup>
import { ref, computed } from "vue"
import axios from "axios"
import { get_title, predict_question } from "./lib.js"
const props = defineProps({
    chats: Object,
    active_chat: Object,
    cfg: Object,
});
const emit = defineEmits(["all_chats_removed", "last_chat_removed", "chat_removed"]);
const confirming_clear_chat = ref(false);
const confirming_remove_chat = ref(false);
const confirming_stop_share = ref(false);
const show_share_panel = ref(false);

const edit_api_key = computed(()=>{
    return !props.cfg.api_key&&props.cfg.use_proxy!="custom"
});

function toggle_share(chat) {
    show_share_panel.value = !show_share_panel.value;
    confirming_clear_chat.value = false;
    confirming_remove_chat.value = false;
    confirming_stop_share.value = false;
    if(chat.share_status === 5) {
        chat.share_status = 0;
    }
    if(show_share_panel.value && !chat.share_link) {
        share_chat(chat, true);
    }
}

function share_chat(chat, share_or_not) {
    if(chat.share_status == 1 || chat.share_status == 4) {
        return
    }
    chat.share_status = share_or_not?1:4; // 上传/删除中
    axios.post("https://share.lcscl.net", {share: share_or_not, share_code: chat.share_link, cfg: {theme: props.cfg.theme, human_avatar: props.cfg.human_avatar, robot_avatar: props.cfg.robot_avatar, msg_view: props.cfg.msg_view}, payload: share_or_not?chat:null})
    .then(function(resp) {
        chat.share_link = share_or_not?resp.data.share_code:null;
        chat.share_status = share_or_not?2:5; // 成功
    })
    .catch(function(err) {
        chat.share_status = share_or_not?3:6; // 失败
        console.error(err);
    })
    .then(function() {
    });
}

function clear_chat(chat) {
    confirming_clear_chat.value = false;
    chat.messages.splice(1, chat.messages.length-1);
}

function remove_chat(chat) {
    confirming_remove_chat.value = false;
    const idx = props.chats.indexOf(chat);
    props.chats.splice(idx, 1);
    if(props.chats.length < 1) {
        emit("all_chats_removed"); // 通知上级组件；上级进行new_chat时内部会给active_chat赋值
    }
    else if(idx >= props.chats.length) {
        emit("last_chat_removed");
    }
    else {
        emit("chat_removed", idx);
    }
}

function select_share_link() {
    document.getElementById("ilink").select();
}

function copy_share_link(link_code) {
    document.getElementById("ibtncopysharelink").className = "btn btn-sm btn-link px-1";
    document.getElementById("ibtncopysharelink").innerHTML = "<i class=\"spinner-grow spinner-grow-sm\"></i>";
    navigator.clipboard.writeText("https://lcscl.io/view?share_code="+link_code).then(
        () => {
            document.getElementById("ibtncopysharelink").className = "btn btn-sm btn-link px-1 "+(props.cfg.theme=="dark"?"text-success":"text-success");
            document.getElementById("ibtncopysharelink").innerHTML = "<i class=\"bi bi-clipboard-check-fill\"></i>";
        },
        () => {
            document.getElementById("ibtncopysharelink").className = "btn btn-sm btn-link px-1 "+(props.cfg.theme=="dark"?"text-danger":"text-danger");
            document.getElementById("ibtncopysharelink").innerHTML = "<i class=\"bi bi-clipboard-x-fill\"></i>";
        }
    );
}
</script>
<template>
    <div id="isharepanel" v-if="active_chat && show_share_panel" class="py-2 border-bottom">
        <div v-if="active_chat.share_status===1||active_chat.share_status===4" class="fs-8">
            <span class="spinner-grow spinner-grow-sm me-2"></span>{{'正在'+(active_chat.share_status===1?'生成':'删除')+'链接...'}}
        </div>
        <div v-else-if="active_chat.share_status===3||active_chat.share_status===6" class="fs-8 text-danger">
            {{active_chat.share_status===3?'上传数据/生成链接':'删除数据/链接'}}失败
            <button class="btn btn-sm btn-link px-0 ms-2 me-2" @click="share_chat(active_chat, active_chat.share_status===3?true:false)">重试</button>
            <button class="btn btn-sm btn-link px-0" @click="active_chat.share_status=0;show_share_panel=false">取消</button>
        </div>
        <div v-else-if="active_chat.share_status===5" class="fs-8">
            <i class="bi bi-check-circle text-success me-1"></i>数据与分享链接已删除
        </div>
        <div v-else-if="active_chat.share_link" class="row gx-2 mx-0" style="max-width: 100%">
            <label class="form-label col-auto form-control-sm mb-0 px-0" for="ilink" @click="select_share_link" role="button"><i class="bi bi-link-45deg"></i></label>
            <div class="col-auto">
                <input id="ilink" type="text" class="form-control form-control-sm" readonly :value="'https://lcscl.io/view?share_code='+active_chat.share_link">
            </div>
            <div class="col-auto">
                <a title="复制链接" aria-label="复制链接" role="button" class="btn btn-sm btn-link px-1" @click="copy_share_link(active_chat.share_link)" id="ibtncopysharelink"><i class="bi bi-clipboard"></i></a>
                <a title="查看链接" aria-label="查看链接" role="button" class="btn btn-sm btn-link px-1" :href="'https://lcscl.io/view?share_code='+active_chat.share_link" target="_blank" rel="noopener"><i class="bi bi-box-arrow-up-right"></i></a>
                <a title="删除链接" aria-label="删除链接" role="button" class="btn btn-sm btn-link px-1" v-if="!confirming_stop_share" @click="confirming_stop_share=true"><i class="bi bi-trash"></i></a>
                <span v-else>
                    <button class="btn btn-sm btn-link px-1 text-danger-emphasis">
                        <i class="bi bi-trash me-1"></i>
                    </button>
                    <button class="btn btn-sm btn-link px-0 text-danger-emphasis" @click="share_chat(active_chat, false)">
                        <i class="bi bi-check-circle me-2"></i>
                    </button>
                    <button class="btn btn-sm btn-link px-0 text-danger-emphasis" @click="confirming_stop_share=false">
                        <i class="bi bi-x-circle me-1"></i>
                    </button>
                </span>
            </div>
        </div>
        <div v-else class="fs-8">
            上传对话数据并生成分享链接？
            <button class="btn btn-sm btn-link px-0" @click="share_chat(active_chat, true)"><i class="bi bi-check-circle me-2"></i></button>
            <button class="btn btn-sm btn-link px-0" @click="show_share_panel=false"><i class="bi bi-x-circle"></i></button>
        </div>
    </div>
    <div id="itoolbar" class="py-1 clearfix">
        <button v-if="cfg.auto_title=='manual'" aria-label="调用模型为当前话题总结命名" title="调用模型为当前话题总结命名" :disabled="active_chat.waiting_for_title || active_chat.messages.length < 3" class="px-1 btn btn-sm btn-link" @click="get_title(active_chat, cfg.compact_mode, cfg.use_proxy, cfg.custom_api, cfg.api_key)">
            <i class="me-1" :class="active_chat.waiting_for_title?'spinner-grow spinner-grow-sm':'bi bi-card-heading'"></i>命名
        </button>
        <button :disabled="active_chat.waiting_for_predict || active_chat.messages.length < 3" aria-label="调用模型联想更多关联话题" title="调用模型联想更多关联话题" class="px-1 btn btn-sm btn-link" @click="predict_question(active_chat, false, cfg.compact_mode, cfg.use_proxy, cfg.custom_api, cfg.api_key)">
            <i class="me-1" :class="active_chat.waiting_for_predict?'spinner-grow spinner-grow-sm':'bi bi-lightbulb'"></i>联想
        </button>
        <button :disabled="active_chat.waiting_for_resp || active_chat.messages.length < 2" class="px-1 btn btn-sm btn-link" @click="toggle_share(active_chat)">
            <i class="bi bi-share me-1"></i>分享
        </button>
        <button v-if="!confirming_clear_chat" :disabled="active_chat.waiting_for_resp || active_chat.messages.length < 2" class="px-1 btn btn-sm btn-link" @click="confirming_clear_chat=true;confirming_remove_chat=false;show_share_panel=false">
            <i class="bi bi-eraser me-1"></i>清空
        </button>
        <span v-else>
            <button class="px-1 btn btn-sm btn-link text-danger-emphasis">
                <i class="bi bi-eraser me-1"></i><!-- 确定清空？-->
            </button>
            <button class="btn btn-sm btn-link px-0 text-danger-emphasis" @click="clear_chat(active_chat)">
                <i class="bi bi-check-circle me-2"></i>
            </button>
            <button class="btn btn-sm btn-link px-0 text-danger-emphasis" @click="confirming_clear_chat=false">
                <i class="bi bi-x-circle me-1"></i>
            </button>
        </span>
        <button v-if="!confirming_remove_chat" :disabled="chats.length < 1" class="px-1 btn btn-sm btn-link" @click="confirming_remove_chat=true;confirming_clear_chat=false;show_share_panel=false">
            <i class="bi bi-trash me-1"></i>删除
        </button>
        <span v-else>
            <button class="btn btn-sm btn-link px-1  text-danger-emphasis">
                <i class="bi bi-trash me-1"></i><!-- 确定删除？ -->
            </button>
            <button class="btn btn-sm btn-link px-0 text-danger-emphasis" @click="remove_chat(active_chat)">
                <i class="bi bi-check-circle me-2"></i>
            </button>
            <button class="btn btn-sm btn-link px-0 text-danger-emphasis" @click="confirming_remove_chat=false">
                <i class="bi bi-x-circle me-1"></i>
            </button>
        </span>
        <button class="btn btn-sm float-end" :disabled="edit_api_key" @click="cfg.input_mode=cfg.input_mode=='singleline'?'multipleline':'singleline'" :aria-label="'切换到'+(cfg.input_mode=='singleline'?'多行':'单行')+'输入'" :title="'切换到'+(cfg.input_mode=='singleline'?'多行':'单行')+'输入'">
            <i class="bi" :class="cfg.input_mode=='singleline'?'bi-chevron-expand':'bi-chevron-contract'"></i>
        </button>
    </div>
</template>