/* Canned Publishing – klientlogik. Statisk, läser JSON, allt i minnet => snabbt.
   Fullt lokaliserad: ui.<lang>.json driver alla etiketter/menyer. RTL-stöd. */
'use strict';
const $ = s => document.querySelector(s);
const LS = { get:(k,d)=>localStorage.getItem('cp_'+k)||d, set:(k,v)=>localStorage.setItem('cp_'+k,v) };
const state = { lang:null, sprak:[], ui:{}, index:[], tags:{}, active:new Set(), query:'', typ:'alla' };

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
  tldr_label:"TL;DR",lattlast_label:"In plain language",fulltext_label:"Full text"};
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
  $('#ui-sub').textContent = u.sub;
  $('#lbl-search').textContent = u.search_label; $('#sok').placeholder = u.search_ph;
  $('#searchhelp').textContent = u.searchhelp || '';
  $('#lbl-settings').title = u.settings; $('#lbl-settings').setAttribute('aria-label', u.settings);
  $('#lbl-tema').textContent = u.theme; $('#lbl-text').textContent = u.textsize; $('#lbl-font').textContent = u.font;
  $('.langpick').title = u.language; $('#lang').setAttribute('aria-label', u.language);
}

async function boot(){
  initPrefAttrs();
  $('#tema').addEventListener('change', e=>{ document.documentElement.setAttribute('data-theme', e.target.value); LS.set('tema', e.target.value); });
  $('#text').addEventListener('change', e=>{ document.documentElement.setAttribute('data-text', e.target.value); LS.set('text', e.target.value); });
  $('#font').addEventListener('change', e=>{ document.documentElement.setAttribute('data-font', e.target.value); LS.set('font', e.target.value); });
  $('#sok').addEventListener('input', e=>{ state.query = e.target.value.trim().toLowerCase(); renderList(); });
  window.addEventListener('hashchange', route);

  try { state.sprak = await getJSON('data/sprak.json'); } catch(e){ state.sprak = [{kod:'sv',namn:'Svenska',rtl:false}]; }
  const sel = $('#lang');
  sel.innerHTML = state.sprak.map(s=>`<option value="${s.kod}">${esc(s.namn)}</option>`).join('');
  const saved = LS.get('lang', state.sprak[0].kod);
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
  $('#typefilter').querySelectorAll('.tf').forEach(b=>b.addEventListener('click',()=>{ state.typ=b.dataset.typ; renderTypeFilter(); renderList(); }));
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
function renderList(){
  const u = ui(); const items = state.index.filter(matches);
  $('#count').textContent = `${items.length} ${u.count}`;
  $('#list').innerHTML = items.length ? items.map(a=>{
    return `<button class="card ${KORT_KLASS[a.typ]||''}" data-id="${esc(a.id)}">
      <span class="toprow"><span class="badge-typ ${BADGE_KLASS[a.typ]||''}">${esc((u.typebadge[a.typ]||u.typebadge.nyhet))}</span><span class="date">${esc(a.datum||'')}</span></span>
      <h2>${esc(a.titel)}</h2>
      <p>${esc(a.ingress||'')}</p>
      ${a.kalla?`<span class="src">${esc(u.kalla)}: <b>${esc(a.kalla)}</b></span>`:''}
      <span class="tags">${(a.taggar||[]).slice(0,5).map(id=>`<span>${esc((state.tags[id]||{}).etikett||id)}</span>`).join('')}</span>
    </button>`; }).join('') : `<div class="empty">${esc(u.none)}</div>`;
  $('#list').querySelectorAll('.card').forEach(c=>c.addEventListener('click',()=>{ location.hash='a/'+c.dataset.id; }));
}

function route(){ const m = location.hash.match(/^#a\/(.+)$/); if(m) openArticle(decodeURIComponent(m[1])); else closeArticle(); }
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
  ['#typefilter','#searchhelp','.meta-row','#list'].forEach(s=>$(s).classList.add('hidden'));
  el.classList.remove('hidden'); el.focus(); window.scrollTo(0,0);
}
function closeArticle(){
  $('#article').classList.add('hidden');
  ['#typefilter','#searchhelp','.meta-row','#list'].forEach(s=>$(s).classList.remove('hidden'));
}
boot();
