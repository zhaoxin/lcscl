<script setup>
import { ref } from "vue"
import { validate_argument } from "./lib.js"
defineProps({
    msg: Object,
    active_chat: Object,
    view_only: Boolean
});
const invalid_stop = ref(null);
const invalid_logitbias = ref(null);
const null_value = ref("null");
</script>
<template>
    <form class="row g-3 ps-2 pb-2">
        <div class="col-12 fw-bold">{{view_only?'当前对话使用参数：':'如果不理解参数含义，请使用默认值'}}</div>
        <div class="col-12">
            <label for="isysmsg" class="form-label fw-bold w-100 clearfix">system prompt
                <i v-if="!view_only" class="bi bi-repeat float-end me-1 mt-1 fs-8" role="button" @click="msg.content='You are a helpful assistant.'" aria-label="把系统提示重置回默认值" title="把系统提示重置回默认值"></i>
            </label>
            <input :readonly="view_only" type="text" class="form-control-sm" :class="view_only?'form-control-plaintext':'form-control'" id="isysmsg" v-model="msg.content">
        </div>
        <div class="col-md-3">
            <label for="itemp" class="form-label fw-bold w-100 clearfix">temperature
                <i v-if="!view_only" class="bi bi-repeat float-end me-1 mt-1 fs-8" role="button" @click="active_chat.arguments.temperature=1" aria-label="把temperature重置回默认值" title="把temperature重置回默认值"></i>
            </label>
            <input :readonly="view_only" type="number" class="form-control-sm" :class="{'form-control-plaintext': view_only, 'form-control': !view_only, 'is-invalid': active_chat.arguments.temperature<0||active_chat.arguments.temperature>2}" id="itemp" min="0" max="2" aria-labelledby="itemphelp" v-model="active_chat.arguments.temperature">
            <div id="itemphelp" class="form-text">
                <span v-if="active_chat.arguments.temperature<0||active_chat.arguments.temperature>2">最小值0，最大值2</span>
                <span v-else>取值越大回复内容的随机性越强</span>
            </div>
        </div>
        <div class="col-md-3">
            <label for="itopp" class="form-label fw-bold w-100 clearfix">top_p
                <i v-if="!view_only" class="bi bi-repeat float-end me-1 mt-1 fs-8" role="button" @click="active_chat.arguments.top_p=1" aria-label="把top_p重置回默认值" title="把top_p重置回默认值"></i>
            </label>
            <input :readonly="view_only" type="number" class="form-control-sm" :class="{'form-control-plaintext': view_only, 'form-control': !view_only, 'is-invalid': active_chat.arguments.top_p<0||active_chat.arguments.top_p>1}" id="itopp" min="0" max="1" aria-labelledby="itopphelp" v-model="active_chat.arguments.top_p">
            <div id="itopphelp" class="form-text">
                <span v-if="active_chat.arguments.top_p<0||active_chat.arguments.top_p>1">最小值0，最大值1</span>
                <span v-else>功能类似temperature，建议二者至少一个设为1</span>
            </div>
        </div>
        <div class="col-md-3">
            <label for="iprepenal" class="form-label fw-bold w-100 clearfix">presence_penalty
                <i v-if="!view_only" class="bi bi-repeat float-end me-1 mt-1 fs-8" role="button" @click="active_chat.arguments.presence_penalty=0" aria-label="把presence_penalty重置回默认值" title="把presence_penalty重置回默认值"></i>
            </label>
            <input :readonly="view_only" type="number" class="form-control-sm" :class="{'form-control-plaintext': view_only, 'form-control': !view_only, 'is-invalid': active_chat.arguments.presence_penalty<-2||active_chat.arguments.presence_penalty>2}" id="iprepenal" min="-2" max="2" aria-labelledby="iprepenalhelp" v-model="active_chat.arguments.presence_penalty">
            <div id="iprepenalhelp" class="form-text">
                <span v-if="active_chat.arguments.presence_penalty<-2||active_chat.arguments.presence_penalty>2">最小值-2，最大值2</span>
                <span v-else>取值越大思维发散性越强</span>
            </div>
        </div>
        <div class="col-md-3">
            <label for="ifrepenal" class="form-label fw-bold w-100 clearfix">frequency_penalty
                <i v-if="!view_only" class="bi bi-repeat float-end me-1 mt-1 fs-8" role="button" @click="active_chat.arguments.frequency_penalty=0" aria-label="把frequency_penalty重置回默认值" title="把frequency_penalty重置回默认值"></i>
            </label>
            <input :readonly="view_only" type="number" class="form-control-sm" :class="{'form-control-plaintext': view_only, 'form-control': !view_only, 'is-invalid': active_chat.arguments.frequency_penalty<-2||active_chat.arguments.frequency_penalty>2}" id="ifrepenal" min="-2" max="2" aria-labelledby="ifrepenalhelp" v-model="active_chat.arguments.frequency_penalty">
            <div id="ifrepenalhelp" class="form-text">
                <span v-if="active_chat.arguments.frequency_penalty<-2||active_chat.arguments.frequency_penalty>2">最小值-2，最大值2</span>
                <span v-else>取值越大回复中出现重复句子的可能性越低</span>
            </div>
        </div>
        <div class="col-md-6">
            <label for="istop" class="form-label fw-bold w-100 clearfix">stop
                <i v-if="!view_only" class="bi bi-repeat float-end me-1 mt-1 fs-8" role="button" @click="invalid_stop=null;active_chat.arguments.stop=null" aria-label="把stop重置回默认值" title="把stop重置回默认值"></i>
                <i v-if="!view_only&&active_chat.arguments.stop" class="bi bi-bug float-end me-2 mt-1 fs-8" role="button" @click="validate_argument(active_chat,'stop',()=>{invalid_stop=false}, ()=>{invalid_stop=true})" aria-label="检查stop参数格式" title="检查stop参数格式"></i>
            </label>
            <input v-if="!view_only||active_chat.arguments.stop" :readonly="view_only" type="text" class="form-control-sm" :class="{'form-control-plaintext': view_only, 'form-control': !view_only, 'is-invalid': invalid_stop===true, 'is-valid': invalid_stop===false}" id="istop" aria-labelledby="istophelp" v-model="active_chat.arguments.stop">
            <input v-else readonly type="text" class="form-control-plaintext form-control-sm" :class="{'is-invalid': invalid_stop===true, 'is-valid': invalid_stop===false}" id="istop" aria-labelledby="istophelp" value="null">
            <div id="istophelp" class="form-text">
                {{invalid_stop?'格式不正确，请设置有效的文本或文本列表，例如："#"或["#", "\\n"]':'回复中出现列表中的文本（最多4个）时将停止生成，例如：["#", "\\n"]'}}
            </div>
        </div>
        <div class="col-md-6">
            <label for="ilogit" class="form-label fw-bold w-100 clearfix">logit_bias
                <i v-if="!view_only" class="bi bi-repeat float-end me-1 mt-1 fs-8" role="button" @click="invalid_logitbias=null;active_chat.arguments.logit_bias=null" aria-label="把logit_bias重置回默认值" title="把logit_bias重置回默认值"></i>
                <i v-if="!view_only&&active_chat.arguments.logit_bias" class="bi bi-bug float-end me-2 mt-1 fs-8" role="button" @click="validate_argument(active_chat,'logit_bias', ()=>{invalid_logitbias=false}, ()=>{invalid_logitbias=true})" aria-label="检查logit_bias参数格式" title="检查logit_bias参数格式"></i>
            </label>
            <input v-if="!view_only||active_chat.arguments.logit_bias" :readonly="view_only" type="text" class="form-control-sm" :class="{'form-control-plaintext': view_only, 'form-control': !view_only, 'is-invalid': invalid_logitbias===true, 'is-valid': invalid_logitbias===false}" id="ilogit_bias" aria-labelledby="ilogithelp" v-model="active_chat.arguments.logit_bias">
            <input v-else readonly type="text" class="form-control-plaintext form-control-sm" :class="{'is-invalid': invalid_logitbias===true, 'is-valid': invalid_logitbias===false}" id="ilogit_bias" aria-labelledby="ilogithelp" value="null">
            <div id="ilogithelp" class="form-text">
                {{invalid_stop?'格式不正确，请设置有效的键值对，例如：{"6342":-10, "1582":-10}':'干预token在回复中出现的概率，例如：{"6342":-10, "1582":-10}'}}
            </div>
        </div>
        <div class="col-md-3">
            <label for="imax" class="form-label fw-bold w-100 clearfix">max_tokens
                <i v-if="!view_only" class="bi bi-repeat float-end me-1 mt-1 fs-8" role="button" @click="active_chat.arguments.max_tokens=0" aria-label="把max_tokens重置回默认值" title="把max_tokens重置回默认值"></i>
            </label>
            <input :readonly="view_only" type="number" class="form-control-sm" :class="view_only?'form-control-plaintext':'form-control'" id="imax" min="0" aria-labelledby="imaxhelp" v-model="active_chat.arguments.max_tokens">
            <div id="imaxhelp" class="form-text">
                回复的最大token数。小于1=不限制
            </div>
        </div>
        <div class="col-md-3">
            <label for="imodel" class="form-label fw-bold">model</label>
            <input readonly class="form-control-plaintext form-control-sm" id="imodel" aria-labelledby="imodelhelp" :value="active_chat.arguments.model">
            <div v-if="!view_only" id="imodelhelp" class="form-text">
                暂不支持切换模型
            </div>
        </div>
        <div class="col-md-3">
            <label for="in" class="form-label fw-bold">n</label>
            <input readonly class="form-control-plaintext form-control-sm" id="in" aria-labelledby="inhelp" :value="active_chat.arguments.n">
            <div id="inhelp" class="form-text">
                {{view_only?'备选的回复数量':'备选的回复数量。默认为1，暂不支持修改'}}
            </div>
        </div>
        <div class="col-md-3">
            <label class="form-label fw-bold">stream</label>
            <div>
                <div class="form-check form-switch form-check-inline">
                    <input class="form-check-input" :disabled="view_only" type="checkbox" role="switch" id="istream" v-model="active_chat.arguments.stream">
                    <label class="form-check-label" for="istream">{{active_chat.arguments.stream?'开':'关'}}</label>
                </div>
            </div>
            <div id="istreamhelp" class="form-text">
                {{view_only?'流模式回复（打字机效果）':'流模式回复（打字机效果）；该模式下不显示用量统计'}}
            </div>
        </div>
    </form>
</template>