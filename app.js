/* Canned Publishing – klientlogik. Statisk, läser JSON, allt i minnet => snabbt.
   Fullt lokaliserad: ui.<lang>.json driver alla etiketter/menyer. RTL-stöd. */
'use strict';
const $ = s => document.querySelector(s);
const LS = { get:(k,d)=>localStorage.getItem('cp_'+k)||d, set:(k,v)=>localStorage.setItem('cp_'+k,v) };
const state = { lang:null, sprak:[], ui:{}, index:[], tags:{}, active:new Set(), query:'', typ:'alla', visa:30,
  axlar:new Set(), axdef:[], grupper:[], personas:[] };
const PAGE = 30;

const THEME_STD = ['dark','light','sepia','midnatt','nord','dracula','solarized'];
const THEME_A11Y = ['hk-svart','hk-ljus','gul-svart'];
const TEXTS = ['normal','large','xlarge'];
const FONTS = ['standard','lasvanlig'];
const TYP_ORD = ['ämne','plats','person','organisation','händelse'];
const TYPER = ['nyhet','lagforslag','kommunbeslut','omvarld'];
const BADGE_KLASS = {lagforslag:'lag', kommunbeslut:'kommun', omvarld:'omv'};   // typ -> badge-css-klass
const KORT_KLASS = {lagforslag:'lagforslag', kommunbeslut:'kommunbeslut', omvarld:'omvarld'};

/* engelsk fallback om en ui-fil saknas */
const UIDEF = {sub:"Multilingual news",search_label:"Search",search_ph:"Type a word…",language:"Language",
  settings:"Display",theme:"Theme",textsize:"Text size",font:"Font",
  themegroups:{standard:"Standard",a11y:"Accessibility"},
  themes:{dark:"Dark",light:"Light",sepia:"Sepia",midnatt:"Midnight (OLED)",nord:"Nord",dracula:"Dracula",solarized:"Solarized","hk-svart":"High contrast – black","hk-ljus":"High contrast – light","gul-svart":"Yellow on black"},
  texts:{normal:"Normal",large:"Large",xlarge:"Extra large"},fonts:{standard:"Standard",lasvanlig:"Readable"},
  types:{alla:"All",nyhet:"News",lagforslag:"Bills",kommunbeslut:"Municipal",omvarld:"EU & World"},typebadge:{nyhet:"News",lagforslag:"Bill",kommunbeslut:"Municipal",omvarld:"EU/World"},
  tagtypes:{"ämne":"Topic","plats":"Place","person":"Person","organisation":"Organisation","händelse":"Event"},
  kalla:"Source",original:"Read the original at",count:"results",none:"No matches.",clear:"Clear filters",back:"← Back",
  tldr_label:"TL;DR",lattlast_label:"In plain language",fulltext_label:"Full text",loadmore:"Load more",
  status:{title:"By the numbers",articles:"articles",languages:"languages",municipalities:"municipalities covered",
    sources:"sources",updated:"Updated",fresh:"Updated daily",stale:"Updates paused",
    new30:"new in the last 30 days",coverage:"Language coverage",bytype:"By type"},
  sit:{btn:"My situation",none:"My situation",title:"What matters to you?",
    intro:"Tick what fits your life — articles that affect you most rise to the top (nothing is hidden).",
    presets:"Quick presets",clear:"Clear",affects:"Affects you",
    high:"a lot",mid:"somewhat",low:"a little",
    share:"Save / move to another device",sharehelp:"Copy this code and paste it in the address bar on another device, or bookmark the link.",
    copy:"Copy link",copied:"Copied!"}};
const ui = () => state.ui;

async function getJSON(url){ const r = await fetch(url); if(!r.ok) throw new Error(url); return r.json(); }
function esc(s){ return (s==null?'':''+s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

/* inställningar (tema/text/typsnitt) – attribut sätts direkt, options byggs lokaliserat */
function initPrefAttrs(){
  document.documentElement.setAttribute('data-theme', LS.get('tema','dark'));
  document.documentElement.setAttribute('data-text', LS.get('text','normal'));
  document.documentElement.setAttribute('data-font', LS.get('font','standard'));
}
function buildSettings(){
  const u = ui();
  const grp = (label, keys, dict) => `<optgroup label="${esc(label)}">`+
    keys.map(k=>`<option value="${k}">${esc(dict[k]||k)}</option>`).join('')+`</optgroup>`;
  $('#tema').innerHTML = grp(u.themegroups.standard, THEME_STD, u.themes) + grp(u.themegroups.a11y, THEME_A11Y, u.themes);
  $('#text').innerHTML = TEXTS.map(k=>`<option value="${k}">${esc(u.texts[k])}</option>`).join('');
  $('#font').innerHTML = FONTS.map(k=>`<option value="${k}">${esc(u.fonts[k])}</option>`).join('');
  $('#tema').value = LS.get('tema','dark'); $('#text').value = LS.get('text','normal'); $('#font').value = LS.get('font','standard');
}
function applyUI(){
  const u = ui();
  document.title = 'Canned Publishing – ' + u.sub;
  $('#ui-sub').textContent = u.sub;
  $('#lbl-search').textContent = u.search_label; $('#sok').placeholder = u.search_ph;
  $('#searchhelp').textContent = u.searchhelp || '';
  $('#lbl-settings').title = u.settings; $('#lbl-settings').setAttribute('aria-label', u.settings);
  $('#lbl-tema').textContent = u.theme; $('#lbl-text').textContent = u.textsize; $('#lbl-font').textContent = u.font;
  $('.langpick').title = u.language; $('#lang').setAttribute('aria-label', u.language);
  $('#omlank').textContent = (state.about && state.about.label) || 'Om';
  $('#foot-ai').textContent = (state.about && state.about.disclosure) || '';
  $('#rsslank').href = `feed.${state.lang}.xml`;
  const alt = $('#rss-alt'); if(alt) alt.href = `feed.${state.lang}.xml`;
  sitBtn();
}

/* ── Min situation: livssituations-axlar driver re-rank + relevans-markör ── */
function sitT(){ return (ui().sit) || UIDEF.sit; }
function axLabel(id){
  const o = (ui().axlar && ui().axlar[id]);                 // ev. lokaliserad
  if(o) return o;
  const ax = state.axdef.find(a=>a.id===id);
  return ax ? ax.namn : id;
}
function axIkon(id){ const ax = state.axdef.find(a=>a.id===id); return ax?ax.ikon:''; }
/* högsta relevans bland användarens valda axlar (0 om inga valda / ingen data) */
function relScore(a){
  if(!state.axlar.size || !a.relevans) return 0;
  let m = 0; for(const id of state.axlar){ const v = a.relevans[id]||0; if(v>m) m=v; }
  return m;
}
function sitBtn(){
  const b = $('#sit-btn'); if(!b) return;
  const n = state.axlar.size;
  b.textContent = '⚖ ' + (n ? `${sitT().btn} (${n})` : sitT().none);
  b.setAttribute('aria-expanded', !$('#sit-panel').classList.contains('hidden'));
}
function toggleAxel(id){ state.axlar.has(id)?state.axlar.delete(id):state.axlar.add(id); sparaAxlar(); renderSituation(); sitBtn(); state.visa=PAGE; renderList(); }
function applyPreset(p){
  const alla = (p.axlar||[]).every(x=>state.axlar.has(x));
  (p.axlar||[]).forEach(x=> alla ? state.axlar.delete(x) : state.axlar.add(x));  // toggla bunten
  sparaAxlar(); renderSituation(); sitBtn(); state.visa=PAGE; renderList();
}
function clearSit(){ state.axlar.clear(); sparaAxlar(); renderSituation(); sitBtn(); renderList(); }
function sparaAxlar(){ LS.set('axlar', [...state.axlar].join('.')); }

function renderSituation(){
  const el = $('#sit-panel'); const u = sitT();
  const pres = state.personas.map(p=>{
    const on = (p.axlar||[]).length && (p.axlar||[]).every(x=>state.axlar.has(x));
    return `<button class="preset${on?' on':''}" data-p="${esc(p.id)}" title="${esc(p.beskrivning||'')}">${esc(p.ikon||'')} ${esc(p.roll||p.namn)}</button>`;
  }).join('');
  const grupper = state.grupper.length ? state.grupper : [...new Set(state.axdef.map(a=>a.grupp))];
  const chips = grupper.map(g=>{
    const axs = state.axdef.filter(a=>a.grupp===g);
    if(!axs.length) return '';
    return `<div class="ax-grupp">`+axs.map(a=>
      `<button class="ax${state.axlar.has(a.id)?' on':''}" data-ax="${esc(a.id)}" aria-pressed="${state.axlar.has(a.id)}">${esc(a.ikon)} ${esc(axLabel(a.id))}</button>`).join('')+`</div>`;
  }).join('');
  const kod = kodaInst();
  const lank = location.origin + location.pathname + '?s=' + kod;
  el.innerHTML = `<div class="sit-head"><h2>${esc(u.title)}</h2>
      ${state.axlar.size?`<button class="sit-clear">${esc(u.clear)}</button>`:''}</div>
    <p class="sit-intro">${esc(u.intro)}</p>
    <div class="sit-sub">${esc(u.presets)}</div><div class="presets">${pres}</div>
    <div class="ax-chips">${chips}</div>
    <details class="sit-share"><summary>${esc(u.share)}</summary>
      <p class="sit-sharehelp">${esc(u.sharehelp)}</p>
      <div class="share-row"><input id="share-url" readonly value="${esc(lank)}">
        <button id="share-copy">${esc(u.copy)}</button></div></details>`;
  el.querySelectorAll('.ax').forEach(c=>c.addEventListener('click',()=>toggleAxel(c.dataset.ax)));
  el.querySelectorAll('.preset').forEach(c=>c.addEventListener('click',()=>{
    const p = state.personas.find(x=>x.id===c.dataset.p); if(p) applyPreset(p); }));
  const clr = el.querySelector('.sit-clear'); if(clr) clr.addEventListener('click',clearSit);
  const cp = $('#share-copy'); if(cp) cp.addEventListener('click',()=>{
    const inp=$('#share-url'); inp.select(); navigator.clipboard?.writeText(inp.value);
    cp.textContent = sitT().copied; setTimeout(()=>cp.textContent=sitT().copy,1500); });
}
/* delbar kod: kompakt base64url av {a:[axlar],l,t,x,f} */
function kodaInst(){
  const o = {a:[...state.axlar], l:state.lang, t:LS.get('tema','dark'), x:LS.get('text','normal'), f:LS.get('font','standard')};
  try { return btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
  catch(e){ return ''; }
}
function avkodaInst(kod){
  try {
    const j = JSON.parse(decodeURIComponent(escape(atob(kod.replace(/-/g,'+').replace(/_/g,'/')))));
    if(Array.isArray(j.a)) j.a.forEach(x=>state.axlar.add(x));
    if(j.l) LS.set('lang', j.l);
    if(j.t){ LS.set('tema', j.t); document.documentElement.setAttribute('data-theme', j.t); }
    if(j.x){ LS.set('text', j.x); document.documentElement.setAttribute('data-text', j.x); }
    if(j.f){ LS.set('font', j.f); document.documentElement.setAttribute('data-font', j.f); }
    return j.l || null;
  } catch(e){ return null; }
}

async function boot(){
  // delbar inställnings-kod i URL (?s=) – applicera FÖRST så lang/tema/axlar slår igenom
  const sp = new URLSearchParams(location.search);
  let kodLang = null;
  if(sp.get('s')){ kodLang = avkodaInst(sp.get('s')); history.replaceState(null,'',location.pathname); }
  if(!state.axlar.size) LS.get('axlar','').split('.').filter(Boolean).forEach(x=>state.axlar.add(x));
  initPrefAttrs();
  try { const ax = await getJSON('data/axlar.json'); state.axdef = ax.axlar||[]; state.grupper = ax.grupper||[]; } catch(e){}
  try { const pj = await getJSON('data/personas.json'); state.personas = pj.personas||[]; } catch(e){}
  $('#sit-btn').addEventListener('click', ()=>{
    const p = $('#sit-panel'); p.classList.toggle('hidden');
    if(!p.classList.contains('hidden')) renderSituation();
    sitBtn();
  });
  $('#tema').addEventListener('change', e=>{ document.documentElement.setAttribute('data-theme', e.target.value); LS.set('tema', e.target.value); });
  $('#text').addEventListener('change', e=>{ document.documentElement.setAttribute('data-text', e.target.value); LS.set('text', e.target.value); });
  $('#font').addEventListener('change', e=>{ document.documentElement.setAttribute('data-font', e.target.value); LS.set('font', e.target.value); });
  $('#sok').addEventListener('input', e=>{ state.query = e.target.value.trim().toLowerCase(); state.visa = PAGE; renderList(); });
  window.addEventListener('hashchange', route);
  $('#omlank').addEventListener('click', ()=>{ location.hash = 'om'; });

  try { state.sprak = await getJSON('data/sprak.json'); } catch(e){ state.sprak = [{kod:'sv',namn:'Svenska',rtl:false}]; }
  const sel = $('#lang');
  sel.innerHTML = state.sprak.map(s=>`<option value="${s.kod}">${esc(s.namn)}</option>`).join('');
  const saved = kodLang || LS.get('lang', state.sprak[0].kod);
  sel.value = state.sprak.some(s=>s.kod===saved) ? saved : state.sprak[0].kod;
  sel.addEventListener('change', ()=>{ LS.set('lang', sel.value); loadLanguage(sel.value); });

  await loadLanguage(sel.value);
  route();
}

async function loadLanguage(lang){
  state.lang = lang;
  const meta = state.sprak.find(s=>s.kod===lang) || {rtl:false};
  document.documentElement.lang = lang;
  document.documentElement.dir = meta.rtl ? 'rtl' : 'ltr';
  try { state.ui = await getJSON(`data/ui.${lang}.json`); }
  catch(e){ try { state.ui = await getJSON('data/ui.en.json'); } catch(_){ state.ui = UIDEF; } }
  try { state.about = await getJSON(`data/about.${lang}.json`); }
  catch(e){ try { state.about = await getJSON('data/about.en.json'); } catch(_){ state.about = {}; } }
  if(!state.status){ try { state.status = await getJSON('data/status.json'); } catch(e){ state.status = null; } }
  try { state.index = await getJSON(`data/index.${lang}.json`); state.tags = await getJSON(`data/tags.${lang}.json`); }
  catch(e){ state.index = []; state.tags = {}; }
  applyUI(); buildSettings();
  renderTypeFilter(); renderList();
}

function renderTypeFilter(){
  const u = ui();
  const c = { alla: state.index.length,
    nyhet: state.index.filter(a=>(a.typ||'nyhet')==='nyhet').length,
    lagforslag: state.index.filter(a=>a.typ==='lagforslag').length,
    kommunbeslut: state.index.filter(a=>a.typ==='kommunbeslut').length,
    omvarld: state.index.filter(a=>a.typ==='omvarld').length };
  const opt = [['alla',u.types.alla,c.alla]].concat(
    TYPER.filter(t=>c[t]>0).map(t=>[t, (u.types[t]||t), c[t]]));
  $('#typefilter').innerHTML = opt.map(([v,lbl,n])=>
    `<button class="tf" data-typ="${v}" aria-pressed="${state.typ===v}">${esc(lbl)} (${n})</button>`).join('');
  $('#typefilter').querySelectorAll('.tf').forEach(b=>b.addEventListener('click',()=>{ state.typ=b.dataset.typ; state.visa=PAGE; renderTypeFilter(); renderList(); }));
}

function renderFilters(){
  const u = ui(); const groups = {};
  Object.entries(state.tags).forEach(([id,info])=>{ (groups[info.typ]=groups[info.typ]||[]).push([id,info]); });
  const order = [...TYP_ORD.filter(x=>groups[x]), ...Object.keys(groups).filter(x=>!TYP_ORD.includes(x))];
  $('#filters').innerHTML = order.map(typ=>{
    const chips = groups[typ].sort((a,b)=>(b[1].antal||0)-(a[1].antal||0)).map(([id,info])=>
      `<button class="chip" aria-pressed="${state.active.has(id)}" data-tag="${id}">${esc(info.etikett)} <span class="n">${info.antal||''}</span></button>`).join('');
    return `<div class="filt-group"><h3>${esc((u.tagtypes&&u.tagtypes[typ])||typ)}</h3><div class="chips">${chips}</div></div>`;
  }).join('');
  $('#filters').querySelectorAll('.chip').forEach(c=>c.addEventListener('click',()=>toggleTag(c.dataset.tag)));
}
function toggleTag(id){ state.active.has(id)?state.active.delete(id):state.active.add(id); renderFilters(); renderList(); }
function renderActivebar(){
  const bar = $('#activebar');
  if(!state.active.size){ bar.innerHTML=''; return; }
  const names = [...state.active].map(id=>esc((state.tags[id]||{}).etikett||id)).join(', ');
  bar.innerHTML = `<span>${names}</span><button class="clear">${esc(ui().clear)}</button>`;
  bar.querySelector('.clear').addEventListener('click',()=>{ state.active.clear(); renderFilters(); renderList(); });
}

function matches(a){
  if(state.typ!=='alla' && (a.typ||'nyhet')!==state.typ) return false;
  if(state.query){
    const hay = (a.titel+' '+(a.ingress||'')+' '+(a.taggar||[]).map(id=>(state.tags[id]||{}).etikett||id).join(' ')).toLowerCase();
    for(const w of state.query.split(/\s+/)) if(w && !hay.includes(w)) return false;  // varje ord måste matcha
  }
  return true;
}
function relMark(a){
  const r = relScore(a); if(!r) return '';
  const niv = [sitT().low, sitT().mid, sitT().high][r-1] || '';
  return `<span class="rel rel${r}" title="${esc(sitT().affects)}: ${esc(niv)}">${'●'.repeat(r)}${'○'.repeat(3-r)}</span>`;
}
function renderList(){
  const u = ui(); let items = state.index.filter(matches);
  if(state.axlar.size){            // re-ranka på relevans (stabilt, behåll datum-ordning vid lika)
    items = items.map((a,i)=>[a,i]).sort((A,B)=>(relScore(B[0])-relScore(A[0]))||(A[1]-B[1])).map(x=>x[0]);
  }
  $('#count').textContent = `${items.length} ${u.count}`;
  const vis = items.slice(0, state.visa);
  $('#list').innerHTML = (items.length ? vis.map(a=>{
    return `<button class="card ${KORT_KLASS[a.typ]||''}" data-id="${esc(a.id)}">
      <span class="toprow"><span class="badge-typ ${BADGE_KLASS[a.typ]||''}">${esc((u.typebadge[a.typ]||u.typebadge.nyhet))}</span>${relMark(a)}<span class="date">${esc(a.datum||'')}</span></span>
      <h2>${esc(a.titel)}</h2>
      <p>${esc(a.ingress||'')}</p>
      ${a.kalla?`<span class="src">${esc(u.kalla)}: <b>${esc(a.kalla)}</b></span>`:''}
      <span class="tags">${(a.taggar||[]).slice(0,5).map(id=>`<span>${esc((state.tags[id]||{}).etikett||id)}</span>`).join('')}</span>
    </button>`; }).join('') : `<div class="empty">${esc(u.none)}</div>`)
    + (items.length > state.visa ? `<button class="loadmore">${esc(u.loadmore||'Ladda fler')} (${items.length-state.visa})</button>` : '');
  $('#list').querySelectorAll('.card').forEach(c=>c.addEventListener('click',()=>{ location.hash='a/'+c.dataset.id; }));
  const lm = $('#list').querySelector('.loadmore');
  if(lm) lm.addEventListener('click',()=>{ state.visa += PAGE; renderList(); });
}

const LISTVY = ['#typefilter','#searchhelp','.meta-row','#list'];
function stangOverlay(){ ['#article','#about'].forEach(s=>$(s).classList.add('hidden')); LISTVY.forEach(s=>$(s).classList.remove('hidden')); }
function route(){
  const m = location.hash.match(/^#a\/(.+)$/);
  if(m) openArticle(decodeURIComponent(m[1]));
  else if(location.hash==='#om') openAbout();
  else stangOverlay();
}
function statusHTML(){
  const s = state.status; if(!s) return '';
  const u = ui(); const st = (u.status) || UIDEF.status;
  // färskhet: <36h sedan uppdatering = "uppdateras dagligen"
  let fresh = true;
  if(s.uppdaterad){ const d = new Date(s.uppdaterad); if(!isNaN(d)) fresh = (Date.now()-d.getTime()) < 36*3600*1000; }
  const big = (n,lbl)=>`<div class="stat-big"><b>${n}</b><span>${esc(lbl)}</span></div>`;
  const typer = TYPER.filter(t=>(s.per_typ||{})[t]).map(t=>
    `<span class="stat-typ ${BADGE_KLASS[t]||''}">${esc((u.types&&u.types[t])||t)} <b>${s.per_typ[t]}</b></span>`).join('');
  const namn = k => (state.sprak.find(x=>x.kod===k)||{}).namn || k;
  const ps = s.per_sprak||{}; const max = Math.max(1,...Object.values(ps));
  const bars = Object.entries(ps).map(([k,n])=>
    `<div class="stat-bar"><span class="bk">${esc(namn(k))}</span><span class="bt"><i style="width:${Math.round(n/max*100)}%"></i></span><span class="bn">${n}</span></div>`).join('');
  return `<section class="statbox" aria-label="${esc(st.title)}">
    <div class="stat-head"><h2>${esc(st.title)}</h2>
      <span class="freshdot ${fresh?'ok':'stale'}" title="${esc(s.uppdaterad||'')}">${fresh?'🟢':'🟡'} ${esc(fresh?st.fresh:st.stale)}</span></div>
    <div class="stat-row">${big(s.artiklar,st.articles)}${big(s.sprak,st.languages)}${big(s.kommuner,st.municipalities)}${big(s.kallor,st.sources)}</div>
    ${typer?`<div class="stat-sub">${esc(st.bytype)}</div><div class="stat-typer">${typer}</div>`:''}
    ${(s.nytt_30d!=null)?`<p class="stat-new">+${s.nytt_30d} ${esc(st.new30)}</p>`:''}
    ${bars?`<div class="stat-sub">${esc(st.coverage)}</div><div class="stat-bars">${bars}</div>`:''}
    <p class="stat-upd">${esc(st.updated)} ${esc((s.uppdaterad||'').replace('T',' '))}</p>
  </section>`;
}
function openAbout(){
  const a = state.about||{}; const el = $('#about');
  el.innerHTML = `<button class="back">${esc(ui().back)}</button>
    <h1>${esc(a.title||'')}</h1>${a.body||''}${statusHTML()}`;
  el.querySelector('.back').addEventListener('click',()=>{ location.hash=''; });
  LISTVY.forEach(s=>$(s).classList.add('hidden')); $('#article').classList.add('hidden'); $('#sit-panel').classList.add('hidden');
  el.classList.remove('hidden'); el.focus(); window.scrollTo(0,0);
}
async function openArticle(id){
  let a; try { a = await getJSON(`data/artikel/${id}.${state.lang}.json`); } catch(e){ location.hash=''; return; }
  const u = ui();
  const el = $('#article');
  const layered = a.tldr || a.lattlast;
  const tldr = a.tldr ? `<div class="tldr"><span class="lbl">${esc(u.tldr_label||'TL;DR')}</span>${esc(a.tldr)}</div>` : '';
  const latt = a.lattlast ? `<div class="lattlast">${u.lattlast_label?`<div class="layer-h">${esc(u.lattlast_label)}</div>`:''}${a.lattlast}</div>` : '';
  const full = a.html ? (layered
      ? `<details class="fulltext"><summary>${esc(u.fulltext_label||'')}</summary><div class="body">${a.html}</div></details>`
      : `<div class="body">${a.html}</div>`) : '';
  el.innerHTML = `<button class="back">${esc(u.back)}</button>
    <span class="badge-typ ${BADGE_KLASS[a.typ]||''}">${esc(u.typebadge[a.typ]||u.typebadge.nyhet)}</span>
    <h1>${esc(a.titel)}</h1>
    <div class="source"><span class="lbl">${esc(u.kalla)}</span> <b>${esc(a.kalla||'—')}</b>
      ${a.kalla_url?`<a href="${esc(a.kalla_url)}" target="_blank" rel="noopener">${esc(u.original)} ${esc(a.kalla||'')} →</a>`:''}
      <span style="font-size:.78rem;color:var(--txt3);flex-basis:100%">${esc(a.datum||'')}</span></div>
    ${tldr}${latt}${full}
    ${a.kalla_url?`<div class="source-foot">${esc(u.original)} <a href="${esc(a.kalla_url)}" target="_blank" rel="noopener">${esc(a.kalla||a.kalla_url)}</a>.</div>`:''}`;
  el.querySelector('.back').addEventListener('click',()=>{ location.hash=''; });
  LISTVY.forEach(s=>$(s).classList.add('hidden')); $('#about').classList.add('hidden'); $('#sit-panel').classList.add('hidden');
  el.classList.remove('hidden'); el.focus(); window.scrollTo(0,0);
}
boot();
