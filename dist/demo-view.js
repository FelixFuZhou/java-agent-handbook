import { demos, demoById, scenarioRecipes } from './data/demos.js';
import { demoValidation } from './data/demo-validation.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const list = values => `<ul>${values.map(v=>`<li>${esc(v)}</li>`).join('')}</ul>`;
const names = {connect:'基础接入',core:'核心功能',scenario:'场景应用'};
let catalogCategory='全部', catalogQuery='';
const selections={};
const getSelection=id=>selections[id] ||= {stage:'connect',file:''};
const href=(id,stage='connect')=>`#/lesson/${id}?demo=${stage}`;
export { demos, demoById, scenarioRecipes };

function verification(id) {
  const v=demoValidation[id];
  return `<span class="demo-validation ${v?.compiled?'verified':''}">${v?.compiled?'Java 编译通过':v?'编译检查待通过':'编译状态未记录'}</span><span class="demo-validation">${v?.runtime || '外部服务待按前提联调'}</span>`;
}
function sourceBlock(id,path,prefix='demo') {
  const f=demoById[id]?.files.find(f=>f.path===path);
  if(!f) return '';
  return `<div class="code-block demo-code"><div class="code-head"><span>${esc(f.path)} · ${esc(f.language)}</span><div><a href="demos/${id}/${f.path}" download class="copy-code">下载文件</a><button class="copy-code" data-demo-action="copy" data-id="${id}" data-path="${esc(path)}">复制代码</button></div></div><pre tabindex="0" aria-label="${esc(f.path)} 源码"><code>${esc(f.code)}</code></pre></div>`;
}
function stagePanel(d) {
  const selected=getSelection(d.id);
  const stage=d.stages.find(s=>s.id===selected.stage)||d.stages[0];
  const path=d.files.some(f=>f.path===selected.file)?selected.file:stage.files[0];
  selected.stage=stage.id;selected.file=path;
  return `<div class="demo-stage-intro"><div class="eyebrow">${names[stage.id]} / ${esc(d.id)}</div><h3>${esc(stage.title)}</h3><p>${esc(stage.description)}</p></div><div class="demo-focus"><strong>读代码时关注</strong>${list(stage.focus)}</div><div class="demo-source-picker"><label for="source-${d.id}">本阶段源码</label><select id="source-${d.id}" data-demo-file="${d.id}" aria-label="选择 ${esc(d.title)} 的源码文件">${[...stage.files,...d.files.map(f=>f.path).filter(p=>!stage.files.includes(p))].map(p=>`<option value="${esc(p)}" ${p===path?'selected':''}>${stage.files.includes(p)?'':'· '}${esc(p)}</option>`).join('')}</select></div><div id="source-view-${d.id}">${sourceBlock(d.id,path)}</div><div class="demo-command"><h4>运行步骤</h4><p>下载并解压项目，在项目根目录打开终端。先按环境配置准备服务；必要时按 01 → 02 → 03 顺序执行。</p><div class="code-block"><div class="code-head"><span>终端命令 · ${names[stage.id]}</span><button class="copy-code" data-demo-action="commands" data-id="${d.id}">复制命令</button></div><pre><code>${esc(stage.commands.join('\n\n'))}</code></pre></div></div><div class="demo-results"><section><h4>应该看到什么</h4>${list(stage.expected)}</section><section><h4>运行不符合预期时</h4>${list(stage.troubleshooting)}</section></div>`;
}
export function renderDemoSection(id, stage='') {
  const d=demoById[id];if(!d)return '';
  if(names[stage]){getSelection(id).stage=stage;getSelection(id).file='';}
  const selected=getSelection(id);
  return `<section class="lesson-block demo-lab" id="demos"><div class="demo-heading"><div><div class="eyebrow">READ THE CODE · RUN THE CODE</div><h2>从接入到场景的三层 Demo</h2></div><a class="button small" href="demos/${id}.zip" download>下载完整项目 ↓</a></div><p>${esc(d.summary)}</p><div class="demo-scenario"><strong>贯穿场景</strong><span>${esc(d.scenario)}</span></div><div class="demo-verifications">${verification(id)}</div><details class="demo-setup"><summary>运行前先看：依赖、环境变量与配置 <span>展开查看</span></summary><div class="demo-setup-body">${list(d.prerequisites)}${d.environment.length?`<div class="table-scroll"><table class="decision-table"><thead><tr><th>环境变量</th><th>填写示例</th><th>用途</th></tr></thead><tbody>${d.environment.map(e=>`<tr><td><code>${esc(e.name)}</code></td><td><code>${esc(e.example || '（留空）')}</code></td><td>${esc(e.description)}</td></tr>`).join('')}</tbody></table></div>`:''}<p>Java 项目使用 JDK 17+。下载包含 pom.xml、全部源码和 README；配置环境变量后在本机终端执行。本站只展示代码，不从浏览器调用中间件。</p></div></details><div class="demo-tabs" role="group" aria-label="${esc(d.title)} 示例阶段">${d.stages.map((s,i)=>`<button class="demo-tab ${selected.stage===s.id?'active':''}" data-demo-action="stage" data-id="${id}" data-stage="${s.id}" aria-pressed="${selected.stage===s.id}"><span>0${i+1}</span>${names[s.id]}</button>`).join('')}</div><div class="demo-stage-panel" id="demo-panel-${id}">${stagePanel(d)}</div><div class="demo-sources"><strong>本示例 API 资料</strong><div class="source-list">${d.sources.map(s=>`<a class="source-link" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.label)} ↗</a>`).join('')}</div></div><p class="demo-reading-note">编译通过只确认 Java 语法与依赖 API；连接服务、权限、模型响应和分布式故障恢复仍需在对应环境验证。文中的教学数据与模拟步骤会单独注明。</p></section>`;
}
export function renderRecipe(id) {
  const r=scenarioRecipes[id];if(!r)return '';
  return `<section class="lesson-block recipe" id="scenario-code"><h2>场景中的中间件核心代码</h2><p>${esc(r.goal)}</p><div class="recipe-boundary">${esc(r.boundary)}</div><div class="recipe-chain">${r.steps.map(s=>`<a href="${href(s.id,'scenario')}">${esc(demoById[s.id]?.id || s.id)}</a>`).join('<span>→</span>')}</div>${r.steps.map((s,i)=>{const d=demoById[s.id];if(!d)return '';const stage=d.stages.find(x=>x.id==='scenario');return `<details class="recipe-step" ${i===0?'open':''}><summary><strong>${esc(s.role)}</strong><span>${esc(d.id)} ＋</span></summary><div class="recipe-body"><p>${esc(s.join)}</p><div class="demo-focus"><strong>组件负责什么</strong><p>${esc(stage.description)}</p></div>${sourceBlock(d.id,stage.files[0],'recipe')}<a class="button small" href="${href(d.id,'scenario')}">查看依赖、配套类和运行步骤 →</a></div></details>`}).join('')}</section>`;
}
export function renderDemoCatalog(lessons) {
  return `<div class="page-intro"><div class="eyebrow">THE PRACTICAL CODE COMPANION</div><h1>实战代码库</h1><p>每个组件都从一次连接开始，走到核心能力，再放进 Agent 场景。先读说明和关键代码，需要验证时再下载独立项目运行。</p></div><div class="demo-catalog-banner"><div><strong>${demos.length} 个项目 · ${demos.reduce((n,d)=>n+d.stages.length,0)} 个分层 Demo</strong><span>基础接入 → 核心功能 → 场景应用</span></div><a class="button primary" href="demos/agent-middleware-demos.zip" download>下载全部项目 ↓</a></div><div class="toolbar"><div class="filters">${['全部','存储','检索','执行','治理','工程'].map(c=>`<button class="filter ${c===catalogCategory?'active':''}" data-demo-action="filter" data-category="${c}" aria-pressed="${c===catalogCategory}">${c}</button>`).join('')}</div><input class="inline-search" type="search" id="demo-search" value="${esc(catalogQuery)}" placeholder="搜索组件、功能或源码…" aria-label="搜索实战代码"></div><div id="demo-catalog-results">${catalogResults(lessons)}</div>`;
}
function catalogResults(lessons) {
  const query=catalogQuery.trim().toLowerCase();
  const found=demos.filter(d=>(catalogCategory==='全部'||lessons[d.id]?.category===catalogCategory)&&`${d.title} ${d.summary} ${d.scenario} ${d.stages.map(s=>s.focus.join(' ')).join(' ')} ${d.files.map(f=>f.code).join(' ')}`.toLowerCase().includes(query));
  return `<p class="qa-count">${found.length} 个项目 · 源码和下载包随静态网站一起提供</p><div class="demo-catalog-grid">${found.map(d=>`<article class="demo-project-card"><div class="tags"><span class="tag">${esc(lessons[d.id]?.category)}</span><span class="tag neutral">3 层 Demo</span></div><h2>${esc(lessons[d.id]?.title||d.title)}</h2><div class="demo-implementation">${esc(d.title)}</div><p>${esc(d.scenario)}</p><div class="demo-card-focus">${d.stages[1].focus.slice(0,2).map(v=>`<span>${esc(v)}</span>`).join('')}</div><div class="demo-card-links">${d.stages.map(s=>`<a href="${href(d.id,s.id)}">${names[s.id]} →</a>`).join('')}</div></article>`).join('')}</div>${!found.length?'<div class="empty">没有匹配的项目，请换个关键词。</div>':''}`;
}
export function demoSearchText(id) { const d=demoById[id];return d?JSON.stringify(d).toLowerCase():''; }

export function bindDemoEvents({lessons,copyText}) {
  document.addEventListener('click',async e=>{
    const el=e.target.closest('[data-demo-action]');if(!el)return;
    const {demoAction:action,id}=el.dataset;
    if(action==='stage') {
      const d=demoById[id];const s=getSelection(id);s.stage=el.dataset.stage;s.file='';
      document.getElementById(`demo-panel-${id}`).innerHTML=stagePanel(d);
      document.querySelectorAll(`[data-demo-action="stage"][data-id="${id}"]`).forEach(b=>{b.classList.toggle('active',b===el);b.setAttribute('aria-pressed',b===el)});
      history.replaceState(null,'',href(id,s.stage));
    } else if(action==='copy') {
      const f=demoById[id]?.files.find(f=>f.path===el.dataset.path);if(f)await copyText(f.code);
    } else if(action==='commands') {
      const s=demoById[id].stages.find(s=>s.id===getSelection(id).stage);await copyText(s.commands.join('\n\n'));
    } else if(action==='filter') {
      catalogCategory=el.dataset.category;
      document.querySelectorAll('[data-demo-action="filter"]').forEach(b=>{b.classList.toggle('active',b===el);b.setAttribute('aria-pressed',b===el)});
      document.getElementById('demo-catalog-results').innerHTML=catalogResults(lessons);
    }
  });
  document.addEventListener('change',e=>{
    const id=e.target.dataset.demoFile;if(!id)return;
    const path=e.target.value;getSelection(id).file=path;
    document.getElementById(`source-view-${id}`).innerHTML=sourceBlock(id,path);
  });
  document.addEventListener('input',e=>{if(e.target.id==='demo-search'){catalogQuery=e.target.value;document.getElementById('demo-catalog-results').innerHTML=catalogResults(lessons);}});
}
