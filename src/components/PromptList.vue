<script setup>
import { computed } from "vue"
const props = defineProps({
    prompts: Array,
    prompt_filter: String,
    active_prompt: Object,
});

const emit = defineEmits(["prompt_switched"]);

const filtered_prompts = computed(
    ()=>{
        return props.prompts.filter(c=>{return c.name.toLowerCase().indexOf(props.prompt_filter.toLowerCase()) > -1})
    }
);
</script>

<template>
    <div class="overflow-y-auto flex-grow-1">
        <ul class="nav flex-column mt-2">
            <li class="nav-item" v-for="prompt in filtered_prompts">
                <a class="nav-link ps-1" :class="prompt===active_prompt?'active fw-bold fs-6':'fs-8'" role="button" @click="emit('prompt_switched', prompt)">
                    <span class="bi me-2">{{ prompt.icon?prompt.icon:"❓" }}</span>{{prompt.name}}
                </a>
            </li>
        </ul>
    </div>
</template>