var N=Object.defineProperty;var B=(s,e,t)=>e in s?N(s,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):s[e]=t;var c=(s,e,t)=>B(s,typeof e!="symbol"?e+"":e,t);(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const a of document.querySelectorAll('link[rel="modulepreload"]'))n(a);new MutationObserver(a=>{for(const r of a)if(r.type==="childList")for(const l of r.addedNodes)l.tagName==="LINK"&&l.rel==="modulepreload"&&n(l)}).observe(document,{childList:!0,subtree:!0});function t(a){const r={};return a.integrity&&(r.integrity=a.integrity),a.referrerPolicy&&(r.referrerPolicy=a.referrerPolicy),a.crossOrigin==="use-credentials"?r.credentials="include":a.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function n(a){if(a.ep)return;a.ep=!0;const r=t(a);fetch(a.href,r)}})();let m=null;function O(){return m||(m=document.createElement("div"),m.setAttribute("role","status"),m.setAttribute("aria-live","polite"),m.className="sr-only",document.body.appendChild(m)),m}function P(){O()}function $(s){const e=O();e.textContent="",window.setTimeout(()=>{e.textContent=s},30)}class S extends Error{constructor(t,n){super(n);c(this,"status");this.status=t}}async function f(s,e){let t;try{t=await fetch(s,e)}catch{throw new S(0,"The relay server isn't responding. Is debate-web still running?")}if(!t.ok){let n=`Request failed (${t.status})`;try{const a=await t.json();typeof a.detail=="string"&&(n=a.detail)}catch{}throw new S(t.status,n)}return t.json()}function F(){return f("/api/overview")}function U(s){return f(`/api/debates/${encodeURIComponent(s)}`)}function G(s,e,t){return f("/api/debates",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({debate_id:s,topic:e,first_speaker:t})})}function J(){return f("/api/bridge/start",{method:"POST"})}function Z(s,e){return f(`/api/agents/${encodeURIComponent(s)}/launch`,{method:"POST",headers:e?{"Content-Type":"application/json"}:void 0,body:e?JSON.stringify({model:e}):void 0})}function K(s){return f(`/api/debates/${encodeURIComponent(s)}/kickoff`,{method:"POST"})}function z(s,e){return f(`/api/debates/${encodeURIComponent(s)}/interject`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({content:e})})}function V(s){const e=new EventSource("/api/events"),t=n=>{try{const a=JSON.parse(n.data);a.bridge&&s.onBridge(a.bridge)}catch{}};return e.addEventListener("change",n=>{s.onConnection("live"),t(n),s.onChange()}),e.addEventListener("heartbeat",n=>{s.onConnection("live"),t(n)}),e.addEventListener("open",()=>s.onConnection("live")),e.addEventListener("error",()=>s.onConnection("reconnecting")),()=>e.close()}function d(s){return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function R(s){const e=new Date(s).getTime();if(Number.isNaN(e))return"";const t=Math.round((Date.now()-e)/1e3);if(t<5)return"just now";if(t<60)return`${t}s ago`;const n=Math.floor(t/60);if(n<60)return`${n}m ago`;const a=Math.floor(n/60);if(a<24)return`${a}h ago`;const r=Math.floor(a/24);return r<7?`${r}d ago`:new Date(s).toLocaleDateString(void 0,{month:"short",day:"numeric"})}function W(s){const e=new Date(s);return Number.isNaN(e.getTime())?s:e.toLocaleString()}function v(s,e=""){return`<span class="${e}" data-ts="${d(s)}" title="${d(W(s))}">${d(R(s))}</span>`}function M(s){s.querySelectorAll("[data-ts]").forEach(e=>{const t=e.dataset.ts;t&&(e.textContent=R(t))})}function k(s){const e=s.replace(/\r\n/g,`
`).split(/```([^\n]*)\n?/);let t="";for(let n=0;n<e.length;n+=1)n%3===2?t+=`<pre><code>${d(e[n].replace(/\n$/,""))}</code></pre>`:n%3===0&&(t+=X(e[n]));return t}function w(s){let e=d(s);const t=[];return e=e.replace(/`([^`\n]+)`/g,(n,a)=>(t.push(`<code>${a}</code>`),`\0${t.length-1}\0`)),e=e.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'),e=e.replace(/\*\*([^*\n]+)\*\*/g,"<strong>$1</strong>").replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g,"$1<em>$2</em>").replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,;:!?]|$)/g,"$1<em>$2</em>"),e.replace(/\u0000(\d+)\u0000/g,(n,a)=>t[Number(a)])}function X(s){var t;let e="";for(const n of s.split(/\n{2,}/)){const a=n.split(`
`).filter(r=>r.trim()!=="");if(a.length!==0)if(a.length===1&&/^#{1,6}\s+/.test(a[0]))e+=`<p><strong>${w(a[0].replace(/^#{1,6}\s+/,""))}</strong></p>`;else if(a.every(r=>/^\s*[-*]\s+/.test(r))){const r=a.map(l=>`<li>${w(l.replace(/^\s*[-*]\s+/,""))}</li>`).join("");e+=`<ul>${r}</ul>`}else if(a.every(r=>/^\s*\d+[.)]\s+/.test(r))){const r=Number(((t=a[0].match(/^\s*(\d+)/))==null?void 0:t[1])??"1"),l=a.map(o=>`<li>${w(o.replace(/^\s*\d+[.)]\s+/,""))}</li>`).join("");e+=`<ol${r!==1?` start="${r}"`:""}>${l}</ol>`}else e+=`<p>${a.map(w).join("<br>")}</p>`}return e}const Y=typeof navigator<"u"&&/Mac|iPhone|iPad/.test(navigator.platform),Q=new Set(["the","a","an","is","are","of","for","to","in","and","or"]);function ee(s){const e=s.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").split("-").filter(Boolean).slice(0,5);for(;e.length>2&&Q.has(e[e.length-1]);)e.pop();return e.join("-").slice(0,40)}function te(s){const e=s.trim(),t=e.match(/^.*?[.!?](?=\s|$)/);return(t?t[0]:e).trim()}function q(s){return s.trim().replace(/[\s;,]+$/,"")}function D(s){const e=s.replace(/\s+/g," ").trim(),t=e.match(/\b(?:common ground|consensus|shared conclusion|conclusion)\b\s*[:—-]\s*(.+)/i);if(t){const r=t[1].split(/\s*[;.]\s+(?=remaining (?:differences|disagreement)\b|key assumptions\b|remaining\b|differences\b)/i)[0];return q(r)}const n=e.match(/\(1\)\s*(.+?)(?=\s*\(2\)|$)/);if(n)return q(n[1].replace(/^[A-Z][A-Z0-9 /,-]{2,}?:\s*/,""));const a=e.replace(/^(?:agreement|agreed|consensus|both agents? agree|we agree)[^.:]*[.:]\s*/i,"");return q(te(a||e))}function p(s){return s==="claude"?"Claude":s==="codex"?"Codex":s==="moderator"?"Moderator":s}const g=new Map;function I(s){const e=window.setTimeout(()=>g.delete(s),15e3),t=g.get(s);t&&window.clearTimeout(t),g.set(s,e)}function x(s){const e=g.get(s);e&&window.clearTimeout(e),g.delete(s)}const se={claude:["opus","sonnet","haiku"],codex:["gpt-5.2-codex","gpt-5-codex","gpt-5.1-codex-mini"]};function C(s,e="Launch terminal"){if(g.has(s))return`<button class="btn btn--ghost btn--sm" type="button" data-launch="${s}" disabled>Opened &mdash; registering&hellip;</button>`;const t=`models-${s}`,n=se[s].map(a=>`<option value="${a}"></option>`).join("");return`
    <span class="launch-control">
      <input class="model-input" type="text" list="${t}" data-model="${s}"
        placeholder="default model" aria-label="${p(s)} model"
        autocomplete="off" spellcheck="false" />
      <datalist id="${t}">${n}</datalist>
      <button class="btn btn--ghost btn--sm" type="button" data-launch="${s}">${e}</button>
    </span>`}function _(s="Start bridge"){return g.has("bridge")?'<button class="btn btn--ghost btn--sm" type="button" data-start-bridge disabled>Starting&hellip;</button>':`<button class="btn btn--ghost btn--sm" type="button" data-start-bridge>${s}</button>`}function E(s,e){const t=s[e];return t?t.running?`${t.app} &middot; ${(t.tty??"").replace("/dev/","")}`:t.registered?`${t.app} tab registered &middot; agent not running`:"not launched":""}function ne(s,e){const t=[];for(const n of["claude","codex"]){const a=s[n];if(a){if(a.running){x(n);continue}t.push(`
      <div class="system-unit">
        <span class="system-name"><span class="dot dot--${n}"></span>${p(n)}</span>
        <span class="system-state">${E(s,n)}</span>
        ${C(n)}
      </div>`)}}return e.running?x("bridge"):t.push(`
      <div class="system-unit">
        <span class="system-name"><span class="dot" style="background: var(--danger)"></span>Bridge</span>
        <span class="system-state">stopped &middot; messages queue until it runs</span>
        ${_()}
      </div>`),t.length===0?"":`
    <section class="system-strip" aria-label="System status">
      ${t.join("")}
      <span class="form-error" role="alert" data-system-error></span>
    </section>`}function L(s){const e=t=>{var n;return((n=t.closest("[aria-label], .rail, .empty"))==null?void 0:n.querySelector("[data-system-error]"))??s.querySelector("[data-system-error]")};s.querySelectorAll("[data-launch]").forEach(t=>{t.addEventListener("click",async()=>{var o;const n=t.dataset.launch,a=(o=t.closest(".launch-control"))==null?void 0:o.querySelector("[data-model]"),r=(a==null?void 0:a.value.trim())||void 0,l=t.textContent??"Launch terminal";t.disabled=!0,t.textContent="Opening…",I(n);try{await Z(n,r),t.textContent="Opened — registering…"}catch(i){x(n),t.disabled=!1,t.textContent=l;const u=e(t);u&&(u.textContent=i instanceof Error?i.message:"Launch failed.")}})}),s.querySelectorAll("[data-start-bridge]").forEach(t=>{t.addEventListener("click",async()=>{t.disabled=!0,t.textContent="Starting…",I("bridge");try{await J()}catch(n){x("bridge"),t.disabled=!1,t.textContent="Start bridge";const a=e(t);a&&(a.textContent=n instanceof Error?n.message:"Couldn't start the bridge.")}})})}function ae(s,e){return`${s==="claude"?"Use the debate-peer skill.":"Use $debate-peer."} Join debate ${e}. Choose your own position and continue until you agree or explicitly agree to disagree.`}class re{constructor(e,t){c(this,"root");c(this,"debateId");c(this,"data",null);c(this,"lastMaxId",0);c(this,"firstRender",!0);c(this,"optimistic",null);c(this,"composerError","");c(this,"notFound",!1);c(this,"renderedDelivered",new Map);c(this,"optimisticEl",null);c(this,"announcedMaxId",null);c(this,"announcedResolutionId",null);c(this,"announcedStatus",null);this.root=e,this.debateId=t,this.root.innerHTML=`
      <div class="room">
        <div class="transcript-col">
          <header class="room-head">
            <h1 data-topic tabindex="-1"><span class="skeleton" style="display:inline-block;width:18ch;height:1.2em"></span></h1>
            <div class="room-sub" data-sub></div>
          </header>
          <div class="transcript" data-transcript>
            <div class="transcript-part" data-messages></div>
            <div class="transcript-part" data-tail></div>
          </div>
          <div class="composer-wrap" data-composer-wrap hidden></div>
        </div>
        <aside class="rail" data-rail aria-label="Debate state"></aside>
      </div>`}focusHeading(){var e;(e=this.root.querySelector("[data-topic]"))==null||e.focus({preventScroll:!0})}async refresh(){try{this.data=await U(this.debateId)}catch(e){e instanceof S&&e.status===404&&(this.notFound=!0,this.renderNotFound());return}this.notFound||(this.optimistic&&this.data.messages.some(e=>e.sender==="moderator"&&e.content===this.optimistic.content)&&(this.optimistic=null),this.announceChanges(),this.render())}announceChanges(){var r;if(!this.data)return;const{debate:e,messages:t}=this.data,n=t.reduce((l,o)=>Math.max(l,o.id),0),a=((r=e.pending_resolution)==null?void 0:r.id)??null;if(this.announcedMaxId===null){this.announcedMaxId=n,this.announcedResolutionId=a,this.announcedStatus=e.status;return}for(const l of t)l.id>this.announcedMaxId&&l.sender!=="moderator"&&$(`${p(l.sender)} replied`);if(this.announcedMaxId=n,a!==this.announcedResolutionId&&e.pending_resolution){const l=e.pending_resolution,o=l.proposer==="claude"?"Codex":"Claude";$(`Resolution proposed by ${p(l.proposer)}, awaiting ${o}`)}this.announcedResolutionId=a,e.status!==this.announcedStatus&&e.status==="completed"&&$(e.resolution_type==="agreement"?"Agreement reached":"Agreed to disagree"),this.announcedStatus=e.status}renderNotFound(){this.root.innerHTML=`
      <div class="overview">
        <section class="empty">
          <h2>Debate not found</h2>
          <p>No debate named <code>${d(this.debateId)}</code> exists in the relay.</p>
          <p style="margin-top: var(--s4)"><a href="#/">Back to debates</a></p>
        </section>
      </div>`}nearBottom(){return window.innerHeight+window.scrollY>=document.body.scrollHeight-200}render(){var o;if(!this.data)return;const{debate:e}=this.data,t=this.nearBottom(),n=this.root.querySelector("[data-topic]");n.textContent!==e.topic&&(n.textContent=e.topic);const a=`${e.topic} — Debate Control Room`;document.title!==a&&(document.title=a),this.root.querySelector("[data-sub]").innerHTML=[`<span>${d(e.id)}</span>`,`<span>opened ${v(e.created_at)}</span>`,e.status==="completed"?`<span class="pill pill--done">${e.resolution_type==="agreement"?"Agreement":"Agreed to disagree"}</span>`:""].filter(Boolean).join(""),this.renderTranscript(),this.renderRail(),L(this.root.querySelector("[data-rail]")),this.renderComposer(),M(this.root);const r=(((o=this.data)==null?void 0:o.messages)??[]).reduce((i,u)=>Math.max(i,u.id),0),l=r>this.lastMaxId;this.firstRender?window.scrollTo({top:document.body.scrollHeight}):l&&t?window.scrollTo({top:document.body.scrollHeight,behavior:"smooth"}):l&&this.showNewBelow(),this.lastMaxId=Math.max(this.lastMaxId,r),this.firstRender=!1}messageHtml(e){var h;const t=e.id>this.lastMaxId&&!this.firstRender,n=e.sender,a=n==="moderator"?"msg--moderator":n==="claude"?"msg--claude":"msg--codex",r=e.optimistic?" is-pending":"",l=t?" is-new":"",o=!e.delivered_at&&!e.optimistic&&((h=this.data)==null?void 0:h.debate.status)==="running"?`<span class="msg-delivery" data-delivery>awaiting delivery to ${p(e.recipient)}</span>`:"",i=e.optimistic?'<span class="msg-delivery">sending&hellip;</span>':"",u=e.optimistic?"":v(e.created_at,"msg-time");return`
      <article class="msg ${a}${r}${l}" data-msg-id="${e.optimistic?"optimistic":e.id}">
        <div class="msg-head">
          <h2 class="msg-speaker">${p(n)}</h2>
          ${u}
          ${o}
          ${i}
        </div>
        <div class="msg-body">${k(e.content)}</div>
      </article>`}renderTranscript(){var l,o;if(!this.data)return;const{debate:e}=this.data,t=this.root.querySelector("[data-messages]"),n=Object.keys(e.participants);for(const i of this.data.messages){const u=!!i.delivered_at;this.renderedDelivered.has(i.id)?u&&this.renderedDelivered.get(i.id)===!1&&((l=t.querySelector(`[data-msg-id="${i.id}"] [data-delivery]`))==null||l.remove(),this.renderedDelivered.set(i.id,u)):(t.insertAdjacentHTML("beforeend",this.messageHtml(i)),this.renderedDelivered.set(i.id,u))}this.optimistic&&!this.optimisticEl?(t.insertAdjacentHTML("beforeend",this.messageHtml(this.optimistic)),this.optimisticEl=t.querySelector('[data-msg-id="optimistic"]')):!this.optimistic&&this.optimisticEl&&(this.optimisticEl.remove(),this.optimisticEl=null),e.status!=="running"&&t.querySelectorAll("[data-delivery]").forEach(i=>i.remove());const a=[];if(e.status==="running"&&n.length<2){const i=["claude","codex"],u=b=>{var y;return!!((y=this.data.agents[b])!=null&&y.registered)},h=i.some(u),j=e.current_turn,A=j==="claude"?"codex":"claude",H=i.filter(b=>!u(b));a.push(`
        <div class="awaiting">
          <p><strong>This debate hasn&#8217;t started.</strong></p>
          <p style="margin-top: var(--s2)">Send the opening prompt to both terminals &#8212; ${p(j)} opens, ${p(A)} joins and waits.</p>
          <div class="kickoff-row" style="margin-top: var(--s3)">
            <button class="btn btn--primary" type="button" data-kickoff ${h?"":"disabled"}>Start debate</button>
            ${h?"":"<span>Launch both agents first so their terminals register.</span>"}
          </div>
          <span class="form-error" role="alert" data-kickoff-error></span>
          ${H.map(b=>{const y=ae(b,e.id);return`
            <details style="margin-top: var(--s3)">
              <summary>Or paste into ${p(b)}&#8217;s terminal manually</summary>
              <div class="kickoff-row" style="margin-top: var(--s2)">
                <code>${d(y)}</code>
                <button class="btn btn--ghost btn--sm" type="button" data-copy="${d(y)}">Copy</button>
              </div>
            </details>`}).join("")}
        </div>`)}if(e.pending_resolution&&e.status==="running"){const i=e.pending_resolution,u=i.proposer==="claude"?"Codex":"Claude";a.push(`
        <div class="panel panel--pending">
          <h2 class="panel-title">Resolution proposed &middot; ${i.resolution_type==="agreement"?"agreement":"agree to disagree"}</h2>
          <div class="panel-body">${k(i.summary)}</div>
          <div class="panel-meta">proposed by ${p(i.proposer)} ${v(i.created_at)} &middot; awaiting ${u}</div>
          <div class="panel-meta">The agents decide the resolution &#8212; interject to steer the outcome.</div>
        </div>`)}if(e.status==="completed")a.push(`
        <div class="panel panel--success">
          <h2 class="panel-title">${e.resolution_type==="agreement"?"Agreement reached":"Agreed to disagree"}</h2>
          ${e.resolution_summary?`<div class="panel-body">${k(e.resolution_summary)}</div>`:""}
          <div class="panel-meta">concluded ${v(e.updated_at)}</div>
        </div>`);else if(n.length===2&&!e.pending_resolution){const i=e.current_turn;a.push(`
        <div class="turn-marker">
          <span class="dot dot--${i}"></span>
          ${p(i)} holds the floor
        </div>`)}const r=this.root.querySelector("[data-tail]");r.innerHTML=a.join(""),(o=r.querySelector("[data-kickoff]"))==null||o.addEventListener("click",()=>void this.startDebate()),r.querySelectorAll("[data-copy]").forEach(i=>{i.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(i.dataset.copy??""),i.textContent="Copied ✓",window.setTimeout(()=>{i.textContent="Copy"},1500)}catch{i.textContent="Select and copy manually"}})})}async startDebate(){const e=this.root.querySelector("[data-kickoff]"),t=this.root.querySelector("[data-kickoff-error]");e&&(e.disabled=!0,e.textContent="Sending…"),t&&(t.textContent="");try{const n=await K(this.debateId),a=Object.entries(n.results),r=a.filter(([,o])=>o.injected).map(([o])=>p(o)),l=a.filter(([,o])=>!o.injected);r.length&&$(`Opening prompt sent to ${r.join(" and ")}`),l.length&&t&&(t.textContent=l.map(([o,i])=>`${p(o)}: ${i.reason}`).join(" · ")),await this.refresh()}catch(n){t&&(t.textContent=n instanceof Error?n.message:"Couldn't start the debate."),e&&(e.disabled=!1,e.textContent="Start debate")}}renderRail(){if(!this.data)return;const{debate:e,bridge:t,agents:n}=this.data,a=this.root.querySelector("[data-rail]"),r=[];if(e.status==="running"){const o=e.current_turn,i=Object.keys(e.participants).length===2;r.push(`
        <section class="rail-section">
          <h2 class="rail-label">Floor</h2>
          <span class="rail-turn is-${o}"><span class="dot dot--${o}"></span>${p(o)}${i?"":'<span class="rail-note" style="font-weight: 400">&nbsp;opens</span>'}</span>
          <span class="rail-note">${i?"Interjections are delivered to whoever holds the floor.":"The debate starts once both agents join; interjections queue until then."}</span>
        </section>`)}else r.push(`
        <section class="rail-section">
          <h2 class="rail-label">Outcome</h2>
          <span class="pill pill--done">${e.resolution_type==="agreement"?"Agreement":"Agreed to disagree"}</span>
          ${e.resolution_summary?`<p class="rail-outcome-summary" title="${d(e.resolution_summary)}">${d(D(e.resolution_summary))}</p>`:""}
        </section>`);const l=["claude","codex"].map(o=>{const i=e.participants[o],u=n[o],h=u!=null&&u.running?`<span class="v">${E(n,o)}</span>`:`<span class="v absent">${E(n,o)}</span>
             ${e.status==="running"?C(o):""}`;return`
          <div class="rail-participant">
            <span class="name"><span class="dot dot--${o}"></span>${p(o)}</span>
            <span class="position">${i?d(i):'<span class="absent">hasn&#8217;t joined yet</span>'}</span>
            ${h}
          </div>`}).join("");r.push(`
      <section class="rail-section">
        <h2 class="rail-label">Participants</h2>
        ${l}
      </section>`),r.push(`
      <section class="rail-section">
        <h2 class="rail-label">Bridge</h2>
        ${t.running?`<div class="rail-kv"><span>relay daemon</span><span class="v">running &middot; pid ${t.pid}</span></div>`:`<div class="rail-kv"><span style="color: var(--danger)">stopped</span></div>
               <span class="rail-note">Messages stay queued until it runs.</span>
               ${e.status==="running"?_():""}`}
        <span class="form-error" role="alert" data-system-error></span>
      </section>`),r.push(`
      <section class="rail-section">
        <h2 class="rail-label">Debate</h2>
        <div class="rail-kv"><span>id</span><span class="v">${d(e.id)}</span></div>
        <div class="rail-kv"><span>messages</span><span class="v">${this.data.messages.length}</span></div>
        <div class="rail-kv"><span>opened</span><span class="v">${v(e.created_at)}</span></div>
        <a class="btn btn--ghost btn--sm" style="margin-top: var(--s3)" href="/api/debates/${encodeURIComponent(e.id)}/transcript.md" download="${d(e.id)}.md">Export transcript (Markdown)</a>
      </section>`),a.innerHTML=r.join("")}renderComposer(){if(!this.data)return;const e=this.root.querySelector("[data-composer-wrap]"),{debate:t}=this.data;if(e.hidden=!1,t.status!=="running"){e.innerHTML='<p class="composer-closed">This debate has concluded &#8212; interjections are closed.</p>';return}let n=e.querySelector("form");if(!n){e.innerHTML=`
        <form class="composer">
          <div class="composer-head">
            <label class="composer-label" for="interject-input">Interject as moderator</label>
            <span class="composer-target" data-target></span>
          </div>
          <div class="composer-row">
            <textarea id="interject-input" rows="1" placeholder="Steer the debate&hellip;"></textarea>
            <button class="btn btn--primary" type="submit" disabled>Interject</button>
          </div>
          <span class="composer-hint">${Y?"<kbd>&#8984;</kbd>":"<kbd>Ctrl</kbd>"}<kbd>&#9166;</kbd> to send</span>
          <span class="form-error" role="alert" data-composer-error></span>
        </form>`,n=e.querySelector("form");const l=n.querySelector("textarea"),o=n.querySelector("button");l.addEventListener("input",()=>{l.style.height="auto",l.style.height=`${Math.min(l.scrollHeight,168)}px`,o.disabled=l.value.trim()===""}),l.addEventListener("keydown",i=>{(i.metaKey||i.ctrlKey)&&i.key==="Enter"&&(i.preventDefault(),n.requestSubmit())}),n.addEventListener("submit",i=>{i.preventDefault(),this.submitInterjection(n)})}const a=e.querySelector("[data-target]");if(a){const l=Object.keys(t.participants).length===2,o=p(t.current_turn);a.innerHTML=l&&this.data.bridge.running?`&rarr; ${o} reads it next`:`&rarr; queued for ${o}`}const r=e.querySelector("[data-composer-error]");r&&(r.textContent=this.composerError)}async submitInterjection(e){if(!this.data)return;const t=e.querySelector("textarea"),n=e.querySelector("button"),a=t.value.trim();if(a){this.composerError="",this.optimistic={id:this.lastMaxId+1e6,debate_id:this.debateId,sender:"moderator",recipient:this.data.debate.current_turn,kind:"interjection",content:a,created_at:new Date().toISOString(),delivered_at:null,optimistic:!0},t.value="",t.style.height="auto",n.disabled=!0,this.render();try{await z(this.debateId,a),await this.refresh()}catch(r){this.optimistic=null,t.value=a,this.composerError=r instanceof Error?r.message:"The interjection didn't reach the relay.",this.render()}finally{n.disabled=t.value.trim()===""}}}showNewBelow(){const e=this.root.querySelector(".transcript-col");if(e.querySelector(".new-below"))return;const t=document.createElement("button");t.type="button",t.className="new-below",t.innerHTML="&darr; New message",t.addEventListener("click",()=>{window.scrollTo({top:document.body.scrollHeight,behavior:"smooth"}),t.remove()});const n=()=>{this.nearBottom()&&(t.remove(),window.removeEventListener("scroll",n))};window.addEventListener("scroll",n,{passive:!0}),e.insertBefore(t,e.querySelector("[data-composer-wrap]"))}}const ie="~/.local/share/claude-codex-debate/venv/bin/debate-bridge register claude && claude",oe="~/.local/share/claude-codex-debate/venv/bin/debate-bridge register codex && codex",le="~/.local/share/claude-codex-debate/venv/bin/debate-bridge start";function ce(s){if(s.status==="completed")return`<span class="pill pill--done">${s.resolution_type==="agreement"?"Agreement":"Agreed to disagree"}</span>`;if(s.pending_resolution)return`<span class="pill pill--waiting"><span class="dot dot--pending"></span>Resolution awaiting ${s.pending_resolution.proposer==="claude"?"Codex":"Claude"}</span>`;const e=Object.keys(s.participants).length;if(e<2)return`<span class="pill pill--waiting"><span class="dot dot--pending"></span>Awaiting ${e===0?"both agents":s.participants.claude?"Codex":"Claude"}</span>`;const t=s.current_turn,n=t==="claude"?"claude":"codex";return`<span class="pill pill--${n}"><span class="dot dot--${n}"></span>${t==="claude"?"Claude":"Codex"}&#8217;s turn</span>`}function de(s){const e=Object.keys(s.participants).length===2?"claude &middot; codex":Object.keys(s.participants).join(" &middot; ")||"no agents yet",t=s.message_count===1?"1 message":`${s.message_count} messages`,n=s.undelivered_count>0?`<span class="mono" style="color: var(--pending)">${s.undelivered_count} undelivered</span>`:"",a=s.status==="completed"&&s.resolution_summary?`<span class="ledger-outcome" title="${d(s.resolution_summary)}">${d(D(s.resolution_summary))}</span>`:"";return`
    <a class="ledger-row" href="#/d/${encodeURIComponent(s.id)}" title="${d(s.topic)}">
      <span class="ledger-topic">${d(s.topic)}</span>
      <span class="ledger-meta">
        <span>${d(s.id)}</span>
        <span>${e}</span>
        <span>${t}</span>
        ${n}
        ${v(s.updated_at)}
      </span>
      ${a}
      <span class="ledger-state">${ce(s)}</span>
    </a>`}function T(s,e,t,n){const a=e?`<span class="empty-done">${t}</span>`:n;return`<div class="empty-step"><span class="empty-step-n">${s}</span><div class="empty-step-body">${a}</div></div>`}function ue(s,e){var t,n;return`
    <section class="empty">
      <h2>No debates yet</h2>
      <p>Open a terminal for each agent, start the bridge, then create a debate here &#8212; the agents join it from their own terminals.</p>
      <div class="empty-steps">
        ${T(1,((t=s.claude)==null?void 0:t.running)??!1,"Claude is running",C("claude","Launch Claude&#8217;s terminal"))}
        ${T(2,((n=s.codex)==null?void 0:n.running)??!1,"Codex is running",C("codex","Launch Codex&#8217;s terminal"))}
        ${T(3,e.running,"Bridge is running",_("Start the bridge"))}
      </div>
      <span class="form-error" role="alert" data-system-error></span>
      <details class="empty-manual">
        <summary>Or run the commands manually</summary>
        <code>${d(ie)}</code>
        <code>${d(oe)}</code>
        <code>${d(le)}</code>
      </details>
    </section>`}class pe{constructor(e){c(this,"root");c(this,"data",null);c(this,"formOpen",!1);c(this,"submitting",!1);this.root=e,this.root.innerHTML=`
      <div class="overview">
        <div class="overview-head">
          <h1 tabindex="-1">Debates</h1>
          <span class="overview-count" data-count></span>
        </div>
        <div data-system></div>
        <button class="create-toggle" type="button" data-create-toggle aria-expanded="false">
          <span aria-hidden="true">+</span> New debate
        </button>
        <div data-form-slot></div>
        <div data-list>
          <div class="ledger" aria-hidden="true">
            <div class="skeleton" style="height: 3.4rem; margin-block: var(--s3)"></div>
            <div class="skeleton" style="height: 3.4rem; margin-block: var(--s3); opacity: 0.7"></div>
            <div class="skeleton" style="height: 3.4rem; margin-block: var(--s3); opacity: 0.4"></div>
          </div>
        </div>
      </div>`,this.root.querySelector("[data-create-toggle]").addEventListener("click",()=>this.toggleForm())}focusHeading(){var e;(e=this.root.querySelector("h1"))==null||e.focus({preventScroll:!0})}async refresh(){try{this.data=await F()}catch{return}this.renderList()}toggleForm(){var t;this.formOpen=!this.formOpen,this.root.querySelector("[data-create-toggle]").setAttribute("aria-expanded",String(this.formOpen)),this.renderForm(),this.formOpen&&((t=this.root.querySelector("[data-topic]"))==null||t.focus())}renderForm(){const e=this.root.querySelector("[data-form-slot]");if(!this.formOpen){e.innerHTML="";return}e.innerHTML=`
      <form class="create-form">
        <div class="form-row">
          <div class="field">
            <label for="new-topic">Topic</label>
            <input id="new-topic" data-topic required placeholder="Should this service use a modular monolith or microservices?" autocomplete="off" />
          </div>
          <div class="field">
            <label for="new-first">Opening speaker</label>
            <select id="new-first" data-first>
              <option value="claude">Claude</option>
              <option value="codex">Codex</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="field">
            <label for="new-id">Debate id</label>
            <input id="new-id" data-id class="mono" required pattern="[A-Za-z0-9._-]+" placeholder="monolith-vs-microservices" autocomplete="off" spellcheck="false" />
            <span class="hint">The agents join with this id; letters, digits, dots, dashes.</span>
          </div>
        </div>
        <div class="create-actions">
          <button class="btn btn--primary" type="submit" data-submit>Create debate</button>
          <button class="btn btn--ghost" type="button" data-cancel>Cancel</button>
          <span class="form-error" role="alert" data-error></span>
        </div>
      </form>`;const t=e.querySelector("form"),n=e.querySelector("[data-topic]"),a=e.querySelector("[data-id]");let r=!1;n.addEventListener("input",()=>{r||(a.value=ee(n.value))}),a.addEventListener("input",()=>{r=a.value.length>0}),e.querySelector("[data-cancel]").addEventListener("click",()=>this.toggleForm()),t.addEventListener("keydown",l=>{var o;l.key==="Escape"&&(l.stopPropagation(),this.toggleForm(),(o=this.root.querySelector("[data-create-toggle]"))==null||o.focus())}),t.addEventListener("submit",l=>{l.preventDefault(),this.submit(t)})}async submit(e){if(this.submitting)return;const t=e.querySelector("[data-topic]").value.trim(),n=e.querySelector("[data-id]").value.trim(),a=e.querySelector("[data-first]").value,r=e.querySelector("[data-submit]"),l=e.querySelector("[data-error]");this.submitting=!0,r.disabled=!0,r.textContent="Creating…",l.textContent="";try{const o=await G(n,t,a);window.location.hash=`#/d/${encodeURIComponent(o.id)}`}catch(o){l.textContent=o instanceof S&&o.status===409?`A debate named ${n} already exists. Pick a different id.`:o instanceof Error?o.message:"Couldn't create the debate.",r.disabled=!1,r.textContent="Create debate"}finally{this.submitting=!1}}renderList(){if(!this.data)return;const e=this.root.querySelector("[data-list]"),t=this.root.querySelector("[data-count]"),n=this.root.querySelector("[data-system]"),a=this.data.debates;if(t.textContent=a.length===0?"":`${a.length} total`,a.length===0){n.innerHTML="",e.innerHTML=ue(this.data.agents,this.data.bridge),L(e);return}n.innerHTML=ne(this.data.agents,this.data.bridge),L(n),e.innerHTML=`<nav class="ledger" aria-label="Debates">${a.map(de).join("")}</nav>`,M(e)}}const he=`
  <svg width="18" height="18" viewBox="0 0 32 32" aria-hidden="true">
    <circle cx="11" cy="16" r="8" fill="var(--claude)" />
    <circle cx="21" cy="16" r="8" fill="var(--codex)" fill-opacity="0.85" />
  </svg>`,me={auto:'<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/><path d="M8 2 A6 6 0 0 1 8 14 Z" fill="currentColor"/></svg>',light:'<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="3.5" stroke="currentColor" stroke-width="1.5"/><path d="M8 0.5v2M8 13.5v2M0.5 8h2M13.5 8h2M2.7 2.7l1.4 1.4M11.9 11.9l1.4 1.4M13.3 2.7l-1.4 1.4M4.1 11.9l-1.4 1.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',dark:'<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M13.5 9.5A6 6 0 0 1 6.5 2.5a6 6 0 1 0 7 7Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>'};class ge{constructor(e){c(this,"outlet");c(this,"banners");c(this,"bridge",null);c(this,"connection","live");c(this,"view",null);c(this,"currentRoute","");c(this,"theme");P(),this.theme=localStorage.getItem("debate-theme")||"auto",e.innerHTML=`
      <header class="topbar">
        <a class="wordmark" href="#/" aria-label="Debate Control Room — all debates">
          ${he}
          <span>Control Room</span>
        </a>
        <a class="back-link" data-back href="#/" hidden>&larr; Debates</a>
        <span class="topbar-topic" data-topbar-topic></span>
        <span class="topbar-spacer"></span>
        <span class="bridge-chip" data-bridge-chip hidden>
          <span class="dot"></span>
          <span data-bridge-text></span>
        </span>
        <button class="theme-toggle" type="button" data-theme-toggle></button>
      </header>
      <div data-banners></div>
      <main id="outlet" style="display: flex; flex-direction: column; flex: 1"></main>`,this.outlet=e.querySelector("#outlet"),this.banners=e.querySelector("[data-banners]"),e.querySelector("[data-theme-toggle]").addEventListener("click",()=>this.cycleTheme()),this.applyTheme(),window.addEventListener("hashchange",()=>this.route(!0)),this.route(!1),V({onChange:()=>{var n;return void((n=this.view)==null?void 0:n.refresh())},onBridge:n=>{this.bridge=n,this.renderStatus()},onConnection:n=>{var a;n!==this.connection&&(this.connection=n,this.renderStatus(),n==="live"&&((a=this.view)==null||a.refresh()))}}),window.setInterval(()=>M(document.body),3e4)}cycleTheme(){const e=["auto","light","dark"];this.theme=e[(e.indexOf(this.theme)+1)%e.length],this.theme==="auto"?localStorage.removeItem("debate-theme"):localStorage.setItem("debate-theme",this.theme),this.applyTheme()}applyTheme(){this.theme==="auto"?delete document.documentElement.dataset.theme:document.documentElement.dataset.theme=this.theme;const e=document.querySelector("[data-theme-toggle]");e.innerHTML=me[this.theme];const t={auto:"System theme",light:"Light theme",dark:"Dark theme"}[this.theme];e.title=`${t} — click to switch`,e.setAttribute("aria-label",e.title)}route(e){var o;const n=window.location.hash.match(/^#\/d\/(.+)$/),a=n?`debate:${decodeURIComponent(n[1])}`:"overview";if(a===this.currentRoute){(o=this.view)==null||o.refresh();return}this.currentRoute=a;const r=document.querySelector("[data-topbar-topic]"),l=document.querySelector("[data-back]");if(l.hidden=!n,n){const i=decodeURIComponent(n[1]);r.textContent=i,this.view=new re(this.outlet,i)}else r.textContent="",document.title="Debate Control Room",this.view=new pe(this.outlet);window.scrollTo({top:0}),this.view.refresh().then(()=>{var i;e&&((i=this.view)==null||i.focusHeading())})}renderStatus(){const e=document.querySelector("[data-bridge-chip]"),t=e.querySelector("[data-bridge-text]");this.bridge&&(e.hidden=!1,e.dataset.state=this.bridge.running?"running":"stopped",t.textContent=this.bridge.running?"bridge":"bridge stopped",e.title=this.bridge.running?`Bridge daemon running (pid ${this.bridge.pid}) — messages are being delivered`:"Bridge daemon is not running — messages will queue until it starts"),this.banners.innerHTML=this.connection==="reconnecting"?`<div class="banner banner--danger" role="status">
             <strong>Connection to the relay lost.</strong>
             <span>Retrying &mdash; the transcript may be stale until it reconnects.</span>
           </div>`:""}}new ge(document.querySelector("#app"));
