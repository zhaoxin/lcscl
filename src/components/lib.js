import axios from "axios"
import { fetchEventSource, EventStreamContentType } from "@microsoft/fetch-event-source"
import { nextTick } from "vue"

function default_func_param(index) {
    return {
        name: "arg"+index,
        type: "string",
        description: "The first argument.",
    }
}

function default_function() {
    return {
        name: "new_function",
        description: "When you don't know the answer, call this function.",
        parameters: {
            type: "object",
            properties: [
                default_func_param(1)
            ],
            required: [],
        },
        code: 'async (args) => {\n    return "Hello, world!";\n}',
        need_confirm: true
    }
}

function default_arguments() {
    return {
        model: "gpt-3.5-turbo-0613",
        functions: [
            default_function(),
//             {
//                 name: "ask_google",
//                 description: "When you don't know the answer, call this function to ask Google.",
//                 parameters: {
//                     type: "object",
//                     properties: [
//                         {
//                             name: "query",
//                             type: "string",
//                             description: "The query to ask Google.",
//                         }
//                     ],
//                     required: [],
//                 },
//                 code: 
// `async (args) => {
//     const query = args.query;
//     //console.log(query);
//     const API_KEY = 'AIzaSyA3U-apAO0SGhu3DfmJnRZyAfh3p4ctqF0';
//     const SEARCH_ENGINE_ID = '137b17e952f7f4f85';
//     const endPoint = `+'`https://www.googleapis.com/customsearch/v1?key=${API_KEY}&cx=${SEARCH_ENGINE_ID}&q=${query}`'+`;
//     const response = await fetch(endPoint);
//     const data = await response.json();
//     var rslt = [];
//     for (var i = 0; i < data.items.length; i++) {
//         rslt.push(data.items[i].snippet)
//     }
//     //console.log(data);
//     return rslt.join("\\n");
// }`,
//                 need_confirm: true,
//             }
        ],
        function_call: "none",
        temperature: 1,
        top_p: 1,
        n: 1,
        stream: false,
        stop: null,
        max_tokens: 0, // inf
        presence_penalty: 0,
        frequency_penalty: 0,
        logit_bias: null,
        user: null,
    };
}

function normalize_msg(msgs, compact_mode) {
    const rslt = msgs.filter((m)=>{return m.role == "system" || m.role == "user" || m.role == "assistant" || m.role == "function"}).map(
        (m)=>{
            const r = {role: m.role, content: m.content};
            if(m.name) {
                r.name = m.name;
            }
            if(m.function_call) {
                r.function_call = m.function_call;
            }
            return r;
        }
    );
    if(compact_mode) {
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

function validate_argument(chat, arg, ok_callback, ng_callback) {
    if(arg=="stop") {
        try {
            var prefix = "";
            var postfix = "";
            if(chat.arguments.stop && chat.arguments.stop[0] != "[" && chat.arguments.stop[0] != '"' && chat.arguments.stop[chat.arguments.stop.length-1] != "]" && chat.arguments.stop[chat.arguments.stop.length-1] != '"') {
                prefix = '"';
                postfix = '"';
            }
            const s = JSON.parse(prefix + chat.arguments.stop + postfix);
            if(ok_callback) {
                ok_callback("stop");
            }
            return true;
        }
        catch(err) {
            if(ng_callback) {
                ng_callback("stop");
            }
            return false;
        }
    }
    if(arg=="logit_bias") {
        try {
            if(chat.arguments.logit_bias && (chat.arguments.logit_bias[0] != "{" || chat.arguments.logit_bias[chat.arguments.logit_bias.length-1] != '}')) {
                if(ng_callback) {
                    ng_callback("logit_bias");
                }
                return false;
            }
            const s = JSON.parse(chat.arguments.logit_bias);
            if(ok_callback) {
                ok_callback("logit_bias");
            }
            return true;
        }
        catch(err) {
            if(ng_callback) {
                ng_callback("logit_bias");
            }
            return false;
        }
    }
}

function compose_arguments(chat, compact_mode) {
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
    if(!validate_argument(chat, "stop", null, null)) {
        chat.arguments.stop = null;
    }
    if(!validate_argument(chat, "logit_bias", null, null)) {
        chat.arguments.logit_bias = null;
    }
    if(chat.arguments.max_tokens < 1) {
        chat.arguments.max_tokens = 0;
    }
    const reformat_funcs = [];
    for(var i=0;i<chat.arguments.functions.length;i++) {
        const new_func = {
            name: chat.arguments.functions[i].name,
            description: chat.arguments.functions[i].description,
            parameters: {
                type: chat.arguments.functions[i].parameters.type,
                required: chat.arguments.functions[i].parameters.required,
            }
        };
        const new_properties = {};
        for(var j=0;j<chat.arguments.functions[i].parameters.properties.length;j++) {
            new_properties[chat.arguments.functions[i].parameters.properties[j].name] = {type: chat.arguments.functions[i].parameters.properties[j].type, description: chat.arguments.functions[i].parameters.properties[j].description};
        }
        new_func.parameters.properties = new_properties;
        reformat_funcs.push(new_func);
    }
    const arg2use = {
        messages: normalize_msg(chat.messages, compact_mode),
        model: chat.arguments.model,
        temperature: chat.arguments.temperature,
        top_p: chat.arguments.top_p,
        presence_penalty: chat.arguments.presence_penalty,
        frequency_penalty: chat.arguments.frequency_penalty,
        stop: chat.arguments.stop,
        stream: chat.arguments.stream,
    };
    if(reformat_funcs.length > 0) {
        arg2use["functions"] = reformat_funcs;
        arg2use["function_call"] = "auto";
    }
    if(chat.arguments.max_tokens >= 1) {
        arg2use["max_tokens"] = chat.arguments.max_tokens;
    }
    if(chat.arguments.logit_bias) {
        arg2use["logit_bias"] = chat.arguments.logit_bias;
    }
    return arg2use
}

function get_chat_api(use_proxy, custom_api) {
    if(use_proxy == "openai") {
        return "https://api.openai.com/v1/chat/completions"
    }
    else if(use_proxy == "custom" && custom_api) {
        return custom_api
    }
    else {
        return "https://api.lcscl.net"
    }
}

function get_stream_api(use_proxy, custom_api) {
    if(use_proxy == "openai") {
        return "https://api.openai.com/v1/chat/completions"
    }
    else if(use_proxy == "custom" && custom_api) {
        return custom_api
    }
    else {
        return "https://stream.lcscl.net"
    }
}

function get_title(chat, compact_mode, use_proxy, custom_api, api_key) {
    // this.confirming_remove_chat = false;
    // this.confirming_clear_chat = false;
    // this.show_share_panel = false;
    const cntxt = normalize_msg(chat.messages, compact_mode);
    const round_count = cntxt.filter(m=>m.role=="assistant").length;
    if(!chat.waiting_for_title && round_count > 0) {
        chat.waiting_for_title = true;
        axios.post(
            get_chat_api(use_proxy, custom_api), 
            {
                "model": "gpt-3.5-turbo-0613", "messages": cntxt.concat([{"role": "user", "content": "Please give this conversation a title in less than 10 words. Without any punctuation."}]), 
                // "temperature": 0
            }, 
            {headers:{"Authorization": "Bearer "+api_key}})
        .then(function(resp) {
            if(resp.data.choices && resp.data.choices[0] && resp.data.choices[0].message) {
                chat.topic = resp.data.choices[0].message.content;
                if(chat.topic.endsWith(".") || chat.topic.endsWith("。")) {
                    chat.topic = chat.topic.slice(0, -1);
                }
            }
        })
        .catch(function(err) {
            console.error(err.message);
        })
        .then(function(){
            chat.waiting_for_title = false;
        });
    }
}

function send_moderation(msg2moderate, use_proxy, api_key) {
    if(!msg2moderate.content) {
        return;
    }
    msg2moderate._flagged = 0;
    const req_body = {"model": "text-moderation-latest", "input": msg2moderate.content};
    axios.post(
        use_proxy=="openai"?"https://api.openai.com/v1/moderations":"https://moderate.lcscl.net", 
        req_body, 
        {
            headers:{"Authorization": "Bearer "+api_key}
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

function stop_streaming(chat) {
    chat.stream_controller.abort();
    chat.stream_controller = null;
    chat.waiting_for_resp = false;
}

function stream_prompt(chat, auto_title, compact_mode, use_proxy, custom_api, api_key, new_msg_callback, agent_meta) {
    var new_answer = "";
    var func_call = null;
    var counter = 0
    const msgidx = chat.messages.length;
    chat.stream_controller = new AbortController();
    fetchEventSource(
        get_stream_api(use_proxy, custom_api), 
        {
            method: "POST",
            body: JSON.stringify(compose_arguments(chat, compact_mode)), 
            headers:{"Authorization": "Bearer "+api_key, "Content-Type": "application/json"}, 
            signal: chat.stream_controller.signal,
            onopen(resp) {
                if(resp.ok && resp.headers.get("content-type") === EventStreamContentType) {
                    console.log("Connected.")
                }
            },
            onmessage(ev) {
                if(ev.data != "[DONE]") {
                    const chunk = JSON.parse(ev.data);
                    // console.log(chunk);
                    const delta = chunk.choices[0].delta;
                    counter += 1
                    if(counter == 1) {
                        // console.log("first chunk!")
                        if (delta.function_call) {
                            func_call = delta.function_call;
                        }
                        chat.messages.push({
                            "role": "assistant", 
                            "content": "", 
                            "function_call": func_call,
                            "_render_mode": "html", 
                            "_used_tokens": NaN, 
                            "_created_ts": (new Date(chunk.created * 1000)).toLocaleString(),
                            "_received_ts": (new Date()).toLocaleString()
                        });
                    }
                    else {
                        new_answer += delta.content?delta.content:"";
                        if(func_call) {
                            func_call.arguments += delta.function_call?delta.function_call.arguments:"";
                        }
                        chat.messages.splice(
                            msgidx, 
                            1, 
                            {
                                "role": "assistant", 
                                "content": new_answer, 
                                "function_call": func_call,
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
                    send_moderation(chat.messages[chat.messages.length - 1], use_proxy, api_key);
                    // 自动命名
                    const round_count = chat.messages.filter(m=>m.role=="assistant").length;
                    if(auto_title == "allr" || (auto_title == "first3r" && round_count > 0 && round_count <= 3)) {
                        get_title(chat, compact_mode, use_proxy, custom_api, api_key);
                    }
                }
                nextTick(new_msg_callback);
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

function _equal(v1, v2) {
    return v1 == v2
}

function _contains(v1, v2) {
    return v1.indexOf(v2) > -1
}

function _startswith(v1, v2) {
    return v1.indexOf(v2) == 0
}

function _endswith(v1, v2) {
    return v1.indexOf(v2) > -1 && v1.indexOf(v2) + v2.length == v1.length
}

function apply_trigger(msg, trigger_meta) {
    return eval("_"+trigger_meta.operator+"(msg.content, trigger_meta.value)")
}

function send_prompt(chat, is_retry, func_name, auto_title, compact_mode, use_proxy, custom_api, api_key, new_msg_callback, agent_meta) {
    if((chat.new_prompt || is_retry || func_name) && !chat.waiting_for_resp) {
        chat.waiting_for_resp = true;
        if(!is_retry && !func_name) {
            const msg = chat.new_prompt;
            chat.new_prompt = "";
            chat.messages.push({"role": "user", "content": msg, "_ts": (new Date()).toLocaleString()});
        }
        if(!is_retry && func_name) {
            const msg = chat.new_prompt;
            chat.new_prompt = "";
            chat.messages.push({"role": "function", "name": func_name, "content": msg, "_ts": (new Date()).toLocaleString(), "_visible": false});
        }
        // 审核输入
        send_moderation(chat.messages[chat.messages.length - 1], use_proxy, api_key);
        nextTick(new_msg_callback);
        if(chat.arguments.stream) {
            stream_prompt(chat, auto_title, compact_mode, use_proxy, custom_api, api_key, new_msg_callback, agent_meta);
        }
        else {
            axios.post(
                get_chat_api(use_proxy, custom_api), 
                compose_arguments(chat, compact_mode), 
                {headers:{"Authorization": "Bearer "+api_key}})
            .then(function(resp) {
                if(resp.data.choices && resp.data.choices[0] && resp.data.choices[0].message) {
                    const new_answer = resp.data.choices[0].message;
                    var agent_on = {node: -1, meta: null};
                    // 如果model决定调用function，就无视agent_meta
                    if(new_answer.function_call) {
                        new_answer._visible = true;
                        for(var i=0;i<chat.arguments.functions.length;i++) {
                            if(chat.arguments.functions[i].name == new_answer.function_call.name) {
                                new_answer._visible = chat.arguments.functions[i].need_confirm;
                                break;
                            }
                        }
                    }
                    else {
                        if(agent_meta) {
                            for(var i=0;i<agent_meta.length;i++) {
                                if(agent_meta[i].action == "run_js" && apply_trigger(new_answer, agent_meta[i].trigger)) {
                                    agent_on.node = i;
                                    agent_on.meta = agent_meta[i].trigger;
                                    break;
                                }
                            }
                        }
                    }
                    if(agent_on.node > -1) {
                        new_answer._visible = !agent_on.meta.hideonhit;
                    }
                    chat.messages.push(new_answer);
                    new_answer._used_tokens = NaN;
                    new_answer._render_mode = "html";
                    new_answer._created_ts = (new Date(resp.data.created * 1000)).toLocaleString();
                    new_answer._received_ts = (new Date()).toLocaleString();
                    const round_count = chat.messages.filter(m=>m.role=="assistant").length;
                    if(resp.data.usage) {
                        new_answer._used_tokens = resp.data.usage.total_tokens;
                        chat.used_tokens += resp.data.usage.total_tokens;
                    }
                    // 审核回复
                    send_moderation(chat.messages[chat.messages.length - 1], use_proxy, api_key);
                    // 自动命名
                    if(auto_title == "allr" || (auto_title == "first3r" && round_count > 0 && round_count <= 3)) {
                        get_title(chat, compact_mode, use_proxy, custom_api, api_key);
                    }
                    if(agent_on.node > -1) {
                        (async ()=>{
                            const agent_resp = await eval(agent_meta[agent_on.node].meta)(chat.messages);
                            if(agent_resp.next=="continue") {
                                chat.messages.push({"role": "user", "content": agent_resp.data, "_visible": agent_resp.visible});
                                chat.waiting_for_resp = false;
                                send_prompt(chat, true, func_name, auto_title, compact_mode, use_proxy, custom_api, api_key, new_msg_callback, agent_meta);
                            }
                            else if(agent_resp.next=="render") {
                                chat.messages.push({"role": "assistant", "content": agent_resp.data, "_visible": true});
                            }
                            else {}
                        })();
                    }
                    if(new_answer.function_call && new_answer._visible === false) {
                        call_func(chat, new_answer.function_call.name, new_answer.function_call.arguments, {auto_title: auto_title, compact_mode: compact_mode, use_proxy: use_proxy, custom_api: custom_api, api_key: api_key}, null);
                    }
                }
            })
            .catch(function(err) {
                if(err.response && err.response.status==401) {
                    chat.messages.push({"role": "_local", "content": "无效的API key"});
                }
                else {
                    chat.messages.push({"role": "_local", "content": err.message});
                }
            })
            .then(function(){
                chat.waiting_for_resp = false;
                nextTick(new_msg_callback);
            });
        }
    }
}

function try_again(chat, msgidx, auto_title, compact_mode, use_proxy, custom_api, api_key, new_msg_callback) {
    // this.confirming_remove_chat = false;
    // this.confirming_clear_chat = false;
    // this.show_share_panel = false;
    var last_user_msg = -1;
    if(msgidx < 1) {
        // 找到最后一条user提问，不牵扯role=system
        for(var i = chat.messages.length - 1; i > 0; i--) {
            if(chat.messages[i].role == "user") {
                last_user_msg = i;
                break;
            }
        }
    }
    else {
        last_user_msg = msgidx;
    }
    // 清除最后一条user提问之后的数据
    if(last_user_msg > -1) {
        chat.messages.splice(last_user_msg + 1, chat.messages.length - last_user_msg - 1);
    }
    send_prompt(chat, true, null, auto_title, compact_mode, use_proxy, custom_api, api_key, new_msg_callback, null);
}

function predict_question(chat, force_refresh, compact_mode, use_proxy, custom_api, api_key) {
    // this.confirming_remove_chat = false;
    // this.confirming_clear_chat = false;
    // this.show_share_panel = false;
    if(!force_refresh) {
        // 点击工具栏按钮
        if(chat.show_predict_questions) {
            // 显示状态下点击工具栏按钮，只关闭
            chat.show_predict_questions = false;
            return
        }
        else {
            // 隐藏状态下点击工具栏按钮，如果没有内容，从服务器拉取（等待回调中打开），否则只打开
            if(chat.predict_questions.length > 0) {
                chat.show_predict_questions = true;
                return
            }
        }
    }
    const cntxt = normalize_msg(chat.messages, compact_mode);
    const round_count = cntxt.filter(m=>m.role=="assistant").length;
    if(!chat.waiting_for_predict && round_count > 0) {
        chat.waiting_for_predict = true;
        axios.post(
            get_chat_api(use_proxy, custom_api), 
            {
                "model": "gpt-3.5-turbo-0613", "messages": cntxt.concat([{"role": "user", "content": 'Please predict 5 related topics based on above conversation. Under 10 words for each. Please reply with standard JSON array. For example:["q1", "q2", "q3", "q4", "q5"]。'}]), 
                // "temperature": 0
            }, 
            {headers:{"Authorization": "Bearer "+api_key}})
        .then(function(resp) {
            if(resp.data.choices && resp.data.choices[0] && resp.data.choices[0].message) {
                var rslt = null;
                try {
                    rslt = JSON.parse(resp.data.choices[0].message.content.match(/[\r\n\s]*\[(.*?)\][\r\n\s]*/gs));
                }
                catch(err) {
                    console.error(err);
                }
                if(rslt) {
                    chat.predict_questions = rslt;
                    if(!chat.show_predict_questions) {
                        chat.show_predict_questions = true;
                    }
                }
            }
        })
        .catch(function(err) {
            console.error(err.message);
        })
        .then(function(){
            chat.waiting_for_predict = false;
        });
    }
}

async function call_func(chat, func_name, args, cfg, new_msg_callback) {
    chat.waiting_for_func = true;
    for(var i=0;i<chat.arguments.functions.length;i++) {
        const func = chat.arguments.functions[i];
        if(func.name == func_name) {
            const call_rslt = await eval(func.code)(JSON.parse(args));
            chat.waiting_for_func = false;
            chat.new_prompt = call_rslt;
            send_prompt(chat, false, func_name, cfg.auto_title, cfg.compact_mode, cfg.use_proxy, cfg.custom_api, cfg.api_key, new_msg_callback, null);
            break;
        }
    }
    chat.waiting_for_func = false;
}

export { default_func_param, default_function, default_arguments, normalize_msg, get_title, send_prompt, stop_streaming, try_again, predict_question, validate_argument, call_func }
