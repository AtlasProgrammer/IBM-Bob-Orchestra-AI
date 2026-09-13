import http from 'node:http';
import { URL } from 'node:url';

const PORT = Number(process.env.PORT || 8787);
const WATSONX_URL = (process.env.WATSONX_URL || 'https://us-south.ml.cloud.ibm.com').replace(/\/$/, '');
const WATSONX_API_VERSION = process.env.WATSONX_API_VERSION || '2025-10-25';
const WATSONX_MODEL_ID = process.env.WATSONX_MODEL_ID || 'ibm/granite-4-h-small';
const WATSONX_PROJECT_ID = process.env.WATSONX_PROJECT_ID;
const WATSONX_API_KEY = process.env.WATSONX_API_KEY;

const scenarioDefinitions = {
  baseline: { label:'Baseline', score:84, days:13, value:420000, risk:0.16, confidence:0.86 },
  capacity_loss_20: { label:'20% capacity loss', score:68, days:17, value:356000, risk:0.29, confidence:0.72 },
  deadline_10: { label:'Deadline moved to 10 days', score:61, days:10, value:381000, risk:0.24, confidence:0.67 },
  engineer_unavailable: { label:'Critical engineer unavailable', score:55, days:19, value:331000, risk:0.37, confidence:0.60 }
};

const demoSources = {
  github: {
    connected: true, mode:'demo', label:'GitHub', lastSync:'just now', count:18,
    details:'14 commits · 3 PRs · 1 open issue'
  },
  jira: {
    connected: true, mode:'demo', label:'Jira', lastSync:'just now', count:9,
    details:'6 issues · 2 blockers · 1 overdue'
  },
  slack: {
    connected: true, mode:'demo', label:'Slack', lastSync:'just now', count:27,
    details:'27 signals · 4 risk phrases · 3 decisions'
  },
  calendar: {
    connected: true, mode:'demo', label:'Calendar', lastSync:'just now', count:8,
    details:'8 events · 2 capacity conflicts'
  }
};

let twin = createDemoTwin();
let lastSync = null;

function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type':'application/json',
    'Access-Control-Allow-Origin':'*',
    'Access-Control-Allow-Headers':'Content-Type',
    'Access-Control-Allow-Methods':'GET,POST,OPTIONS'
  });
  res.end(body);
}

async function getIamToken() {
  if (!WATSONX_API_KEY) throw new Error('WATSONX_API_KEY is not configured');
  const r = await fetch('https://iam.cloud.ibm.com/identity/token', {
    method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({grant_type:'urn:ibm:params:oauth:grant-type:apikey', apikey:WATSONX_API_KEY})
  });
  if (!r.ok) throw new Error(`IAM token request failed: ${r.status}`);
  return (await r.json()).access_token;
}

async function granite(messages, {jsonMode=true, maxTokens=1400}={}) {
  if (!WATSONX_PROJECT_ID || !WATSONX_API_KEY) return { available:false, reason:'Watsonx credentials are not configured.' };
  const token = await getIamToken();
  const url = `${WATSONX_URL}/ml/v1/text/chat?version=${encodeURIComponent(WATSONX_API_VERSION)}`;
  const body = {messages, project_id:WATSONX_PROJECT_ID, model_id:WATSONX_MODEL_ID, max_completion_tokens:maxTokens, temperature:0.1};
  if (jsonMode) body.response_format = {type:'json_object'};
  const r = await fetch(url, {method:'POST', headers:{Accept:'application/json','Content-Type':'application/json',Authorization:`Bearer ${token}`}, body:JSON.stringify(body)});
  const text = await r.text();
  if (!r.ok) throw new Error(`watsonx inference failed: ${r.status} ${text.slice(0,300)}`);
  const d = JSON.parse(text);
  const content = d.results?.[0]?.generated_text || d.choices?.[0]?.message?.content || '';
  return {available:true, content, raw:d};
}

function createDemoTwin() {
  return {
    generatedAt:new Date().toISOString(),
    project:{name:'Support Pilot', objective:'Launch an AI-assisted support pilot for 3 enterprise customers in 14 days', deadline:'2026-09-27'},
    people:[
      {id:'p1',name:'Maya',role:'Product',capacity:0.72,load:0.68,source:'jira+calendar'},
      {id:'p2',name:'Alex',role:'Architecture',capacity:0.86,load:0.92,source:'github+jira'},
      {id:'p3',name:'Sam',role:'Engineering',capacity:0.81,load:0.74,source:'github+jira'},
      {id:'p4',name:'Nora',role:'Security',capacity:0.61,load:0.88,source:'jira+calendar'}
    ],
    tasks:[
      {id:'T1',title:'Customer research',owner:'Maya',days:2,status:'done',risk:'low',sources:['jira','slack'],evidence:'Jira PROJ-101 + 6 Slack mentions'},
      {id:'T2',title:'Architecture decision',owner:'Alex',days:2,status:'active',risk:'medium',sources:['github','jira','slack'],evidence:'PR #42 + PROJ-104 + decision thread'},
      {id:'T3',title:'Prototype core flow',owner:'Sam',days:4,status:'queued',risk:'medium',sources:['github','jira'],evidence:'8 commits + PROJ-107'},
      {id:'T4',title:'Security review',owner:'Nora',days:2,status:'blocked',risk:'high',sources:['jira','calendar','slack'],evidence:'PROJ-109 + review meeting conflict'},
      {id:'T5',title:'Pilot launch',owner:'Maya',days:3,status:'queued',risk:'high',sources:['jira','calendar'],evidence:'PROJ-112 + launch calendar event'}
    ],
    dependencies:[
      {from:'T2',to:'T3',type:'blocks'},
      {from:'T2',to:'T4',type:'blocks'},
      {from:'T3',to:'T5',type:'blocks'},
      {from:'T4',to:'T5',type:'blocks'}
    ],
    signals:[
      {source:'Slack',text:'Nora cannot make the Thursday security slot; can we move review earlier?',risk:'capacity conflict',time:'10m ago'},
      {source:'GitHub',text:'PR #42 is waiting on architecture decision before merge.',risk:'dependency',time:'22m ago'},
      {source:'Jira',text:'PROJ-109 security review is blocked by scheduling.',risk:'blocker',time:'41m ago'},
      {source:'Calendar',text:'Alex has two overlapping architecture meetings tomorrow.',risk:'overload',time:'1h ago'}
    ],
    events:[
      {title:'Architecture review',owner:'Alex',start:'2026-09-15T10:00:00Z',source:'calendar'},
      {title:'Security review',owner:'Nora',start:'2026-09-16T14:00:00Z',source:'calendar'},
      {title:'Pilot launch',owner:'Maya',start:'2026-09-27T09:00:00Z',source:'calendar'}
    ],
    commits:[
      {sha:'a91f2d',message:'prototype: add support flow',author:'Sam',date:'today',source:'github'},
      {sha:'7c11aa',message:'docs: architecture decision pending',author:'Alex',date:'today',source:'github'},
      {sha:'2e9f44',message:'test: add pilot acceptance path',author:'Sam',date:'yesterday',source:'github'}
    ],
    issues:[
      {key:'PROJ-109',summary:'Security review scheduling conflict',status:'Blocked',priority:'High',assignee:'Nora',source:'jira'},
      {key:'PROJ-104',summary:'Finalize architecture decision',status:'In Progress',priority:'High',assignee:'Alex',source:'jira'},
      {key:'PROJ-107',summary:'Prototype core support flow',status:'To Do',priority:'Medium',assignee:'Sam',source:'jira'}
    ],
    sourceStatus:JSON.parse(JSON.stringify(demoSources))
  };
}

function authHeaders(token) { return token ? {Authorization:`Bearer ${token}`,Accept:'application/json'} : {Accept:'application/json'}; }
async function getJson(url, options={}) {
  const r = await fetch(url, options);
  const text = await r.text();
  if (!r.ok) throw new Error(`${r.status}: ${text.slice(0,240)}`);
  return text ? JSON.parse(text) : {};
}

async function fetchGitHub() {
  const repo = process.env.GITHUB_REPO;
  if (!repo) return {mode:'demo', ...demoSources.github};
  const token = process.env.GITHUB_TOKEN;
  const headers = authHeaders(token);
  const [commits,prs,issues] = await Promise.all([
    getJson(`https://api.github.com/repos/${repo}/commits?per_page=20`,{headers}),
    getJson(`https://api.github.com/repos/${repo}/pulls?state=open&per_page=10`,{headers}),
    getJson(`https://api.github.com/repos/${repo}/issues?state=open&per_page=20`,{headers})
  ]);
  return {mode:'live',label:'GitHub',connected:true,lastSync:new Date().toISOString(),count:commits.length+prs.length+issues.length,commits,prs,issues};
}

async function fetchJira() {
  const base=(process.env.JIRA_BASE_URL||'').replace(/\/$/,'');
  if (!base || !process.env.JIRA_EMAIL || !process.env.JIRA_API_TOKEN) return {mode:'demo', ...demoSources.jira};
  const auth=Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString('base64');
  const project=process.env.JIRA_PROJECT_KEY || '';
  const jql=encodeURIComponent(project?`project=${project} ORDER BY updated DESC`:'ORDER BY updated DESC');
  const data=await getJson(`${base}/rest/api/3/search/jql?jql=${jql}&maxResults=30`,{headers:{Authorization:`Basic ${auth}`,Accept:'application/json'}});
  return {mode:'live',label:'Jira',connected:true,lastSync:new Date().toISOString(),count:data.issues?.length||0,issues:data.issues||[]};
}

async function fetchSlack() {
  if (!process.env.SLACK_BOT_TOKEN) return {mode:'demo', ...demoSources.slack};
  const token=process.env.SLACK_BOT_TOKEN;
  const data=await getJson('https://slack.com/api/search.messages?query=after:2026-01-01&count=100',{headers:{Authorization:`Bearer ${token}`}});
  if (!data.ok) throw new Error(data.error||'Slack API error');
  return {mode:'live',label:'Slack',connected:true,lastSync:new Date().toISOString(),count:data.messages?.matches?.length||0,messages:data.messages?.matches||[]};
}

async function fetchCalendar() {
  if (!process.env.GOOGLE_CALENDAR_ACCESS_TOKEN) return {mode:'demo', ...demoSources.calendar};
  const now=new Date();
  const end=new Date(now.getTime()+14*86400000);
  const qs=new URLSearchParams({timeMin:now.toISOString(),timeMax:end.toISOString(),singleEvents:'true',orderBy:'startTime',maxResults:'50'});
  const data=await getJson(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${qs}`,{headers:{Authorization:`Bearer ${process.env.GOOGLE_CALENDAR_ACCESS_TOKEN}`} });
  return {mode:'live',label:'Calendar',connected:true,lastSync:new Date().toISOString(),count:data.items?.length||0,events:data.items||[]};
}

function buildTwin(github,jira,slack,calendar) {
  const base=createDemoTwin();
  const live=github.mode==='live'||jira.mode==='live'||slack.mode==='live'||calendar.mode==='live';
  base.sourceStatus={github,jira,slack,calendar};
  base.generatedAt=new Date().toISOString();
  if (github.mode==='live') {
    base.commits=github.commits.slice(0,12).map(c=>({sha:c.sha.slice(0,6),message:c.commit?.message?.split('\n')[0]||'',author:c.author?.login||c.commit?.author?.name||'unknown',date:c.commit?.author?.date||'',source:'github'}));
    base.issues.push(...(github.issues||[]).filter(x=>!x.pull_request).slice(0,5).map(x=>({key:`GH-${x.number}`,summary:x.title,status:x.state,priority:'-',assignee:x.assignee?.login||'unassigned',source:'github'})));
  }
  if (jira.mode==='live') {
    base.issues=jira.issues.slice(0,12).map(i=>({key:i.key,summary:i.fields?.summary||'',status:i.fields?.status?.name||'',priority:i.fields?.priority?.name||'',assignee:i.fields?.assignee?.displayName||'unassigned',source:'jira'}));
    const blocked=base.issues.filter(i=>/block|blocked/i.test(i.status)||/block|blocked/i.test(i.summary));
    if(blocked.length) base.signals.unshift({source:'Jira',text:`${blocked[0].key}: ${blocked[0].summary}`,risk:'blocker',time:'live'});
  }
  if (slack.mode==='live') {
    base.signals=slack.messages.slice(0,8).map(m=>({source:'Slack',text:m.text||'',risk:/blocked|cannot|delay|risk|urgent/i.test(m.text||'')?'risk signal':'context',time:m.ts||'live'}));
  }
  if (calendar.mode==='live') {
    base.events=calendar.events.slice(0,12).map(e=>({title:e.summary||'Untitled event',owner:e.organizer?.displayName||'calendar',start:e.start?.dateTime||e.start?.date||'',source:'calendar'}));
  }
  if (live) {
    const names=new Set(base.people.map(p=>p.name));
    for (const c of base.commits) if(c.author && !names.has(c.author)) { base.people.push({id:`p-${c.author}`,name:c.author,role:'Engineering',capacity:.8,load:.7,source:'github'}); names.add(c.author); }
  }
  base.liveSources=live;
  return base;
}

async function syncSources() {
  const [github,jira,slack,calendar]=await Promise.allSettled([fetchGitHub(),fetchJira(),fetchSlack(),fetchCalendar()]);
  const result={github:github.status==='fulfilled'?github.value:{...demoSources.github,error:github.reason?.message},jira:jira.status==='fulfilled'?jira.value:{...demoSources.jira,error:jira.reason?.message},slack:slack.status==='fulfilled'?slack.value:{...demoSources.slack,error:slack.reason?.message},calendar:calendar.status==='fulfilled'?calendar.value:{...demoSources.calendar,error:calendar.reason?.message}};
  twin=buildTwin(result.github,result.jira,result.slack,result.calendar);
  lastSync=new Date().toISOString();
  if (WATSONX_PROJECT_ID && WATSONX_API_KEY) {
    try {
      const r=await granite([
        {role:'system',content:'You are ORCHESTRA. Analyze normalized organizational evidence and return JSON with project_summary, emerging_risk, critical_path, suggested_focus. Do not invent facts; only use supplied evidence.'},
        {role:'user',content:JSON.stringify({project:twin.project,issues:twin.issues.slice(0,12),signals:twin.signals.slice(0,8),commits:twin.commits.slice(0,8),events:twin.events.slice(0,8)})}
      ],{maxTokens:800});
      twin.aiSummary=JSON.parse(r.content.replace(/^```json\s*|\s*```$/g,''));
      twin.aiMode='granite';
    } catch { twin.aiMode='fallback'; }
  } else twin.aiMode='deterministic';
  return twin;
}

function parseScenario(text='') {
  const t=text.toLowerCase();
  if (/20\s*%.*capacity|capacity.*20\s*%|lose.*capacity/.test(t)) return 'capacity_loss_20';
  if (/10\s*day|deadline.*10|in 10 days/.test(t)) return 'deadline_10';
  if (/alex.*unavailable|critical engineer|engineer.*unavailable|lose.*engineer/.test(t)) return 'engineer_unavailable';
  return 'baseline';
}
function simulate(key) {
  const s=scenarioDefinitions[key]||scenarioDefinitions.baseline;
  const recommendation=key==='capacity_loss_20'?'Parallelize Prototype and Security Review; remove one non-critical prototype slice.':key==='deadline_10'?'Protect Security Review and defer advanced analytics to preserve the day-10 launch.':key==='engineer_unavailable'?"Pair Sam with Alex's architecture work immediately to remove the single-person dependency.":'Prioritize Security Review and keep the architecture decision on the critical path.';
  return {...s,recommendation};
}
async function handleWhatIf(payload) {
  const prompt=payload.prompt||'';
  let key=parseScenario(prompt); let interpretation=scenarioDefinitions[key].label; let ai={available:false,mode:'deterministic'};
  if(WATSONX_PROJECT_ID&&WATSONX_API_KEY){
    try { const r=await granite([{role:'system',content:'Convert a natural-language what-if request into exactly one scenario key: baseline, capacity_loss_20, deadline_10, engineer_unavailable. Return JSON with scenario_key and interpretation.'},{role:'user',content:`Current Digital Twin: ${JSON.stringify({project:twin.project,people:twin.people,tasks:twin.tasks,signals:twin.signals})}\nRequest: ${prompt}`}]); const p=JSON.parse(r.content.replace(/^```json\s*|\s*```$/g,'')); if(scenarioDefinitions[p.scenario_key]){key=p.scenario_key;interpretation=p.interpretation||scenarioDefinitions[key].label;} ai={available:true,mode:'granite',model:WATSONX_MODEL_ID}; } catch(e){ai={available:false,mode:'fallback',error:e.message};}
  }
  const result=simulate(key);
  if(ai.available){ try { const r=await granite([{role:'system',content:'You are the ORCHESTRA Decision Agent. Return JSON with headline, explanation, why_now, confidence_note. Explain only from supplied simulation and twin evidence.'},{role:'user',content:JSON.stringify({scenario:interpretation,baseline:scenarioDefinitions.baseline,simulated:result,twin:{signals:twin.signals,tasks:twin.tasks,people:twin.people},objective:twin.project.objective})}]); result.ai=JSON.parse(r.content.replace(/^```json\s*|\s*```$/g,'')); } catch{} }
  return {scenario_key:key,interpretation,result,ai,twinMeta:{liveSources:twin.liveSources,generatedAt:twin.generatedAt}};
}

async function route(req,res){
  if(req.method==='OPTIONS') return json(res,204,{});
  const url=new URL(req.url,`http://${req.headers.host}`);
  if(req.method==='GET'&&url.pathname==='/api/health') return json(res,200,{ok:true,graniteConfigured:Boolean(WATSONX_PROJECT_ID&&WATSONX_API_KEY),model:WATSONX_MODEL_ID,liveSources:twin.liveSources,lastSync});
  if(req.method==='GET'&&url.pathname==='/api/twin') return json(res,200,twin);
  if(req.method==='POST'&&url.pathname==='/api/sync') { try{return json(res,200,await syncSources());}catch(e){return json(res,500,{error:e.message});} }
  if(req.method==='POST'&&url.pathname==='/api/what-if'){let raw='';for await(const c of req)raw+=c;try{return json(res,200,await handleWhatIf(JSON.parse(raw)));}catch(e){return json(res,500,{error:e.message});}}
  return json(res,404,{error:'Not found'});
}

http.createServer(route).listen(PORT,()=>console.log(`ORCHESTRA API listening on http://localhost:${PORT}`));
