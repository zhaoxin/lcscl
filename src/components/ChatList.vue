<script setup>
import { computed } from "vue"
const props = defineProps({
    chats: Array,
    chat_filter: String,
    active_chat: Object,
});

const emit = defineEmits(["chat_switched"]);

const filtered_chats = computed(
    ()=>{
        return props.chats.filter(c=>{return c.topic.toLowerCase().indexOf(props.chat_filter.toLowerCase()) > -1})
    }
);
</script>

<template>
    <div class="overflow-y-auto flex-grow-1">
        <ul class="nav flex-column mt-2">
            <li class="nav-item" v-for="chat in filtered_chats">
                <a class="nav-link ps-1" :class="chat===active_chat?'active fw-bold fs-6':'fs-8'" role="button" @click="emit('chat_switched', chat)">
                    <i class="bi me-2" :class="chat===active_chat?'bi-chat-dots-fill':(chat.messages.length>1?'bi-chat-text':'bi-chat')"></i>{{chat.topic}}
                </a>
            </li>
        </ul>
    </div>
</template>