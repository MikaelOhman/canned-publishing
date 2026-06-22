/* Canned Publishing – klientlogik. Statisk, läser JSON, allt i minnet => snabbt. */
'use strict';
const $ = s => document.querySelector(s);
const LS = { get:(k,d)=>localStorage.getItem('cp_'+k)||d, set:(k,v)=>localStorage.setItem('cp_'+k,v) };

const state = { lang:null, sprak:[], index:[], tags:{}, active:new Set(), query:'' };

const T = {  // UI-mikrotexter per språk (faller tillbaka på engelska)
  sv:{count:n=>`${n} nyheter`, none:'Inga träffar.', clear:'Rensa filter', back:'← Tillbaka', by:'Källa'},
  en:{count:n=>`${n} stories`, none:'No matches.', clear:'Clear filters', back:'← Back', by:'Source'},
  de:{count:n=>`${n} Meldungen`, none:'Keine Treffer.', clear:'Filter löschen', back:'← Zurück', by:'Quelle'},
};
const t = () => T[state.lang] || T.en;

/* ---------- inställningar (tema/text/typsnitt) ---------- */
function applyPref(attr, key, def){
  const v = LS.get(key, def);
  document.documentElement.setAttribute(attr, v);
  const el = $('#'+key); if(el) el.value = v;
}
function initPrefs(){
  applyPref('data-theme','tema','dark');
  applyPref('data-text','text','normal');
  applyPref('data-font','font','standard');
  [['tema','data-theme'],['text','data-text'],['font','data-font']].forEach(([id,attr])=>{
    $('#'+id).addEventListener('change', e=>{
      document.documentElement.setAttribute(attr, e.target.value); LS.set(id, e.target.value);
    });
  });
}

/* ---------- data ---------- */
async function getJSON(url){ const r = await fetch(url); if(!r.ok) throw new Error(url); return r.json(); }

async function boot(){
  initPrefs();
  try { state.sprak = await getJSON('data/sprak.json'); } catch(e){ state.sprak = [{kod:'sv',namn:'Svenska',rtl:false}]; }
  const sel = $('#lang');
  sel.innerHTML = state.sprak.map(s=>`<option value="${s.kod}">${s.namn}</option>`).join('');
  const saved = LS.get('lang', state.sprak[0].kod);
  sel.value = state.sprak.some(s=>s.kod===saved) ? saved : state.sprak[0].kod;
  sel.addEventListener('change', ()=>{ LS.set('lang', sel.value); loadLanguage(sel.value); });
  $('#sok').addEventListener('input', e=>{ state.query = e.target.value.trim().toLowerCase(); renderList(); });
  window.addEventListener('hashchange', route);
  await loadLanguage(sel.value);
  route();
}

async function loadLanguage(lang){
  state.lang = lang;
  const meta = state.sprak.find(s=>s.kod===lang) || {rtl:false};
  document.documentElement.lang = lang;
  try {
    state.index = await getJSON(`data/index.${lang}.json`);
    state.tags  = await getJSON(`data/tags.${lang}.json`);
  } catch(e){ state.index = []; state.tags = {}; }
  renderFilters(); renderList();
}

/* ---------- filter (taggar) ---------- */
const TYP_ORD = ['ämne','plats','person','organisation','händelse'];
function renderFilters(){
  const groups = {};
  Object.entries(state.tags).forEach(([id,info])=>{ (groups[info.typ]=groups[info.typ]||[]).push([id,info]); });
  const order = [...TYP_ORD.filter(x=>groups[x]), ...Object.keys(groups).filter(x=>!TYP_ORD.includes(x))];
  $('#filters').innerHTML = order.map(typ=>{
    const chips = groups[typ].sort((a,b)=>(b[1].antal||0)-(a[1].antal||0)).map(([id,info])=>
      `<button class="chip" role="button" aria-pressed="${state.active.has(id)}" data-tag="${id}">
        ${esc(info.etikett)} <span class="n">${info.antal||''}</span></button>`).join('');
    return `<div class="filt-group"><h3>${esc(typ)}</h3><div class="chips">${chips}</div></div>`;
  }).join('');
  $('#filters').querySelectorAll('.chip').forEach(c=>c.addEventListener('click',()=>toggleTag(c.dataset.tag)));
}
function toggleTag(id){ state.active.has(id)?state.active.delete(id):state.active.add(id);
  renderFilters(); renderList(); }
function renderActivebar(){
  const bar = $('#activebar');
  if(!state.active.size){ bar.innerHTML=''; return; }
  const names = [...state.active].map(id=>esc((state.tags[id]||{}).etikett||id)).join(', ');
  bar.innerHTML = `<span>${names}</span><button class="clear">${t().clear}</button>`;
  bar.querySelector('.clear').addEventListener('click',()=>{ state.active.clear(); renderFilters(); renderList(); });
}

/* ---------- lista + tagg-sök ---------- */
function matches(a){
  for(const id of state.active) if(!a.taggar.includes(id)) return false;   // AND
  if(state.query){
    const hay = (a.titel+' '+a.taggar.map(id=>(state.tags[id]||{}).etikett||id).join(' ')).toLowerCase();
    if(!hay.includes(state.query)) return false;
  }
  return true;
}
function renderList(){
  renderActivebar();
  const items = state.index.filter(matches);
  $('#count').textContent = t().count(items.length);
  $('#list').innerHTML = items.length ? items.map(a=>`
    <button class="card" data-id="${esc(a.id)}">
      <span class="date">${esc(a.datum||'')}</span>
      <h2>${esc(a.titel)}</h2>
      <p>${esc(a.ingress||'')}</p>
      <span class="tags">${(a.taggar||[]).slice(0,5).map(id=>`<span>${esc((state.tags[id]||{}).etikett||id)}</span>`).join('')}</span>
    </button>`).join('') : `<div class="empty">${t().none}</div>`;
  $('#list').querySelectorAll('.card').forEach(c=>c.addEventListener('click',()=>{ location.hash = 'a/'+c.dataset.id; }));
}

/* ---------- artikelvy + routing ---------- */
function route(){
  const m = location.hash.match(/^#a\/(.+)$/);
  if(m) openArticle(decodeURIComponent(m[1])); else closeArticle();
}
async function openArticle(id){
  let a; try { a = await getJSON(`data/artikel/${id}.${state.lang}.json`); }
  catch(e){ location.hash=''; return; }
  const meta = state.sprak.find(s=>s.kod===state.lang)||{rtl:false};
  const el = $('#article');
  el.dir = meta.rtl ? 'rtl' : 'ltr';
  el.innerHTML = `<button class="back">${t().back}</button>
    <h1>${esc(a.titel)}</h1>
    <div class="abymeta">${esc(a.datum||'')}${a.kalla?' · '+t().by+': '+esc(a.kalla):''}</div>
    <div class="body">${a.html||''}</div>`;
  el.querySelector('.back').addEventListener('click',()=>{ location.hash=''; });
  $('#filters').classList.add('hidden'); $('#activebar').classList.add('hidden');
  $('.meta-row').classList.add('hidden'); $('#list').classList.add('hidden');
  el.classList.remove('hidden'); el.focus(); window.scrollTo(0,0);
}
function closeArticle(){
  $('#article').classList.add('hidden');
  $('#filters').classList.remove('hidden'); $('#activebar').classList.remove('hidden');
  $('.meta-row').classList.remove('hidden'); $('#list').classList.remove('hidden');
}

function esc(s){ return (s==null?'':''+s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
boot();
