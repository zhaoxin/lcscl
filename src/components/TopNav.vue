<script setup>
const props = defineProps({
    zen_mode: Boolean,
    topic: String
});
</script>

<template>
    <nav class="navbar navbar-expand w-100 px-3 d-none d-md-flex align-self-start" :class="{'border-bottom': !zen_mode}">
        <a v-if="!zen_mode" class="navbar-brand fw-bold" href="/" style="z-index: 2">唠出生产力&#x1F4AC;&#x1F916;&#x1F4BB;&#x1F680;</a>
        <!-- <a v-else class="navbar-brand fw-bold" href="/" style="z-index: 2"><i class="bi bi-chat"></i></a> -->
        <div v-if="topic" class="text-center navbar-brand w-100 fw-bold me-0" :class="{'position-absolute': !zen_mode}" style="left:0;right:0;z-index:-1;">
            {{topic}}
        </div>
    </nav>
</template>
