/* Canned Publishing – klientlogik. Statisk, läser JSON, allt i minnet => snabbt.
   Faset-filter i vänster sidofält: Privatperson/Företag-lager + livssituations-axlar.
   Fullt lokaliserad (ui.<lang>.json), RTL-stöd, responsiv (off-canvas på mobil). */
'use strict';
const $ = s => document.querySelector(s);
const LS = { get:(k,d)=>localStorage.getItem('cp_'+k)||d, set:(k,v)=>localStorage.setItem('cp_'+k,v) };
const state = { lang:null, sprak:[], ui:{}, index:[], tags:{}, query:'', typer:new Set(), visa:30,
  axlar:new Set(), axdef:[], grupper:[], gruppnamn:{}, lagernamn:{}, lager:'privat',
  openGroups:new Set(['__typ']), mer:new Set(), filterQ:'', _akt:[],
  ort:{privat:new Set(), foretag:new Set()}, orter:[], ortQ:'', konto:{namn:null, token:null}, fbKonton:[],
  sok:false, srv:null };   // sok=serverside-sök (skalning); srv=senaste serversvar {results,total,facets,_page}
const PAGE = 30;

const THEME_STD = ['dark','light','sepia','midnatt','nord','dracula','solarized'];
const THEME_A11Y = ['hk-svart','hk-ljus','gul-svart'];
const TEXTS = ['normal','large','xlarge'];
const FONTS = ['standard','lasvanlig'];
/* Typ-dimension = förvaltningsnivå ("Vem beslutar"), ordnad stat→region→kommun→EU. */
const TYPER = ['lagforslag','myndighet','region','kommunbeslut','omvarld','marknad','nyhet','historia'];
const BADGE_KLASS = {lagforslag:'lag', kommunbeslut:'kommun', omvarld:'omv', myndighet:'mynd', marknad:'mark', region:'reg', historia:'hist'};
const KORT_KLASS = {lagforslag:'lagforslag', kommunbeslut:'kommunbeslut', omvarld:'omvarld', myndighet:'myndighet', marknad:'marknad', region:'region', historia:'historia'};
const FLAGG_IK = {saknad:'⚠️', omtvistat:'🔀', logik:'❗', tidsavstand:'🕰️'};
const EPOK_ORDER = ['stenalder','bronsalder','jarnalder','vendeltid','vikingatid','medeltid','vasatiden','stormaktstiden','frihetstiden','1800talet','1900talet'];
const SIT_FRI = new Set(['historia','nyhet']);   // undantagna situationsfiltret (allmänt innehåll, ej personberoende)
const LAND_FLAGGA = {SE:'🇸🇪',NO:'🇳🇴',DK:'🇩🇰',FI:'🇫🇮',DE:'🇩🇪',US:'🇺🇸',CN:'🇨🇳',QA:'🇶🇦',BR:'🇧🇷',RU:'🇷🇺'};

const UIDEF = {sub:"Multilingual news",search_label:"Search",search_ph:"Type a word…",language:"Language",
  settings:"Display",theme:"Theme",textsize:"Text size",font:"Font",
  themegroups:{standard:"Standard",a11y:"Accessibility"},
  themes:{dark:"Dark",light:"Light",sepia:"Sepia",midnatt:"Midnight (OLED)",nord:"Nord",dracula:"Dracula",solarized:"Solarized","hk-svart":"High contrast – black","hk-ljus":"High contrast – light","gul-svart":"Yellow on black"},
  texts:{normal:"Normal",large:"Large",xlarge:"Extra large"},fonts:{standard:"Standard",lasvanlig:"Readable"},
  types:{alla:"All",nyhet:"News",lagforslag:"Parliament & government",kommunbeslut:"Municipality",omvarld:"EU & World",myndighet:"State agencies",marknad:"Markets",region:"Region",historia:"History"},
  typebadge:{nyhet:"News",lagforslag:"Bill",kommunbeslut:"Municipality",omvarld:"EU/World",myndighet:"Agency",marknad:"Market",region:"Region",historia:"History"},
  typdesc:{lagforslag:"Laws, taxes and national politics",myndighet:"Central bank, national audit and more",region:"Healthcare, dental care, public transport",kommunbeslut:"Schools, care, water, building permits",omvarld:"EU and international",marknad:"Stock market and economy",historia:"Swedish history — flagged for credibility"},
  trov:{rubrik:"How sure are we?",
    kallage:{label:"Evidence",samtida:"Contemporary source",senare:"Later account",arkeologi:"Archaeology",tolkning:"Interpretation",legend:"Tradition/legend"},
    sakerhet:{label:"Certainty",belagt:"Documented",trolig:"Probable",omtvistat:"Disputed",spekulativt:"Speculative",legend:"Legend/myth"},
    konsensus:{label:"Scholarly view",samsyn:"Consensus",delade:"Divided",foraldrad:"Outdated view"},
    flagg:{saknad:"Missing piece",omtvistat:"Disputed",logik:"Logical oddity",tidsavstand:"Source long after the event"}},
  epoknamn:{stenalder:"Stone Age",bronsalder:"Bronze Age",jarnalder:"Iron Age",vendeltid:"Vendel Period",vikingatid:"Viking Age",medeltid:"Middle Ages",vasatiden:"Vasa era",stormaktstiden:"Swedish Empire",frihetstiden:"Age of Liberty","1800talet":"19th century","1900talet":"20th century"},
  jamf:{rubrik:"Source comparison",kallor:"sources",lander:"countries",konfidens:"confidence",samstammigt:"What sources agree on",divergenser:"Where sources differ",enkalligt:"Only one source",vinkel:"Each source's angle",partisk:"party-affiliated",konf_niv:{"hög":"high","medel":"medium","låg":"low"},statskontroll:{statsfinansierat:"state-funded",statskontrollerat:"state-controlled"}},
  kalla:"Source",original:"Read the original at",count:"results",none:"No matches.",clear:"Clear",back:"← Back",
  tldr_label:"TL;DR",lattlast_label:"In plain language",fulltext_label:"Full text",loadmore:"Load more",
  lagernamn:{privat:"Private individual",foretag:"Business"},
  status:{title:"By the numbers",articles:"articles",languages:"languages",municipalities:"municipalities covered",
    sources:"sources",updated:"Updated",fresh:"Updated daily",stale:"Updates paused",
    new30:"new in the last 30 days",coverage:"Language coverage",bytype:"By type"},
  sit:{filter:"Filter",type:"Who decides",all:"Select all",none_all:"Clear all",more:"show more",fewer:"fewer",
    clear:"Clear",share_btn:"Share ⤴",sharehelp:"Copy this link and paste it in the address bar on another device, or bookmark it.",
    copy:"Copy link",copied:"Copied!",apply:"Show",affects:"Affects you",high:"a lot",mid:"somewhat",low:"a little",
    ort_privat:"Where do you live?",ort_foretag:"Where is your business?",ort_ph:"Search municipality…",
    ort_hint:"Municipal decisions are filtered to your municipality."},
  konto:{rubrik:"Account (save your settings)",namn:"Username",losen:"Password",logga_in:"Log in",skapa:"Create account",
    logga_ut:"Log out",inloggad:"Logged in as",glomt:"Forgot your password? Just create a new account.",
    fyll:"Enter username and password.",finns:"Username taken.",felinlogg:"Wrong username or password.",kort:"Too short.",
    sparad:"Saved"},
  fb:{knapp:"Feedback",titel:"Send feedback",ph:"What do you think? What's missing or broken?",skicka:"Send",
    avbryt:"Cancel",tack:"Thanks for your feedback!",fel:"Something went wrong — try again."}};
const ui = () => state.ui;

async function getJSON(url){ const r = await fetch(url); if(!r.ok) throw new Error(url); return r.json(); }
function esc(s){ return (s==null?'':''+s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

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
  $('#lbl-settings').title = u.settings; $('#lbl-settings').setAttribute('aria-label', u.settings);
  $('#lbl-tema').textContent = u.theme; $('#lbl-text').textContent = u.textsize; $('#lbl-font').textContent = u.font;
  $('.langpick').title = u.language; $('#lang').setAttribute('aria-label', u.language);
  $('#omlank').textContent = (state.about && state.about.label) || 'Om';
  $('#foot-ai').textContent = (state.about && state.about.disclosure) || '';
  $('#rsslank').href = `feed.${state.lang}.xml`;
  const alt = $('#rss-alt'); if(alt) alt.href = `feed.${state.lang}.xml`;
  $('#filter-sok').placeholder = u.search_ph;
  renderKonto(); uppdateraFb();
}

/* ── Faset-sidofält: lager (privat/företag) + livssituations-axlar ── */
function sitT(){ return Object.assign({}, UIDEF.sit, ui().sit||{}); }
function axDef(id){ return state.axdef.find(a=>a.id===id); }
function axLabel(id){ const o=(ui().axlar&&ui().axlar[id]); if(o) return o; const ax=axDef(id); return ax?ax.namn:id; }
function grpNamn(g){ return (ui().gruppnamn&&ui().gruppnamn[g]) || state.gruppnamn[g] || g; }
function lagerNamn(l){ return (ui().lagernamn&&ui().lagernamn[l]) || state.lagernamn[l] || (UIDEF.lagernamn[l]||l); }
function inLager(id){ const ax=axDef(id); return !!ax && (ax.lager===state.lager || ax.lager==='bada'); }
function aktivaAxlar(){ return [...state.axlar].filter(inLager); }      // valda axlar i aktuellt lager
function relScore(a){ const akt=state._akt; if(!akt.length||!a.relevans) return 0;
  let m=0; for(const id of akt){ const v=a.relevans[id]||0; if(v>m) m=v; } return m; }
function sparaAxlar(){ LS.set('axlar',[...state.axlar].join('.')); autospar(); }
function sparaTyper(){ LS.set('typer',[...state.typer].join('.')); autospar(); }
function clearSit(){ state.axlar.clear(); state.typer.clear(); sparaAxlar(); sparaTyper(); renderSidebar(); state.visa=PAGE; refresh(); }

/* ── Plats: kommunbeslut filtreras till användarens kommun(er) per lager ── */
function ortFor(){ return state.ort[state.lager]; }
function sparaOrt(){ LS.set('ort_'+state.lager, [...ortFor()].join(',')); autospar(); }
function ortNamn(slug){ const o=state.orter.find(x=>x.slug===slug); return o?o.namn:slug; }
function artKommun(a){ for(const t of (a.taggar||[])) if((state.tags[t]||{}).typ==='plats') return t; return null; }
function renderOrt(){
  const s=sitT(), box=$('#ort-box'); if(!box) return;
  const sel=[...ortFor()];
  const chips=sel.map(slug=>`<button class="ort-chip" data-rm="${esc(slug)}">${esc(ortNamn(slug))} ✕</button>`).join('');
  let lista='';
  if(state.ortQ){
    const q=state.ortQ.toLowerCase();
    const tr=state.orter.filter(o=>o.namn.toLowerCase().includes(q) && !ortFor().has(o.slug)).slice(0,8);
    lista=tr.map(o=>`<button class="ort-opt" data-add="${esc(o.slug)}">${esc(o.namn)}</button>`).join('');
  }
  box.innerHTML=`<div class="ort-lbl">📍 ${esc(state.lager==='foretag'?s.ort_foretag:s.ort_privat)}</div>`+
    (chips?`<div class="ort-chips">${chips}</div>`:'')+
    `<input class="ort-sok" id="ort-sok" placeholder="${esc(s.ort_ph)}" value="${esc(state.ortQ)}" autocomplete="off">`+
    (lista?`<div class="ort-lista">${lista}</div>`:'')+
    `<p class="ort-hint">${esc(s.ort_hint)}</p>`;
  $('#ort-sok').addEventListener('input',e=>{ state.ortQ=e.target.value.trim(); renderOrt(); });
  if(state.ortQ){ const i=$('#ort-sok'); i.focus(); i.setSelectionRange(i.value.length,i.value.length); }
  box.querySelectorAll('[data-add]').forEach(b=>b.addEventListener('click',()=>{ ortFor().add(b.dataset.add); state.ortQ=''; sparaOrt(); renderOrt(); sideBtns(); state.visa=PAGE; refresh(); }));
  box.querySelectorAll('[data-rm]').forEach(b=>b.addEventListener('click',()=>{ ortFor().delete(b.dataset.rm); sparaOrt(); renderOrt(); sideBtns(); state.visa=PAGE; refresh(); }));
}

/* artiklar som passerar typ + fritextsök (bas för faset-antal, oberoende av axel-val) */
function baseFiltered(){
  return state.index.filter(a=>{
    if(state.typer.size && !state.typer.has(a.typ||'nyhet')) return false;
    if(state.query){ const hay=(a.titel+' '+(a.ingress||'')+' '+(a.taggar||[]).map(id=>(state.tags[id]||{}).etikett||id).join(' ')).toLowerCase();
      for(const w of state.query.split(/\s+/)) if(w && !hay.includes(w)) return false; }
    return true;
  });
}

function renderSidebar(){
  const u=ui(), s=sitT();
  const lagerHtml = `<div class="lager-val" role="group">`+['privat','foretag'].map(l=>
    `<button data-lager="${l}" class="${state.lager===l?'on':''}">${esc(lagerNamn(l))}</button>`).join('')+`</div>`;
  // faset-antal: från servern i serverläge, annars klientberäknat över typ+sök-mängden
  const srvf = (state.sok && state.srv) ? state.srv.facets : null;
  let cnt;
  if(srvf){ cnt = srvf.ax || {}; }
  else { cnt = {}; baseFiltered().forEach(a=>{ if(a.relevans) for(const id in a.relevans){ if(a.relevans[id]>=1) cnt[id]=(cnt[id]||0)+1; } }); }
  // typ-facet (flerval: tom = alla)
  // typ-antal speglar ÖVRIGA aktiva filter (sök/situation/ort) → siffran = vad listan visar
  const tc={}; TYPER.forEach(t=> tc[t] = srvf ? (srvf.typ[t]||0) : state.index.filter(a=>matches(a,true) && (a.typ||'nyhet')===t).length);
  const typOpts=TYPER.filter(t=>tc[t]>0).map(t=>[t,(u.types[t]||t),tc[t]]);
  const td=u.typdesc||{};
  const typHtml=`<details class="facet" data-grp="__typ" ${state.openGroups.has('__typ')?'open':''}>
    <summary>${esc(s.type)}<span class="gcount">${state.typer.size||''}</span></summary>`+
    typOpts.map(([v,lbl,n])=>`<label class="opt opt-typ"><input type="checkbox" data-typ="${esc(v)}" ${state.typer.has(v)?'checked':''}><span class="lbl">${esc(lbl)}${td[v]?`<small class="opt-desc">${esc(td[v])}</small>`:''}</span><span class="n">${n}</span></label>`).join('')+`</details>`;
  // situations-grupper för aktuellt lager
  const grupper=(state.grupper.length?state.grupper:[...new Set(state.axdef.map(a=>a.grupp))]);
  const fq=(state.filterQ||'').toLowerCase();
  const GRANS=6;
  const grpHtml=grupper.map(g=>{
    let axs=state.axdef.filter(a=>a.grupp===g && (a.lager===state.lager||a.lager==='bada'));
    if(fq) axs=axs.filter(a=>axLabel(a.id).toLowerCase().includes(fq));
    if(!axs.length) return '';
    const valda=axs.filter(a=>state.axlar.has(a.id)).length;
    const allaPa=axs.every(a=>state.axlar.has(a.id));
    const mer=state.mer.has(g)||!!fq;
    const opts=axs.map((a,i)=>`<label class="opt${(!mer&&i>=GRANS)?' hidden':''}">`+
      `<input type="checkbox" data-ax="${esc(a.id)}" ${state.axlar.has(a.id)?'checked':''}>`+
      `<span class="ic">${esc(a.ikon||'')}</span><span class="lbl">${esc(axLabel(a.id))}</span><span class="n">${cnt[a.id]||0}</span></label>`).join('');
    const merBtn=(!fq&&axs.length>GRANS)?`<button class="opt-mer" data-mer="${g}">${mer?'– '+esc(s.fewer):'+ '+esc(s.more)+' ('+(axs.length-GRANS)+')'}</button>`:'';
    return `<details class="facet" data-grp="${g}" ${(state.openGroups.has(g)||fq)?'open':''}>`+
      `<summary>${esc(grpNamn(g))}<span class="gcount">${valda||''}</span></summary>`+
      `<button class="facet-all" data-all="${g}">${allaPa?esc(s.none_all):esc(s.all)}</button>${opts}${merBtn}</details>`;
  }).join('');
  $('#lager-box').innerHTML = lagerHtml;
  $('#facets').innerHTML = typHtml + grpHtml;
  renderOrt();

  $('#lager-box').querySelectorAll('.lager-val button').forEach(b=>b.addEventListener('click',()=>{
    state.lager=b.dataset.lager; LS.set('lager',state.lager); autospar(); renderSidebar(); state.visa=PAGE; refresh(); }));
  $('#facets').querySelectorAll('input[data-typ]').forEach(c=>c.addEventListener('change',()=>{
    c.checked?state.typer.add(c.dataset.typ):state.typer.delete(c.dataset.typ); sparaTyper(); state.visa=PAGE; refresh(); }));
  $('#facets').querySelectorAll('input[data-ax]').forEach(c=>c.addEventListener('change',()=>{
    c.checked?state.axlar.add(c.dataset.ax):state.axlar.delete(c.dataset.ax); sparaAxlar(); state.visa=PAGE; refresh(); }));
  $('#facets').querySelectorAll('.facet-all').forEach(b=>b.addEventListener('click',e=>{ e.preventDefault(); markAll(b.dataset.all); }));
  $('#facets').querySelectorAll('.opt-mer').forEach(b=>b.addEventListener('click',()=>{
    state.mer.has(b.dataset.mer)?state.mer.delete(b.dataset.mer):state.mer.add(b.dataset.mer); renderSidebar(); }));
  $('#facets').querySelectorAll('.facet').forEach(d=>d.addEventListener('toggle',()=>{
    const g=d.dataset.grp; d.open?state.openGroups.add(g):state.openGroups.delete(g); }));
  sideBtns();
}
function markAll(g){
  const axs=state.axdef.filter(a=>a.grupp===g && (a.lager===state.lager||a.lager==='bada'));
  const allaPa=axs.every(a=>state.axlar.has(a.id));
  axs.forEach(a=> allaPa?state.axlar.delete(a.id):state.axlar.add(a.id));
  sparaAxlar(); state.visa=PAGE; refresh();
}
function sideBtns(){
  const s=sitT();
  const n=aktivaAxlar().length + state.typer.size + ortFor().size;
  const ft=$('#filter-toggle'); if(ft) ft.textContent=`≡ ${s.filter}${n?` (${n})`:''}`;
  const sc=$('#side-clear'); if(sc) sc.textContent=s.clear;
  const ss=$('#side-share'); if(ss) ss.textContent=s.share_btn;
  const stt=$('#side-title'); if(stt) stt.textContent=s.filter;
}
function renderShareBox(){
  const s=sitT(); const box=$('#share-box');
  const lank=location.origin+location.pathname+'?s='+kodaInst();
  box.innerHTML=`<p>${esc(s.sharehelp)}</p><div class="share-row"><input id="share-url" readonly value="${esc(lank)}"><button id="share-copy">${esc(s.copy)}</button></div>`;
  $('#share-copy').addEventListener('click',()=>{ const i=$('#share-url'); i.select(); navigator.clipboard?.writeText(i.value);
    const b=$('#share-copy'); b.textContent=s.copied; setTimeout(()=>b.textContent=s.copy,1500); });
}
/* Inställnings-objekt – delas av delbar kod OCH konto-synk */
function samlaInst(){
  return {a:[...state.axlar],ty:[...state.typer],g:state.lager,l:state.lang,t:LS.get('tema','dark'),x:LS.get('text','normal'),
    f:LS.get('font','standard'),op:[...state.ort.privat],of:[...state.ort.foretag]};
}
function applyInst(j){
  if(!j) return null;
  state.axlar.clear(); state.typer.clear(); state.ort.privat.clear(); state.ort.foretag.clear();
  if(Array.isArray(j.a)) j.a.forEach(x=>state.axlar.add(x));
  if(Array.isArray(j.ty)) j.ty.forEach(x=>state.typer.add(x));
  LS.set('typer',[...state.typer].join('.'));
  if(Array.isArray(j.op)) j.op.forEach(s=>state.ort.privat.add(s));
  if(Array.isArray(j.of)) j.of.forEach(s=>state.ort.foretag.add(s));
  LS.set('axlar',[...state.axlar].join('.'));
  LS.set('ort_privat',[...state.ort.privat].join(',')); LS.set('ort_foretag',[...state.ort.foretag].join(','));
  if(j.g){ state.lager=j.g; LS.set('lager',j.g); }
  if(j.l) LS.set('lang', j.l);
  if(j.t){ LS.set('tema',j.t); document.documentElement.setAttribute('data-theme',j.t); }
  if(j.x){ LS.set('text',j.x); document.documentElement.setAttribute('data-text',j.x); }
  if(j.f){ LS.set('font',j.f); document.documentElement.setAttribute('data-font',j.f); }
  return j.l || null;
}
/* delbar kod: kompakt base64url av inställnings-objektet */
function kodaInst(){
  try { return btoa(unescape(encodeURIComponent(JSON.stringify(samlaInst())))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
  catch(e){ return ''; }
}
function avkodaInst(kod){
  try { return applyInst(JSON.parse(decodeURIComponent(escape(atob(kod.replace(/-/g,'+').replace(/_/g,'/')))))); }
  catch(e){ return null; }
}

/* ── Konto (overifierat) – spara inställningar via Netlify Function ── */
function kontoT(){ const s=sitT(); return s; }
async function api(action, body){
  try {
    const r=await fetch('/.netlify/functions/konto',{method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({action, ...body})});
    return await r.json();
  } catch(e){ return {error:'natverk'}; }
}
let _sparTimer=null;
function autospar(){
  if(!state.konto.token) return;
  clearTimeout(_sparTimer);
  _sparTimer=setTimeout(()=>{ api('spara',{namn:state.konto.namn, token:state.konto.token, settings:samlaInst()}); }, 1200);
}
function renderKonto(){
  const el=$('#konto'); if(!el) return; const u=ui();
  const k=(u.konto)||UIDEF.konto;
  if(state.konto.namn){
    el.innerHTML=`<div class="konto-in">${esc(k.inloggad)} <b>${esc(state.konto.namn)}</b></div>
      <button class="konto-btn" id="k-ut">${esc(k.logga_ut)}</button>`;
    $('#k-ut').addEventListener('click', loggaUt);
  } else {
    el.innerHTML=`<div class="konto-lbl">${esc(k.rubrik)}</div>
      <input id="k-namn" placeholder="${esc(k.namn)}" autocomplete="username">
      <input id="k-losen" type="password" placeholder="${esc(k.losen)}" autocomplete="current-password">
      <div class="konto-rad"><button class="konto-btn primar" id="k-in">${esc(k.logga_in)}</button>
        <button class="konto-btn" id="k-ny">${esc(k.skapa)}</button></div>
      <p class="konto-hint">${esc(k.glomt)}</p><p class="konto-fel" id="k-fel"></p>`;
    $('#k-in').addEventListener('click',()=>kontoAuth('login'));
    $('#k-ny').addEventListener('click',()=>kontoAuth('register'));
  }
}
async function kontoAuth(action){
  const namn=$('#k-namn').value.trim(), losen=$('#k-losen').value;
  const fel=$('#k-fel'); const k=(ui().konto)||UIDEF.konto;
  if(!namn||!losen){ if(fel) fel.textContent=k.fyll; return; }
  if(fel) fel.textContent='…';
  const r=await api(action,{namn, losen, settings:samlaInst()});
  if(r.error){ if(fel) fel.textContent={finns:k.finns,fel:k.felinlogg,kort:k.kort}[r.error]||k.felinlogg; return; }
  state.konto={namn:r.namn, token:r.token}; LS.set('konto',r.namn); LS.set('token',r.token);
  if(r.settings && Object.keys(r.settings).length) applyInst(r.settings);
  renderKonto();
  await loadLanguage(LS.get('lang', state.lang));   // applicera ev. nytt språk + rendera om allt
}
function loggaUt(){ state.konto={namn:null,token:null}; LS.set('konto',''); LS.set('token',''); renderKonto(); uppdateraFb(); }

/* ── Feedback (för konton i allowlisten data/feedback_konton.json) ── */
async function apiFn(fn, body){
  try { const r=await fetch('/.netlify/functions/'+fn,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}); return await r.json(); }
  catch(e){ return {error:'natverk'}; }
}
function fbBehorig(){
  return !!state.konto.namn && (state.fbKonton||[]).some(s=>String(s).toLowerCase()===state.konto.namn.toLowerCase());
}
function uppdateraFb(){
  const btn=$('#fb-btn'); if(!btn) return;
  const k=(ui().fb)||UIDEF.fb;
  btn.textContent='💬 '+k.knapp;
  btn.classList.toggle('hidden', !fbBehorig());
}
function openFb(){
  const k=(ui().fb)||UIDEF.fb; const m=$('#fb-modal');
  m.innerHTML=`<div class="fb-box"><h2>${esc(k.titel)}</h2>
    <textarea id="fb-text" rows="6" placeholder="${esc(k.ph)}"></textarea>
    <div class="fb-rad"><button class="fb-avbryt" id="fb-avbryt">${esc(k.avbryt)}</button>
      <button class="fb-skicka primar" id="fb-skicka">${esc(k.skicka)}</button></div>
    <p class="fb-status" id="fb-status"></p></div>`;
  m.classList.remove('hidden'); $('#fb-text').focus();
  $('#fb-avbryt').addEventListener('click', stangFb);
  m.addEventListener('click', e=>{ if(e.target===m) stangFb(); });
  $('#fb-skicka').addEventListener('click', skickaFb);
}
function stangFb(){ $('#fb-modal').classList.add('hidden'); $('#fb-modal').innerHTML=''; }
async function skickaFb(){
  const k=(ui().fb)||UIDEF.fb; const t=($('#fb-text').value||'').trim(); const st=$('#fb-status');
  if(!t){ $('#fb-text').focus(); return; }
  st.textContent='…';
  const r=await apiFn('feedback',{action:'skicka', namn:state.konto.namn, token:state.konto.token, text:t, lang:state.lang, url:location.href});
  if(r && r.ok){ st.textContent=k.tack; setTimeout(stangFb,1300); }
  else { st.textContent=k.fel; }
}

/* mobil off-canvas */
function openDrawer(){ $('#layout').classList.add('filter-open'); $('#backdrop').classList.remove('hidden'); $('#filter-toggle').setAttribute('aria-expanded','true'); }
function closeDrawer(){ $('#layout').classList.remove('filter-open'); $('#backdrop').classList.add('hidden'); $('#filter-toggle').setAttribute('aria-expanded','false'); }

async function boot(){
  const sp=new URLSearchParams(location.search);
  let kodLang=null;
  if(sp.get('s')){ kodLang=avkodaInst(sp.get('s')); history.replaceState(null,'',location.pathname); }
  if(!state.axlar.size) LS.get('axlar','').split('.').filter(Boolean).forEach(x=>state.axlar.add(x));
  if(!state.typer.size) LS.get('typer','').split('.').filter(Boolean).forEach(x=>state.typer.add(x));
  state.lager = LS.get('lager','privat');
  initPrefAttrs();
  try { const ax=await getJSON('data/axlar.json'); state.axdef=ax.axlar||[]; state.grupper=ax.grupper||[]; state.gruppnamn=ax.gruppnamn||{}; state.lagernamn=ax.lagernamn||{}; } catch(e){}
  try { state.orter=await getJSON('data/orter.json'); } catch(e){}
  try { state.fbKonton=await getJSON('data/feedback_konton.json'); } catch(e){ state.fbKonton=[]; }
  ['privat','foretag'].forEach(l=> LS.get('ort_'+l,'').split(',').filter(Boolean).forEach(s=>state.ort[l].add(s)));
  // konto: hämta sparade inställningar (om inloggad och ingen delbar kod i URL)
  state.konto.namn=LS.get('konto','')||null; state.konto.token=LS.get('token','')||null;
  if(!kodLang && state.konto.token){
    const r=await api('load',{namn:state.konto.namn, token:state.konto.token});
    if(r && r.ok){ if(r.settings && Object.keys(r.settings).length){ const cl=applyInst(r.settings); if(cl) kodLang=cl; } }
    else { state.konto={namn:null,token:null}; LS.set('konto',''); LS.set('token',''); }
  }

  $('#tema').addEventListener('change', e=>{ document.documentElement.setAttribute('data-theme', e.target.value); LS.set('tema', e.target.value); autospar(); });
  $('#text').addEventListener('change', e=>{ document.documentElement.setAttribute('data-text', e.target.value); LS.set('text', e.target.value); autospar(); });
  $('#font').addEventListener('change', e=>{ document.documentElement.setAttribute('data-font', e.target.value); LS.set('font', e.target.value); autospar(); });
  $('#sok').addEventListener('input', e=>{ state.query=e.target.value.trim().toLowerCase(); state.visa=PAGE; refresh(); });
  $('#filter-sok').addEventListener('input', e=>{ state.filterQ=e.target.value.trim(); renderSidebar(); });
  $('#filter-toggle').addEventListener('click', openDrawer);
  $('#side-close').addEventListener('click', closeDrawer);
  $('#backdrop').addEventListener('click', closeDrawer);
  $('#side-apply').addEventListener('click', closeDrawer);
  $('#side-clear').addEventListener('click', clearSit);
  $('#side-share').addEventListener('click', ()=>{ const b=$('#share-box'); const open=b.classList.toggle('hidden')===false; if(open) renderShareBox(); $('#side-share').setAttribute('aria-expanded', open); });
  window.addEventListener('hashchange', route);
  $('#omlank').addEventListener('click', ()=>{ location.hash='om'; });
  $('#fb-btn').addEventListener('click', openFb);

  try { state.sprak=await getJSON('data/sprak.json'); } catch(e){ state.sprak=[{kod:'sv',namn:'Svenska',rtl:false}]; }
  const sel=$('#lang');
  sel.innerHTML=state.sprak.map(s=>`<option value="${s.kod}">${esc(s.namn)}</option>`).join('');
  const saved=kodLang || LS.get('lang', state.sprak[0].kod);
  sel.value=state.sprak.some(s=>s.kod===saved)?saved:state.sprak[0].kod;
  sel.addEventListener('change', ()=>{ LS.set('lang', sel.value); loadLanguage(sel.value); });

  await loadLanguage(sel.value);
  route();
}

async function loadLanguage(lang){
  state.lang=lang;
  const meta=state.sprak.find(s=>s.kod===lang)||{rtl:false};
  document.documentElement.lang=lang;
  document.documentElement.dir=meta.rtl?'rtl':'ltr';
  try { state.ui=await getJSON(`data/ui.${lang}.json`); }
  catch(e){ try { state.ui=await getJSON('data/ui.en.json'); } catch(_){ state.ui=UIDEF; } }
  try { state.about=await getJSON(`data/about.${lang}.json`); }
  catch(e){ try { state.about=await getJSON('data/about.en.json'); } catch(_){ state.about={}; } }
  if(!state.status){ try { state.status=await getJSON('data/status.json'); } catch(e){ state.status=null; } }
  state.sok = /[?&]sok=1/.test(location.search) || LS.get('sok','')==='1';   // serverside-sök (skalning), default av
  try { state.tags=await getJSON(`data/tags.${lang}.json`); } catch(e){ state.tags={}; }
  if(!state.sok){    // klientläge: ladda hela indexet (serverläge hämtar via sok, faller tillbaka vid fel)
    try { state.index=await getJSON(`data/index.${lang}.json`); } catch(e){ state.index=[]; }
  }
  applyUI(); buildSettings();
  await refresh();
}

function matches(a, ignoreTyp){
  if(!ignoreTyp && state.typer.size && !state.typer.has(a.typ||'nyhet')) return false;
  if(state.query){
    const hay=(a.titel+' '+(a.ingress||'')+' '+(a.taggar||[]).map(id=>(state.tags[id]||{}).etikett||id).join(' ')).toLowerCase();
    for(const w of state.query.split(/\s+/)) if(w && !hay.includes(w)) return false;
  }
  if(a.typ==='kommunbeslut' && ortFor().size){               // plats: bara mina kommuner
    const k=artKommun(a); if(!k || !ortFor().has(k)) return false;
  }
  if(state._akt.length && !SIT_FRI.has(a.typ||'nyhet') && relScore(a) < 1) return false;   // situationsfilter (ej historia/nyheter)
  return true;
}
function relNiv(r){ return r>=7?3:r>=4?2:r>=1?1:0; }   // 0-10 score → 1-3 prickar
function relMark(a){
  const lvl=relNiv(relScore(a)); if(!lvl) return '';
  const niv=[sitT().low,sitT().mid,sitT().high][lvl-1]||'';
  return `<span class="rel rel${lvl}" title="${esc(sitT().affects)}: ${esc(niv)}">${'●'.repeat(lvl)}${'○'.repeat(3-lvl)}</span>`;
}
/* Trovärdighets-badges (historia + triangulerade nyheter): säkerhet + ev. källäge/konsensus + flaggor.
   full=true på detaljsidan (med etiketter), false = kompakt rad på kortet. */
function renderTrov(a, full){
  if(!a.sakerhet) return '';
  const t=ui().trov||{};
  const lbl=(grp,k)=>((t[grp]||{})[k]||k);
  const sak=`<span class="trov-sak sak-${esc(a.sakerhet)}">${esc(lbl('sakerhet',a.sakerhet))}</span>`;
  const flaggor=(a.flaggor||[]).map(f=>
    `<span class="trov-flagg" title="${esc(lbl('flagg',f))}">${FLAGG_IK[f]||'•'}${full?' '+esc(lbl('flagg',f)):''}</span>`).join('');
  if(!full) return `<span class="trov-rad">${sak}${flaggor}</span>`;
  const kl=a.kallage?`<span class="trov-meta">${esc((t.kallage||{}).label||'')}: <b>${esc(lbl('kallage',a.kallage))}</b></span>`:'';
  const ko=a.konsensus?`<span class="trov-meta">${esc((t.konsensus||{}).label||'')}: <b>${esc(lbl('konsensus',a.konsensus))}</b></span>`:'';
  return `<div class="trov">${sak}${kl}${ko}${flaggor?`<div class="trov-flaggor">${flaggor}</div>`:''}</div>`;
}
/* Vinkel-klass för lutnings-färg (parsar lutningstexten). */
function leanKlass(txt){ txt=(txt||'').toLowerCase();
  if(txt.includes('vänster')) return txt.includes('center')?'l-cv':'l-v';
  if(txt.includes('höger')||txt.includes('näringsliv')) return txt.includes('center')?'l-ch':'l-h';
  return 'l-m'; }
/* Källjämförelse-panel: triangulering över flera källor (vinkel + samsyn/divergens). */
function renderJamforelse(a){
  const t=a.triangulering; if(!t) return '';
  const j=ui().jamf||{};
  const sk=(j.statskontroll||{});
  const chips=(t.kallor||[]).map(k=>`<span class="jamf-kalla ${leanKlass(k.lutning)}">`+
    `${k.land&&LAND_FLAGGA[k.land]?LAND_FLAGGA[k.land]+' ':''}`+
    `${k.url?`<a href="${esc(k.url)}" target="_blank" rel="noopener">${esc(k.kalla)}</a>`:esc(k.kalla)}`+
    `${k.lutning?`<small>${esc(k.lutning)}</small>`:''}`+
    `${k.partisk?' <span class="jamf-partisk" title="'+esc(j.partisk||'partisk')+'">◆</span>':''}`+
    `${k.statskontroll&&k.statskontroll!=='oberoende'?` <span class="jamf-sk" title="${esc(sk[k.statskontroll]||k.statskontroll)}">⚑ ${esc(sk[k.statskontroll]||k.statskontroll)}</span>`:''}</span>`).join('');
  const nLand=new Set((t.kallor||[]).map(k=>k.land).filter(Boolean)).size;
  const block=(arr,lbl,kl)=>(arr&&arr.length)?`<div class="jamf-block ${kl||''}"><h4>${esc(lbl)}</h4><ul>${arr.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:'';
  const vinklar=(t.vinkel_per_kalla&&Object.keys(t.vinkel_per_kalla).length)
    ?`<div class="jamf-block"><h4>${esc(j.vinkel||'')}</h4>${Object.entries(t.vinkel_per_kalla).map(([k,v])=>`<p class="jamf-v"><b>${esc(k)}:</b> ${esc(v)}</p>`).join('')}</div>`:'';
  const konf=t.konfidens?`<span class="jamf-konf k-${esc(t.konfidens)}">${esc((j.konf_niv||{})[t.konfidens]||t.konfidens)}</span>`:'';
  return `<div class="jamf">
    <div class="jamf-h">⚖ ${esc(j.rubrik||'Källjämförelse')} · ${(t.kallor||[]).length} ${esc(j.kallor||'källor')}${nLand>1?` · ${nLand} ${esc(j.lander||'länder')}`:''}${konf?` · ${esc(j.konfidens||'')} ${konf}`:''}</div>
    <div class="jamf-kallor">${chips}</div>
    ${block(t.samstammigt, j.samstammigt||'', 'ok')}
    ${block(t.divergenser, j.divergenser||'', '')}
    ${block(t.enkalligt, j.enkalligt||'', 'warn')}
    ${vinklar}
    ${t.bedomning?`<div class="jamf-bedomning">${esc(t.bedomning)}</div>`:''}
  </div>`;
}
/* ── Serverside-sök (skalning): klienten slipper ladda hela indexet ──
   sokQS bygger query; sokHamta hämtar; refresh() är server-medveten men beter
   sig EXAKT som förr när state.sok=false (default). Faller tillbaka till klient-
   filter om funktionen inte svarar. */
function sokQS(page){
  const p=new URLSearchParams(); p.set('lang', state.lang||'sv');
  if(state.typer.size) p.set('typer',[...state.typer].join(','));
  const akt=aktivaAxlar(); if(akt.length) p.set('akt',akt.join(','));
  const ort=ortFor(); if(ort.size) p.set('ort',[...ort].join(','));
  if(state.query) p.set('q',state.query);
  p.set('page',page); p.set('ps',PAGE); return p.toString();
}
async function sokHamta(page){
  try{ const r=await fetch('/.netlify/functions/sok?'+sokQS(page)); if(!r.ok) return null; return await r.json(); }
  catch(e){ return null; }
}
async function refresh(reset=true){
  if(state.sok){
    const page = reset ? 0 : ((state.srv&&state.srv._page||0)+1);
    const d = await sokHamta(page);
    if(!d){                                  // fallback → klientläge (laddar index vid behov)
      state.sok=false;
      if(!state.index.length){ try{ state.index=await getJSON('data/index.'+state.lang+'.json'); }catch(e){} }
      renderSidebar(); renderList(); return;
    }
    if(reset||!state.srv) state.srv={results:d.results,total:d.total,facets:d.facets,_page:0};
    else { state.srv.results=state.srv.results.concat(d.results); state.srv._page=page; state.srv.total=d.total; }
    renderSidebar(); renderList(); return;
  }
  renderSidebar(); renderList();
}
function renderList(){
  const u=ui();
  state._akt=aktivaAxlar();
  let items, total, vis, mer;
  if(state.sok && state.srv){                 // serverläge: redan filtrerat + paginerat
    items=state.srv.results; total=state.srv.total; vis=items; mer=total>items.length;
  } else {
    items=state.index.filter(matches);
    if(state._akt.length){       // re-ranka på relevans (stabilt, behåll datum vid lika)
      items=items.map((a,i)=>[a,i]).sort((A,B)=>(relScore(B[0])-relScore(A[0]))||(A[1]-B[1])).map(x=>x[0]);
    } else if(state.typer.size===1 && state.typer.has('historia')){   // historia: kronologisk tidslinje
      const eo=k=>{const i=EPOK_ORDER.indexOf(k); return i<0?99:i;};
      items=items.slice().sort((a,b)=>eo(a.epok)-eo(b.epok));
    }
    total=items.length; vis=items.slice(0, state.visa); mer=items.length>state.visa;
  }
  $('#count').textContent=`${total} ${u.count}`;
  const ap=$('#side-apply'); if(ap) ap.textContent=`${sitT().apply} ${total} ${u.count}`;
  $('#list').innerHTML=(vis.length ? vis.map(a=>{
    return `<button class="card ${KORT_KLASS[a.typ]||''}" data-id="${esc(a.id)}">
      <span class="toprow"><span class="badge-typ ${BADGE_KLASS[a.typ]||''}">${esc((u.typebadge[a.typ]||u.typebadge.nyhet))}</span>${a.tri?'<span class="badge-tri" title="⚖">⚖</span>':''}${a.typ==='historia'?renderTrov(a,false):relMark(a)}<span class="date">${a.typ==='historia'?esc([(u.epoknamn||{})[a.epok],a.tid].filter(Boolean).join(' · ')):esc(a.datum||'')}</span></span>
      <h2>${esc(a.titel)}</h2>
      <p>${esc(a.ingress||'')}</p>
      ${a.kalla?`<span class="src">${esc(u.kalla)}: <b>${esc(a.kalla)}</b></span>`:''}
      <span class="tags">${(a.taggar||[]).slice(0,5).map(id=>`<span>${esc((state.tags[id]||{}).etikett||id)}</span>`).join('')}</span>
    </button>`; }).join('') : `<div class="empty">${esc(u.none)}</div>`)
    + (mer ? `<button class="loadmore">${esc(u.loadmore||'Ladda fler')} (${total-vis.length})</button>` : '');
  $('#list').querySelectorAll('.card').forEach(c=>c.addEventListener('click',()=>{ location.hash='a/'+c.dataset.id; }));
  const lm=$('#list').querySelector('.loadmore');
  if(lm) lm.addEventListener('click',()=>{ if(state.sok){ refresh(false); } else { state.visa+=PAGE; renderList(); } });
}

const LISTVY=['.meta-row','#list'];
function stangOverlay(){ ['#article','#about'].forEach(s=>$(s).classList.add('hidden')); LISTVY.forEach(s=>$(s).classList.remove('hidden')); }
function route(){
  const m=location.hash.match(/^#a\/(.+)$/);
  if(m) openArticle(decodeURIComponent(m[1]));
  else if(location.hash==='#om') openAbout();
  else stangOverlay();
}
function statusHTML(){
  const s=state.status; if(!s) return '';
  const u=ui(); const st=(u.status)||UIDEF.status;
  let fresh=true;
  if(s.uppdaterad){ const d=new Date(s.uppdaterad); if(!isNaN(d)) fresh=(Date.now()-d.getTime())<36*3600*1000; }
  const big=(n,lbl)=>`<div class="stat-big"><b>${n}</b><span>${esc(lbl)}</span></div>`;
  const typer=TYPER.filter(t=>(s.per_typ||{})[t]).map(t=>
    `<span class="stat-typ ${BADGE_KLASS[t]||''}">${esc((u.types&&u.types[t])||t)} <b>${s.per_typ[t]}</b></span>`).join('');
  const namn=k=>(state.sprak.find(x=>x.kod===k)||{}).namn||k;
  const ps=s.per_sprak||{}; const max=Math.max(1,...Object.values(ps));
  const bars=Object.entries(ps).map(([k,n])=>
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
  const a=state.about||{}; const el=$('#about');
  el.innerHTML=`<button class="back">${esc(ui().back)}</button><h1>${esc(a.title||'')}</h1>${a.body||''}${statusHTML()}`;
  el.querySelector('.back').addEventListener('click',()=>{ location.hash=''; });
  LISTVY.forEach(s=>$(s).classList.add('hidden')); $('#article').classList.add('hidden'); closeDrawer();
  el.classList.remove('hidden'); el.focus(); window.scrollTo(0,0);
}
async function openArticle(id){
  let a; try { a=await getJSON(`data/artikel/${id}.${state.lang}.json`); } catch(e){ location.hash=''; return; }
  const u=ui(); const el=$('#article');
  const layered=a.tldr||a.lattlast;
  const tldr=a.tldr?`<div class="tldr"><span class="lbl">${esc(u.tldr_label||'TL;DR')}</span>${esc(a.tldr)}</div>`:'';
  const latt=a.lattlast?`<div class="lattlast">${u.lattlast_label?`<div class="layer-h">${esc(u.lattlast_label)}</div>`:''}${a.lattlast}</div>`:'';
  const full=a.html?(layered
      ?`<details class="fulltext"><summary>${esc(u.fulltext_label||'')}</summary><div class="body">${a.html}</div></details>`
      :`<div class="body">${a.html}</div>`):'';
  el.innerHTML=`<button class="back">${esc(u.back)}</button>
    <span class="badge-typ ${BADGE_KLASS[a.typ]||''}">${esc(u.typebadge[a.typ]||u.typebadge.nyhet)}</span>
    <h1>${esc(a.titel)}</h1>
    ${renderTrov(a,true)}
    <div class="source"><span class="lbl">${esc(u.kalla)}</span> <b>${esc(a.kalla||'—')}</b>
      ${a.kalla_url?`<a href="${esc(a.kalla_url)}" target="_blank" rel="noopener">${esc(u.original)} ${esc(a.kalla||'')} →</a>`:''}
      <span style="font-size:.78rem;color:var(--txt3);flex-basis:100%">${esc(a.typ==='historia'?(a.tid||''):(a.datum||''))}</span></div>
    ${renderJamforelse(a)}${tldr}${latt}${full}
    ${a.kalla_url?`<div class="source-foot">${esc(u.original)} <a href="${esc(a.kalla_url)}" target="_blank" rel="noopener">${esc(a.kalla||a.kalla_url)}</a>.</div>`:''}`;
  el.querySelector('.back').addEventListener('click',()=>{ location.hash=''; });
  LISTVY.forEach(s=>$(s).classList.add('hidden')); $('#about').classList.add('hidden'); closeDrawer();
  el.classList.remove('hidden'); el.focus(); window.scrollTo(0,0);
}
boot();
