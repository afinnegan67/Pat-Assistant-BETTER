"use strict";(()=>{var e={};e.id=706,e.ids=[706],e.modules={399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},7829:(e,t,r)=>{r.r(t),r.d(t,{originalPathname:()=>k,patchFetch:()=>$,requestAsyncStorage:()=>v,routeModule:()=>g,serverHooks:()=>w,staticGenerationAsyncStorage:()=>b});var a={};r.r(a),r.d(a,{GET:()=>y,POST:()=>f});var n=r(9303),i=r(8716),o=r(670),s=r(7070),d=r(1931),l=r(9313),c=r(3240);let u=`You generate Patrick's daily morning brief. You receive:
- Today's tasks (with deadlines and priorities)
- Overdue tasks
- Today's calendar events
- Upcoming project milestones

Generate a concise morning brief that:
1. Leads with the most urgent items
2. Lists what's due today
3. Lists overdue items that need attention
4. Mentions any calendar events
5. Ends with a count summary

Keep it scannable. No fluff. Patrick is reading this at 6am before his day starts.

Example tone:
"Morning. 4 tasks due today, 2 overdue from last week.

Due today:
- Send Chen change order (high priority)
- Call inspector for Hubble
- Order materials for Johnson deck
- Submit receipts

Overdue:
- Return $600 item to Home Depot (3 days)
- Follow up with Manny on drywall (5 days)

Calendar: 9am client meeting at Chen site, 2pm admin meeting.

Total open tasks: 23 across 8 projects."`;async function p(){try{let[e,t,r,a,n]=await Promise.all([(0,l.hR)(),(0,l.yJ)(),(0,l.TK)(),(0,l.AF)(),(0,c.Py)().catch(()=>[])]),i=e.length>0?e.map(e=>`- ${function(e){let t=[e.description];return("high"===e.priority||"urgent"===e.priority)&&t.push(`(${e.priority} priority)`),t.join(" ")}(e)}`).join("\n"):"No tasks due today.",o=t.length>0?t.map(e=>`- ${function(e){if(!e.deadline)return e.description;let t=new Date(e.deadline),r=Math.floor((new Date().getTime()-t.getTime())/864e5);return`${e.description} (${r} day${1===r?"":"s"} overdue)`}(e)}`).join("\n"):"No overdue tasks.",s=n.length>0?(0,c.Pl)(n):"No calendar events today.",p=[{role:"system",content:u},{role:"user",content:`Today's tasks (${e.length}):
${i}

Overdue tasks (${t.length}):
${o}

Calendar events:
${s}

Total open tasks: ${r.length}
Active projects: ${a.length}

Generate the morning brief.`}],m=await (0,d.XZ)(p),h=[...e.map(e=>e.id),...t.map(e=>e.id)];return{content:m.trim(),taskIds:h}}catch(e){return console.error("Briefing generation error:",e),{content:"Your nephew Aidan failed to build me correctly. Blame him not me.",taskIds:[]}}}var m=r(2126);let h=process.env.CRON_SECRET;async function y(e){try{if(h&&e.headers.get("authorization")!==`Bearer ${h}`)return s.NextResponse.json({error:"Unauthorized"},{status:401});await (0,l.Kv)();let{content:t,taskIds:r}=await p(),a=new Date().toISOString().split("T")[0];try{await (0,l.iY)({brief_date:a,content:t,tasks_included:r})}catch(e){console.log("Brief may already exist for today:",e)}return await (0,m._b)(t),s.NextResponse.json({success:!0,date:a,tasksIncluded:r.length})}catch(e){console.error("Daily brief error:",e);try{await (0,m._b)("Your nephew Aidan failed to build me correctly. Blame him not me. (Daily brief failed)")}catch(e){console.error("Failed to send error notification:",e)}return s.NextResponse.json({error:"Daily brief failed",details:e.message},{status:500})}}async function f(e){return y(e)}let g=new n.AppRouteRouteModule({definition:{kind:i.x.APP_ROUTE,page:"/api/cron/daily-brief/route",pathname:"/api/cron/daily-brief",filename:"route",bundlePath:"app/api/cron/daily-brief/route"},resolvedPagePath:"C:\\Users\\aidan\\OneDrive\\Documents\\Pats Assitant Improved\\app\\api\\cron\\daily-brief\\route.ts",nextConfigOutput:"",userland:a}),{requestAsyncStorage:v,staticGenerationAsyncStorage:b,serverHooks:w}=g,k="/api/cron/daily-brief/route";function $(){return(0,o.patchFetch)({serverHooks:w,staticGenerationAsyncStorage:b})}}};var t=require("../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),a=t.X(0,[276,564,550],()=>r(7829));module.exports=a})();