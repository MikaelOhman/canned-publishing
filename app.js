/* Canned Publishing – klientlogik. Statisk, läser JSON, allt i minnet => snabbt. */
'use strict';
const $ = s => document.querySelector(s);
const LS = { get:(k,d)=>localStorage.getItem('cp_'+k)||d, set:(k,v)=>localStorage.setItem('cp_'+k,v) };
const state = { lang:null, sprak:[], index:[], tags:{}, active:new Set(), query:'', typ:'alla' };

const T = {
  sv:{count:n=>`${n} träffar`, none:'Inga träffar.', clear:'Rensa filter', back:'← Tillbaka',
      kalla:'Källa', original:'Läs originalet hos', alla:'Alla', nyheter:'Nyheter', lag:'Lagförslag',
      typ:{nyhet:'Nyhet', lagforslag:'Lagförslag'}},
  en:{count:n=>`${n} results`, none:'No matches.', clear:'Clear filters', back:'← Back',
      kalla:'Source', original:'Read the original at', alla:'All', nyheter:'News', lag:'Bills',
      typ:{nyhet:'News', lagforslag:'Bill'}},
  de:{count:n=>`${n} Treffer`, none:'Keine Treffer.', clear:'Filter löschen', back:'← Zurück',
      kalla:'Quelle', original:'Zum Original bei', alla:'Alle', nyheter:'Nachrichten', lag:'Gesetzentwürfe',
      typ:{nyhet:'Nachricht', lagforslag:'Gesetzentwurf'}},
};
const t = () => T[state.lang] || T.en;
const typLabel = typ => (t().typ[typ] || typ);

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
    $('#'+id).addEventListener('change', e=>{ document.documentElement.setAttribute(attr, e.target.value); LS.set(id, e.target.value); });
  });
}

async function getJSON(url){ const r = await fetch(url); if(!r.ok) throw new Error(url); return r.json(); }

async function boot(){
  initPrefs();
  try { state.sprak = await getJSON('data/sprak.json'); } catch(e){ state.sprak = [{kod:'sv',namn:'Svenska',rtl:false}]; }
  const sel = $('#lang');
  sel.innerHTML = state.sprak.map(s=>`<option value="${s.kod}">${esc(s.namn)}</option>`).join('');
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
  document.documentElement.lang = lang;
  try {
    state.index = await getJSON(`data/index.${lang}.json`);
    state.tags  = await getJSON(`data/tags.${lang}.json`);
  } catch(e){ state.index = []; state.tags = {}; }
  renderTypeFilter(); renderFilters(); renderList();
}

/* typ-filter: Alla / Nyheter / Lagförslag */
function renderTypeFilter(){
  const c = { alla: state.index.length,
    nyhet: state.index.filter(a=>a.typ!=='lagforslag').length,
    lagforslag: state.index.filter(a=>a.typ==='lagforslag').length };
  const opt = [['alla',t().alla,c.alla],['nyhet',t().nyheter,c.nyhet],['lagforslag',t().lag,c.lagforslag]];
  $('#typefilter').innerHTML = opt.map(([v,lbl,n])=>
    `<button class="tf" data-typ="${v}" aria-pressed="${state.typ===v}">${esc(lbl)} (${n})</button>`).join('');
  $('#typefilter').querySelectorAll('.tf').forEach(b=>b.addEventListener('click',()=>{ state.typ=b.dataset.typ; renderTypeFilter(); renderList(); }));
}

const TYP_ORD = ['ämne','plats','person','organisation','händelse'];
function renderFilters(){
  const groups = {};
  Object.entries(state.tags).forEach(([id,info])=>{ (groups[info.typ]=groups[info.typ]||[]).push([id,info]); });
  const order = [...TYP_ORD.filter(x=>groups[x]), ...Object.keys(groups).filter(x=>!TYP_ORD.includes(x))];
  $('#filters').innerHTML = order.map(typ=>{
    const chips = groups[typ].sort((a,b)=>(b[1].antal||0)-(a[1].antal||0)).map(([id,info])=>
      `<button class="chip" aria-pressed="${state.active.has(id)}" data-tag="${id}">${esc(info.etikett)} <span class="n">${info.antal||''}</span></button>`).join('');
    return `<div class="filt-group"><h3>${esc(typ)}</h3><div class="chips">${chips}</div></div>`;
  }).join('');
  $('#filters').querySelectorAll('.chip').forEach(c=>c.addEventListener('click',()=>toggleTag(c.dataset.tag)));
}
function toggleTag(id){ state.active.has(id)?state.active.delete(id):state.active.add(id); renderFilters(); renderList(); }
function renderActivebar(){
  const bar = $('#activebar');
  if(!state.active.size){ bar.innerHTML=''; return; }
  const names = [...state.active].map(id=>esc((state.tags[id]||{}).etikett||id)).join(', ');
  bar.innerHTML = `<span>${names}</span><button class="clear">${t().clear}</button>`;
  bar.querySelector('.clear').addEventListener('click',()=>{ state.active.clear(); renderFilters(); renderList(); });
}

function matches(a){
  if(state.typ==='nyhet' && a.typ==='lagforslag') return false;
  if(state.typ==='lagforslag' && a.typ!=='lagforslag') return false;
  for(const id of state.active) if(!(a.taggar||[]).includes(id)) return false;
  if(state.query){
    const hay = (a.titel+' '+(a.taggar||[]).map(id=>(state.tags[id]||{}).etikett||id).join(' ')).toLowerCase();
    if(!hay.includes(state.query)) return false;
  }
  return true;
}
function renderList(){
  renderActivebar();
  const items = state.index.filter(matches);
  $('#count').textContent = t().count(items.length);
  $('#list').innerHTML = items.length ? items.map(a=>{
    const lag = a.typ==='lagforslag';
    return `<button class="card ${lag?'lagforslag':''}" data-id="${esc(a.id)}">
      <span class="toprow"><span class="badge-typ ${lag?'lag':''}">${esc(typLabel(a.typ||'nyhet'))}</span><span class="date">${esc(a.datum||'')}</span></span>
      <h2>${esc(a.titel)}</h2>
      <p>${esc(a.ingress||'')}</p>
      ${a.kalla?`<span class="src">${t().kalla}: <b>${esc(a.kalla)}</b></span>`:''}
      <span class="tags">${(a.taggar||[]).slice(0,5).map(id=>`<span>${esc((state.tags[id]||{}).etikett||id)}</span>`).join('')}</span>
    </button>`; }).join('') : `<div class="empty">${t().none}</div>`;
  $('#list').querySelectorAll('.card').forEach(c=>c.addEventListener('click',()=>{ location.hash='a/'+c.dataset.id; }));
}

function route(){ const m = location.hash.match(/^#a\/(.+)$/); if(m) openArticle(decodeURIComponent(m[1])); else closeArticle(); }
async function openArticle(id){
  let a; try { a = await getJSON(`data/artikel/${id}.${state.lang}.json`); } catch(e){ location.hash=''; return; }
  const meta = state.sprak.find(s=>s.kod===state.lang)||{rtl:false};
  const lag = a.typ==='lagforslag';
  const el = $('#article'); el.dir = meta.rtl ? 'rtl':'ltr';
  el.innerHTML = `<button class="back">${t().back}</button>
    <span class="badge-typ ${lag?'lag':''}">${esc(typLabel(a.typ||'nyhet'))}</span>
    <h1>${esc(a.titel)}</h1>
    <div class="source"><span class="lbl">${t().kalla}</span> <b>${esc(a.kalla||'—')}</b>
      ${a.kalla_url?`<a href="${esc(a.kalla_url)}" target="_blank" rel="noopener">${t().original} ${esc(a.kalla||'')} →</a>`:''}
      <span style="font-size:.78rem;color:var(--txt3);flex-basis:100%">${esc(a.datum||'')}</span></div>
    <div class="body">${a.html||''}</div>
    ${a.kalla_url?`<div class="source-foot">${t().original} <a href="${esc(a.kalla_url)}" target="_blank" rel="noopener">${esc(a.kalla||a.kalla_url)}</a>.</div>`:''}`;
  el.querySelector('.back').addEventListener('click',()=>{ location.hash=''; });
  ['#typefilter','#filters','#activebar','.meta-row','#list'].forEach(s=>$(s).classList.add('hidden'));
  el.classList.remove('hidden'); el.focus(); window.scrollTo(0,0);
}
function closeArticle(){
  $('#article').classList.add('hidden');
  ['#typefilter','#filters','#activebar','.meta-row','#list'].forEach(s=>$(s).classList.remove('hidden'));
}
function esc(s){ return (s==null?'':''+s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
boot();
