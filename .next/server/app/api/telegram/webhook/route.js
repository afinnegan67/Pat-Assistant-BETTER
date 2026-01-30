"use strict";(()=>{var e={};e.id=9,e.ids=[9],e.modules={399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},2048:e=>{e.exports=require("fs")},9801:e=>{e.exports=require("os")},5315:e=>{e.exports=require("path")},7031:(e,t,r)=>{r.r(t),r.d(t,{originalPathname:()=>ee,patchFetch:()=>et,requestAsyncStorage:()=>X,routeModule:()=>V,serverHooks:()=>Z,staticGenerationAsyncStorage:()=>Q});var n={};r.r(n),r.d(n,{GET:()=>J,POST:()=>K});var o=r(9303),a=r(8716),s=r(670),i=r(7070),c=r(2126),l=r(9313);async function d(e){return await (0,l.kD)(e)||{current_task_id:void 0,current_project_id:void 0,recently_mentioned_tasks:[],recently_mentioned_projects:[]}}async function u(e){return(0,l.RJ)(e)}function p(e,t,r,n=.5){let o=[];for(let a of t){let t=function(e,t){let r=e.toLowerCase(),n=t.toLowerCase();if(r===n)return 1;if(n.includes(r))return .9;if(r.includes(n))return .85;let o=Math.max(r.length,n.length);return 1-function(e,t){let r=[];for(let e=0;e<=t.length;e++)r[e]=[e];for(let t=0;t<=e.length;t++)r[0][t]=t;for(let n=1;n<=t.length;n++)for(let o=1;o<=e.length;o++)t.charAt(n-1)===e.charAt(o-1)?r[n][o]=r[n-1][o-1]:r[n][o]=Math.min(r[n-1][o-1]+1,r[n][o-1]+1,r[n-1][o]+1);return r[t.length][e.length]}(r,n)/o}(e,r(a));t>=n&&o.push({item:a,score:t})}return o.sort((e,t)=>t.score-e.score),o}async function h(e,t){if(["that project","this project","the project","it"].some(t=>e.toLowerCase().includes(t))){if(t.current_project_id){let e=await (0,l.Rp)(t.current_project_id);if(e)return[e]}for(let e of t.recently_mentioned_projects){let t=await (0,l.Rp)(e);if(t)return[t]}return[]}let r=p(e,await (0,l.Yw)(),e=>e.name,.4);for(let e of r)t.recently_mentioned_projects.includes(e.item.id)&&(e.score+=.2);return(r.sort((e,t)=>t.score-e.score),0===r.length)?[]:r[0].score>=.9||1===r.length||r[0].score-r[1].score>.2?[r[0].item]:r.slice(0,3).map(e=>e.item)}async function m(e,t,r){if(["that task","this task","the task","it","that","this one"].some(t=>e.toLowerCase().includes(t))){if(t.current_task_id){let e=await (0,l.yW)(t.current_task_id);if(e)return[e]}for(let e of t.recently_mentioned_tasks){let t=await (0,l.yW)(e);if(t)return[t]}return[]}let n=await (0,l.km)(),o=p(e,r?n.filter(e=>e.project_id===r):n,e=>e.description,.4);for(let e of o)t.recently_mentioned_tasks.includes(e.item.id)&&(e.score+=.2);return(o.sort((e,t)=>t.score-e.score),0===o.length)?[]:o[0].score>=.9||1===o.length||o[0].score-o[1].score>.2?[o[0].item]:o.slice(0,3).map(e=>e.item)}async function f(e,t,r){let n={projects:[],tasks:[]};for(let t of e)for(let e of(await h(t,r)))n.projects.find(t=>t.id===e.id)||n.projects.push({name:e.name,id:e.id});let o=n.projects[0]?.id;for(let e of t)for(let t of(await m(e,r,o)))n.tasks.find(e=>e.id===t.id)||n.tasks.push({description:t.description,id:t.id});return n}var k=r(2374),y=r(7997),g=r(1491),_=r(8618);let w=`You are a routing agent for Patrick's construction management assistant. Your job is to classify the user's intent and extract relevant entities.

Patrick is a construction project manager. He tracks tasks, manages multiple job sites (projects), and needs to stay organized.

Classify the intent into exactly one of:
- task_create: User wants to create a new task or to-do
- task_update: User wants to modify an existing task (priority, deadline, description)
- task_complete: User is marking a task as done
- task_query: User is asking about tasks (listing, filtering, searching)
- project_create: User wants to create a new project/job site
- project_update: User wants to modify a project (status, details)
- project_query: User is asking about a project's status or details
- schedule_query: User is asking about their schedule, calendar, or what they have to do
- knowledge_query: User is asking about past decisions, context, or information
- record_request: User wants to record a meeting, voice note, or make a recording
- general_chat: Greetings, acknowledgments, or unclear intent

Also extract any mentioned:
- Project names (even partial or nicknames)
- Task references (descriptions or "that task", "the change order", etc.)
- Dates or deadlines mentioned
- Priority levels mentioned

If the user says "that task" or "this project", check the active_context to resolve what they mean.`;async function j(e,t,r){try{let{toolCalls:n}=await (0,k._4)({model:g.bt,tools:{classifyIntent:(0,y.w3)({description:"Classify user intent and extract entities from the message",inputSchema:_.Xl})},toolChoice:{type:"tool",toolName:"classifyIntent"},system:w,prompt:`Active Context:
${function(e){let t=[];return e.current_project_id&&t.push(`Current project: ${e.current_project_id}`),e.current_task_id&&t.push(`Current task: ${e.current_task_id}`),e.recently_mentioned_projects.length>0&&t.push(`Recently mentioned projects: ${e.recently_mentioned_projects.join(", ")}`),e.recently_mentioned_tasks.length>0&&t.push(`Recently mentioned tasks: ${e.recently_mentioned_tasks.join(", ")}`),t.length>0?t.join("\n"):"No active context."}(r)}

Today's conversation so far:
${0===t.length?"No previous messages today.":t.slice(-10).map(e=>`${e.role}: ${e.content}`).join("\n")}

New message from Patrick: "${e}"

Classify this message and extract entities. You MUST call the classifyIntent tool with your classification.`}),o=n[0];if(!o||o.dynamic)throw Error("No tool call result received");let a=o.input;return{intent:a.intent,entities:{projects:a.entities.projects,tasks:a.entities.tasks,deadline:a.entities.deadline,priority:a.entities.priority},requires_lookup:a.requires_lookup,confidence:a.confidence}}catch(e){return console.error("Router error:",e),{intent:"general_chat",entities:{projects:[],tasks:[],deadline:null,priority:null},requires_lookup:!1,confidence:"low"}}}let v=`You are the task management agent for Patrick's construction assistant. You handle creating, updating, completing, and querying tasks.

You will receive:
- The user's intent (task_create, task_update, task_complete, task_query)
- Resolved entities (project IDs, task IDs if applicable)
- The user's message
- Today's conversation context

For task_create:
- Extract the task description
- Link to project if mentioned (use resolved project_id)
- Extract deadline if mentioned
- Extract priority if mentioned (default: medium)
- Return the created task details

For task_update:
- Identify which task to update (from resolved entities or active_context)
- Apply the requested changes
- Return the updated task details

For task_complete:
- Identify which task to complete
- Mark status as 'completed', set completed_at timestamp
- Return confirmation with task description

For task_query:
- Query tasks based on filters (project, status, deadline)
- Return list of matching tasks`;async function $(e){try{let{toolCalls:t}=await (0,k._4)({model:g.bt,tools:{processTask:(0,y.w3)({description:"Process the task intent and return the appropriate action",inputSchema:_.dM})},toolChoice:{type:"tool",toolName:"processTask"},system:v,prompt:function(e){let t=[`Intent: ${e.intent}`,`User message: "${e.userMessage}"`];return e.resolvedEntities.projects.length>0&&t.push(`Resolved projects: ${e.resolvedEntities.projects.map(e=>`${e.name} (${e.id})`).join(", ")}`),e.resolvedEntities.tasks.length>0&&t.push(`Resolved tasks: ${e.resolvedEntities.tasks.map(e=>`${e.description} (${e.id})`).join(", ")}`),e.activeContext.current_task_id&&t.push(`Current task in context: ${e.activeContext.current_task_id}`),e.activeContext.current_project_id&&t.push(`Current project in context: ${e.activeContext.current_project_id}`),t.join("\n")}(e)+"\n\nYou MUST call the processTask tool with your response."}),r=t[0];if(!r||r.dynamic)throw Error("No tool call result received");let n=r.input;switch(n.action){case"create":return await b(n,e);case"update":return await E(n,e);case"complete":return await x(n,e);case"query":return await T(n,e);default:return{action:"queried",task:null,tasks:null,error:"Unknown action requested"}}}catch(e){return console.error("Task agent error:",e),{action:"queried",task:null,tasks:null,error:"Your nephew Aidan failed to build me correctly. Blame him not me."}}}async function b(e,t){if(!e.task_description)return{action:"created",task:null,tasks:null,error:"No task description provided"};let r=t.resolvedEntities.projects[0]?.id||e.project_id;return{action:"created",task:await (0,l.vr)({description:e.task_description,project_id:r,deadline:e.deadline,priority:e.priority||"medium"}),tasks:null,error:null}}async function E(e,t){let r=e.task_id||t.resolvedEntities.tasks[0]?.id||t.activeContext.current_task_id;if(!r)return{action:"updated",task:null,tasks:null,error:"Could not identify which task to update"};if(!await (0,l.yW)(r))return{action:"updated",task:null,tasks:null,error:"Task not found"};let n={};return e.updates?.description&&(n.description=e.updates.description),e.updates?.priority&&(n.priority=e.updates.priority),e.updates?.deadline&&(n.deadline=e.updates.deadline),e.updates?.status&&(n.status=e.updates.status),e.priority&&(n.priority=e.priority),e.deadline&&(n.deadline=e.deadline),{action:"updated",task:await (0,l.xJ)(r,n),tasks:null,error:null}}async function x(e,t){let r=e.task_id||t.resolvedEntities.tasks[0]?.id||t.activeContext.current_task_id;return r?await (0,l.yW)(r)?{action:"completed",task:await (0,l.Wl)(r),tasks:null,error:null}:{action:"completed",task:null,tasks:null,error:"Task not found"}:{action:"completed",task:null,tasks:null,error:"Could not identify which task to complete"}}async function T(e,t){let r=[];switch(e.query_type){case"project":let n=t.resolvedEntities.projects[0]?.id||e.project_id||t.activeContext.current_project_id;r=n?await (0,l.W9)(n):await (0,l.TK)();break;case"overdue":r=await (0,l.yJ)();break;case"today":r=await (0,l.hR)();break;case"search":r=e.search_term?await (0,l.E5)(e.search_term):await (0,l.TK)();break;default:r=await (0,l.TK)()}return{action:"queried",task:null,tasks:r,error:null}}let C=`You are the project management agent for Patrick's construction assistant. You handle creating and updating projects (job sites).

Projects have:
- name (required): The project identifier, often a client name or address
- client_name: The client's name
- address: Job site address
- project_type: Type of work (kitchen, bathroom, deck, full_remodel, etc.)
- status: future, active, on_hold, completed

For project_create:
- Extract project name (required)
- Extract any other details mentioned
- Default status is 'future'

For project_update:
- Identify which project (from resolved entities)
- Apply changes (status updates, adding details)`;async function P(e){try{let{toolCalls:t}=await (0,k._4)({model:g.bt,tools:{processProject:(0,y.w3)({description:"Process the project intent and return the appropriate action",inputSchema:_.Jk})},toolChoice:{type:"tool",toolName:"processProject"},system:C,prompt:function(e){let t=[`Intent: ${e.intent}`,`User message: "${e.userMessage}"`];return e.resolvedEntities.projects.length>0&&t.push(`Resolved projects: ${e.resolvedEntities.projects.map(e=>`${e.name} (${e.id})`).join(", ")}`),e.activeContext.current_project_id&&t.push(`Current project in context: ${e.activeContext.current_project_id}`),t.join("\n")}(e)+"\n\nYou MUST call the processProject tool with your response."}),r=t[0];if(!r||r.dynamic)throw Error("No tool call result received");let n=r.input;if("create"===n.action)return await R(n);return await S(n,e)}catch(e){return console.error("Project agent error:",e),{action:"created",project:null,error:"Your nephew Aidan failed to build me correctly. Blame him not me."}}}async function R(e){return e.name?{action:"created",project:await (0,l.$L)({name:e.name,client_name:e.client_name,address:e.address,project_type:e.project_type,status:e.status||"future"}),error:null}:{action:"created",project:null,error:"No project name provided"}}async function S(e,t){let r=e.project_id||t.resolvedEntities.projects[0]?.id||t.activeContext.current_project_id;if(!r)return{action:"updated",project:null,error:"Could not identify which project to update"};if(!await (0,l.Rp)(r))return{action:"updated",project:null,error:"Project not found"};let n={};return e.name&&(n.name=e.name),void 0!==e.client_name&&(n.client_name=e.client_name),void 0!==e.address&&(n.address=e.address),void 0!==e.project_type&&(n.project_type=e.project_type),e.status&&(n.status=e.status),{action:"updated",project:await (0,l.ty)(r,n),error:null}}var q=r(5090);let A=`You are the knowledge retrieval agent for Patrick's construction assistant. You answer questions about projects using semantic search over stored knowledge.

You have access to:
- Project knowledge chunks (decisions, notes, context from meetings)
- Project details
- Task history

When answering:
- Search for relevant knowledge using the query
- Synthesize information from multiple chunks if needed
- Be specific - cite what was decided and when if available
- If you don't have the information, say so directly

Be matter-of-fact and blunt. No fluff.`;async function N(e){try{var t;let r=e.resolvedEntities.projects[0]?.id||e.activeContext.current_project_id,n=[];try{n=await (0,q.pN)(e.userMessage,r,5)}catch(e){console.error("Semantic search failed:",e),r&&(n=await (0,l.zx)(r))}let o="";if(r){let e=await (0,l.Rp)(r);e&&(o=`
Project: ${e.name}
Status: ${e.status}
Client: ${e.client_name||"Unknown"}
Type: ${e.project_type||"Not specified"}
Address: ${e.address||"Not specified"}`)}let{text:a}=await (0,k._4)({model:g.pr,system:A,prompt:`Patrick asked: "${e.userMessage}"
${o}

Relevant knowledge from the database:
${(t=n,0===t.length?"No relevant knowledge found in the database.":t.map((e,t)=>{let r=new Date(e.created_at).toLocaleDateString();return`[${t+1}] (${r}, ${e.source_type}): ${e.content}`}).join("\n\n"))}

Based on this information, answer Patrick's question. If the information isn't available, say so directly.`}),s="low";return n.length>=3?s="high":n.length>=1&&(s="medium"),{answer:a.trim(),sources:n.map(e=>({content:e.content,created_at:e.created_at})),confidence:s}}catch(e){return console.error("Knowledge agent error:",e),{answer:"Your nephew Aidan failed to build me correctly. Blame him not me.",sources:[],confidence:"low"}}}async function I(e){let t=e.resolvedEntities.projects[0]?.id||e.activeContext.current_project_id;if(!t)return{answer:"Which project are you asking about?",sources:[],confidence:"low"};let r=await (0,l.Rp)(t);if(!r)return{answer:"Project not found.",sources:[],confidence:"low"};let n=(await (0,l.zx)(t)).slice(0,5),o=`${r.name} is ${r.status}.
Client: ${r.client_name||"Unknown"}
Type: ${r.project_type||"Not specified"}
Address: ${r.address||"Not specified"}`;if(n.length>0){let e=n.map(e=>`- ${e.content}`).join("\n");return{answer:`${o}

Recent notes:
${e}`,sources:n.map(e=>({content:e.content,created_at:e.created_at})),confidence:"high"}}return{answer:o,sources:[],confidence:"high"}}let U=`You are the response generator for Patrick's construction assistant. You take structured results from specialist agents and generate natural language responses.

CRITICAL RULES:
1. Be matter-of-fact and blunt. No fluff, no corporate speak, no sycophancy.
2. Never use templates. Every response is unique.
3. Never apologize unless something actually went wrong.
4. Keep responses concise but complete.
5. Ask useful follow-up questions when relevant (e.g., "Did you finish anything else?")
6. Never use phrases like "Great!", "Absolutely!", "I'd be happy to", "Of course!", "Perfect!", "Awesome!", "Certainly!"

VOICE EXAMPLES:
- User marks task complete -> "Marked the Chen change order as complete. Anything else done?"
- User asks schedule -> "Today you have: [list]. Plus 3 overdue tasks from last week."
- User creates task -> "Added: Send change order to Chen client. Deadline set for Friday."
- Error occurred -> "Your nephew Aidan failed to build me correctly. Blame him not me."

When generating responses:
- If showing a list, keep it scannable but not bullet-heavy
- If the specialist returned an error, communicate it bluntly
- If clarification is needed, ask directly
- If multiple matches found, ask which one they mean

Generate only the response text, nothing else.`;function L(e){let t=[e.description];if(e.deadline){let r=new Date(e.deadline);t.push(`due ${r.toLocaleDateString()}`)}return"medium"!==e.priority&&t.push(`(${e.priority} priority)`),t.join(" - ")}async function D(e){let t=function(e){let{intent:t,result:r,tasks:n,events:o,error:a}=e;if(a)return`Error: ${a}`;if("schedule_query"===t){let e=[];return n&&n.length>0&&(e.push(`Tasks (${n.length}):`),n.forEach(t=>e.push(`- ${L(t)}`))),o&&o.length>0&&(e.push(`
Calendar events:`),o.forEach(t=>{let r=new Date(t.start).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});e.push(`- ${r}: ${t.summary}`)})),e.join("\n")||"No tasks or events today."}if(!r)return"No result from specialist agent.";if("action"in r&&r.action){if(r.error)return`Error: ${r.error}`;switch(r.action){case"created":return`Task created: ${L(r.task)}`;case"updated":return`Task updated: ${L(r.task)}`;case"completed":return`Task completed: ${r.task.description}`;case"queried":if(!r.tasks||0===r.tasks.length)return"No matching tasks found.";return`Found ${r.tasks.length} task(s):
${r.tasks.map(e=>`- ${L(e)}`).join("\n")}`}}if("project"in r&&r.project){if(r.error)return`Error: ${r.error}`;let e=r.project;return"created"===r.action?`Project created: ${e.name} (${e.status})`:`Project updated: ${e.name} is now ${e.status}`}return"answer"in r?`${r.answer}

Confidence: ${r.confidence}`:"Result processed."}(e);try{let{text:r}=await (0,k._4)({model:g.pr,system:U,prompt:`Patrick said: "${e.userMessage}"

Intent classified as: ${e.intent}

Result from specialist agent:
${t}

Generate a natural, blunt response for Patrick. Remember: no fluff, no apologies, no corporate speak.`});return r.trim()}catch(e){return console.error("Response generation error:",e),"Your nephew Aidan failed to build me correctly. Blame him not me."}}async function M(e,t){let r=e.toLowerCase().trim();for(let{pattern:e,response:t}of[{pattern:/^(thanks|thank you|thx)/i,response:"Yep."},{pattern:/^(ok|okay|got it|gotcha)/i,response:"Let me know if you need anything."},{pattern:/^(hi|hello|hey)/i,response:"What do you need?"},{pattern:/^(bye|later|goodbye)/i,response:"Later."}])if(e.test(r))return t;try{let{text:t}=await (0,k._4)({model:g.pr,system:U,prompt:`Patrick said: "${e}"

This is general chat - not a task, project, or query request. Generate a brief, natural response. Don't be robotic but don't be overly friendly either.`});return t.trim()}catch(e){return console.error("Response generation error:",e),"Your nephew Aidan failed to build me correctly. Blame him not me."}}function O(e,t){let r=t.map((e,t)=>{let r="name"in e?e.name:e.description;return`${t+1}. ${r}`});return`Which ${e} do you mean?
${r.join("\n")}`}var G=r(3240);let Y=process.env.TELEGRAM_WEBHOOK_SECRET,B=process.env.PATRICK_TELEGRAM_ID,W=process.env.AIDAN_TELEGRAM_ID,z=[B,W];async function F(e){let t=process.env.ELEVENLABS_API_KEY,r=new File([new Blob([new Uint8Array(e)],{type:"audio/ogg"})],"voice.ogg",{type:"audio/ogg"}),n=new FormData;n.append("file",r),n.append("model_id","scribe_v1");let o=await fetch("https://api.elevenlabs.io/v1/speech-to-text",{method:"POST",headers:{"xi-api-key":t},body:n});if(!o.ok){let e=await o.text();throw Error(`Transcription failed: ${e}`)}return(await o.json()).text}async function H(e){let t=e.chat.id,r=e.from.id;if(!z.includes(r.toString())){await (0,c.bG)(t,"I only talk to Patrick and Aidan. Sorry!");return}let n=e.text||"";if(e.voice)try{(0,c.zh)(t).catch(()=>{});let r=await (0,c.kN)(e.voice.file_id);n=await F(r),await (0,c.bG)(t,`Heard: "${n.slice(0,100)}${n.length>100?"...":""}"`)}catch(e){console.error("Voice processing error:",e),await (0,c.mo)("Voice message processing");return}if(n.trim())try{let e;(0,c.zh)(t).catch(()=>{});let r=await (0,l._i)(),[i,p]=await Promise.all([d(r),u(r)]);await (0,l.zE)(r,"user",n,i);let h=await j(n,p,i);h.requires_lookup&&(0,c.zh)(t).catch(()=>{});let m=await f(h.entities.projects,h.entities.tasks,i);if(m.projects.length>1&&1===h.entities.projects.length){let e=O("project",m.projects);await (0,c.bG)(t,e),await (0,l.zE)(r,"assistant",e,i);return}if(m.tasks.length>1&&1===h.entities.tasks.length){let e=O("task",m.tasks);await (0,c.bG)(t,e),await (0,l.zE)(r,"assistant",e,i);return}let k={intent:h.intent,todaysMessages:p,activeContext:i,resolvedEntities:m,userMessage:n},y=i;if("record_request"===h.intent)e=`Here's the recording link: https://pat-assistant-better-1n5hd641w-opulence-ai.vercel.app/record

Open this on your phone or computer to record a meeting or voice note. I'll process it and extract tasks and notes automatically.`;else{var o,a,s;if(o=h.intent,["general_chat"].includes(o))e=await M(n,p);else switch(function(e){switch(e){case"task_create":case"task_update":case"task_complete":case"task_query":return"task";case"project_create":case"project_update":return"project";case"project_query":case"knowledge_query":return"knowledge";case"schedule_query":return"schedule";default:return null}}(h.intent)){case"task":let t=await $(k);e=await D({intent:h.intent,userMessage:n,todaysMessages:p,result:t}),"created"===t.action&&t.task&&(a=t.task.id,y={...i,current_task_id:a,recently_mentioned_tasks:[a,...i.recently_mentioned_tasks.filter(e=>e!==a)].slice(0,5)});break;case"project":let r=await P(k);e=await D({intent:h.intent,userMessage:n,todaysMessages:p,result:r}),"created"===r.action&&r.project&&(s=r.project.id,y={...i,current_project_id:s,recently_mentioned_projects:[s,...i.recently_mentioned_projects.filter(e=>e!==s)].slice(0,5)});break;case"knowledge":let c="project_query"===h.intent?await I(k):await N(k);e=await D({intent:h.intent,userMessage:n,todaysMessages:p,result:c});break;case"schedule":let[d,u,m]=await Promise.all([(0,l.hR)(),(0,l.yJ)(),(0,G.Py)().catch(()=>[])]);e=await D({intent:h.intent,userMessage:n,todaysMessages:p,tasks:[...d,...u],events:m});break;default:e=await M(n,p)}}y=function(e,t){let r={...e,recently_mentioned_tasks:[...e.recently_mentioned_tasks],recently_mentioned_projects:[...e.recently_mentioned_projects]};for(let e of t.projects)r.recently_mentioned_projects.includes(e.id)||r.recently_mentioned_projects.unshift(e.id),r.current_project_id=e.id;for(let e of t.tasks)r.recently_mentioned_tasks.includes(e.id)||r.recently_mentioned_tasks.unshift(e.id),r.current_task_id=e.id;return r.recently_mentioned_tasks=r.recently_mentioned_tasks.slice(0,5),r.recently_mentioned_projects=r.recently_mentioned_projects.slice(0,5),r}(y,m),await (0,c.bG)(t,e),await (0,l.zE)(r,"assistant",e,y)}catch(e){console.error("Message processing error:",e),await (0,c.mo)("Message processing")}}async function K(e){try{console.log("=== WEBHOOK DEBUG START ==="),console.log("Request URL:",e.url),console.log("Request method:",e.method);let t={};e.headers.forEach((e,r)=>{t[r]=r.toLowerCase().includes("secret")?`${e.substring(0,10)}...`:e}),console.log("All headers:",JSON.stringify(t,null,2));let r=e.headers.get("x-telegram-bot-api-secret-token");if(console.log("--- Secret Validation ---"),console.log("Secret header present:",null!==r),console.log("Secret header value:",r?`${r.substring(0,10)}...(length: ${r.length})`:"NULL"),console.log("Expected secret set:",!!Y),console.log("Expected secret value:",Y?`${Y.substring(0,10)}...(length: ${Y.length})`:"NOT SET"),console.log("Exact match:",r===Y),console.log("Trimmed match:",r?.trim()===Y?.trim()),console.log("=== WEBHOOK DEBUG END ==="),!(0,c._P)(r,Y))return console.log("AUTH FAILED - Returning 401"),i.NextResponse.json({error:"Unauthorized"},{status:401});console.log("AUTH SUCCESS - Processing update");let n=await e.json();if(console.log("Update received:",JSON.stringify(n,null,2)),n.message)try{await H(n.message)}catch(e){console.error("Message processing error:",e)}return i.NextResponse.json({ok:!0})}catch(e){return console.error("Webhook error:",e),i.NextResponse.json({error:"Internal error"},{status:500})}}async function J(){return i.NextResponse.json({status:"Webhook active",debug:{webhookSecretConfigured:!!Y,webhookSecretLength:Y?.length||0,webhookSecretPreview:Y?`${Y.substring(0,5)}...`:"NOT SET",patrickIdConfigured:!!B,aidanIdConfigured:!!W,allowedUsers:z.length}})}let V=new o.AppRouteRouteModule({definition:{kind:a.x.APP_ROUTE,page:"/api/telegram/webhook/route",pathname:"/api/telegram/webhook",filename:"route",bundlePath:"app/api/telegram/webhook/route"},resolvedPagePath:"C:\\Users\\aidan\\OneDrive\\Documents\\Pats Assitant Improved\\app\\api\\telegram\\webhook\\route.ts",nextConfigOutput:"",userland:n}),{requestAsyncStorage:X,staticGenerationAsyncStorage:Q,serverHooks:Z}=V,ee="/api/telegram/webhook/route";function et(){return(0,s.patchFetch)({serverHooks:Z,staticGenerationAsyncStorage:Q})}},3240:(e,t,r)=>{r.d(t,{Pl:()=>u,Py:()=>d});let n=process.env.GOOGLE_CLIENT_ID,o=process.env.GOOGLE_CLIENT_SECRET,a=process.env.GOOGLE_REFRESH_TOKEN,s=null,i=0;async function c(){if(s&&Date.now()<i-6e4)return s;let e=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:n,client_secret:o,refresh_token:a,grant_type:"refresh_token"})});if(!e.ok){let t=await e.text();throw Error(`Failed to refresh Google token: ${t}`)}let t=await e.json(),r=t.access_token;return s=r,i=Date.now()+1e3*t.expires_in,r}async function l(e,t){let r=await c(),n=new URL(`https://www.googleapis.com/calendar/v3${e}`);t&&Object.entries(t).forEach(([e,t])=>{n.searchParams.append(e,t)});let o=await fetch(n.toString(),{headers:{Authorization:`Bearer ${r}`}});if(!o.ok){let e=await o.text();throw Error(`Google Calendar API error: ${e}`)}return o.json()}async function d(){let e=new Date,t=e.getTimezoneOffset(),r=new Date(e.getTime()+(t- -480)*6e4),n=new Date(r);n.setHours(0,0,0,0);let o=new Date(r);return o.setHours(23,59,59,999),((await l("/calendars/primary/events",{timeMin:n.toISOString(),timeMax:o.toISOString(),singleEvents:"true",orderBy:"startTime"})).items||[]).map(e=>({id:e.id,summary:e.summary||"No title",start:e.start.dateTime||e.start.date||"",end:e.end.dateTime||e.end.date||"",location:e.location}))}function u(e){return 0===e.length?"No calendar events today.":e.map(e=>{let t=function(e){let t=new Date(e.start),r=t.getHours(),n=t.getMinutes().toString().padStart(2,"0");return`${r%12||12}:${n}${r>=12?"pm":"am"}`}(e),r=e.location?` at ${e.location}`:"";return`${t} ${e.summary}${r}`}).join("\n")}}};var t=require("../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),n=t.X(0,[276,460,562],()=>r(7031));module.exports=n})();