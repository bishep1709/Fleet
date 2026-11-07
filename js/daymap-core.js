// «Карта дня» — the interactive mind map of the day. Shared by the SytBoard page (day.html, loaded as a
// file so the strict CSP holds) and the Claude artifact (inlined by backend/src/services/dailyMap.js).
// All text goes in via textContent.
(function(){
var M=null,map=null,wires=null;
var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function el(t,a,txt){var e=document.createElement(t);if(a)for(var k in a)e.setAttribute(k,a[k]);if(txt!=null)e.textContent=txt;return e}
function n(x){return Number(x).toLocaleString('uk-UA')}
var path=[];// the chain of opened nodes, root first
function hasMore(d){return (d.children&&d.children.length)||(d.detail&&(d.detail.lead||d.detail.blocks.length))}
function card(d,depth,selected,dimmed){
  var b=el('button',{type:'button','class':'card t-'+(d.tone||'neutral')+(selected?' on':'')+(dimmed?' dim':''),'aria-expanded':selected?'true':'false'});
  var l=el('div',{'class':'l'});l.appendChild(el('span',null,d.label));if(hasMore(d)&&d.tone!=='root')l.appendChild(el('i',{'aria-hidden':'true'},selected?'−':'+'));b.appendChild(l);
  if(d.value)b.appendChild(el('div',{'class':'v'},d.value));
  if(d.sub)b.appendChild(el('div',{'class':'s'},d.sub));
  b.addEventListener('click',function(){open(depth,d)});
  b.dataset.id=d.id;return b;
}
function open(depth,d){
  if(d.tone==='root'){var y0=window.pageYOffset;path=[M.root];render(1);window.scrollTo(0,y0);return}
  // Tapping the open block again closes it; another block at the same level replaces it.
  var y=window.pageYOffset;
  var closing=path[depth+1]&&path[depth+1].id===d.id;
  if(closing)path=path.slice(0,depth+1);else path=path.slice(0,depth+1).concat([d]);
  render(depth+1);
  // The rebuild must not move the page (it used to snap up); then glide down to what just opened.
  window.scrollTo(0,y);
  if(closing)return;
  var first=map.querySelector('[data-parent="'+CSS.escape(d.id)+'"]');// the new detail panel, or its row of children
  if(first){var r=first.getBoundingClientRect(),want=90;
    if(r.top>window.innerHeight*0.55||r.top<want-30)window.scrollTo({top:y+r.top-want,behavior:reduce?'auto':'smooth'})}
}
function blocks(D,box){
  if(D.lead)box.appendChild(el('p',null,D.lead));
  (D.blocks||[]).forEach(function(b){
    if(b.type==='p')box.appendChild(el('p',null,b.text));
    else if(b.type==='pre')box.appendChild(el('pre',{'class':'brief'},b.text));
    else if(b.type==='h')box.appendChild(el('h3',null,b.text));
    else if(b.type==='kpis'){var g=el('div',{'class':'kp'});b.items.forEach(function(i){var c=el('div');c.appendChild(el('span',null,i[0]));c.appendChild(el('b',null,i[1]));g.appendChild(c)});box.appendChild(g)}
    else if(b.type==='table'){if(!b.rows.length)return;var w=el('div',{'class':'tw'}),t=el('table'),th=el('thead'),hr=el('tr');b.head.forEach(function(x){hr.appendChild(el('th',null,x))});th.appendChild(hr);t.appendChild(th);var tb=el('tbody');b.rows.forEach(function(r){var tr=el('tr');r.forEach(function(x){tr.appendChild(el('td',null,x))});tb.appendChild(tr)});t.appendChild(tb);w.appendChild(t);box.appendChild(w)}
    else if(b.type==='list'){var ul=el('ul',{'class':'ls'});b.items.forEach(function(i){var li=el('li',null,i.text);if(i.sub)li.appendChild(el('small',null,i.sub));(i.links||[]).forEach(function(l,j){li.appendChild(document.createTextNode(' '));li.appendChild(el('a',{href:l,target:'_blank',rel:'noopener noreferrer'},'запис '+(j+1)))});ul.appendChild(li)});box.appendChild(ul)}
    else if(b.type==='bars'){var mx=0;b.items.forEach(function(i){mx=Math.max(mx,i.value)});b.items.forEach(function(i){var r=el('div',{'class':'br'});r.appendChild(el('span',null,i.label));var bar=el('div'),fill=el('i');fill.style.width=(mx?Math.max(1,i.value/mx*100):0)+'%';bar.appendChild(fill);r.appendChild(bar);r.appendChild(el('em',{'class':i.tone||''},i.note||n(i.value)));box.appendChild(r)});}
  });
}
function render(fromDepth){
  Array.prototype.slice.call(map.querySelectorAll('.row,.panel')).forEach(function(x){x.parentNode.removeChild(x)});
  // Row 0: the day.
  var r0=el('div',{'class':'row root'});r0.appendChild(card(M.root,-1,false,false));map.appendChild(r0);
  // Then, for each opened node: its detail (if any) and its children.
  path.forEach(function(d,i){
    var anim=i+1>=fromDepth&&!reduce;
    if(i>0&&d.detail&&(d.detail.lead||(d.detail.blocks||[]).length)){var p=el('section',{'class':'panel'+(anim?' enter':''),'data-parent':d.id});p.appendChild(el('h2',null,d.label));blocks(d.detail,p);map.appendChild(p)}
    if(d.children&&d.children.length){
      var row=el('div',{'class':'row'+(anim?' enter':''),'data-parent':d.id});
      var next=path[i+1];
      d.children.forEach(function(c){row.appendChild(card(c,i,next&&next.id===c.id,next&&next.id!==c.id))});
      map.appendChild(row);
    }
  });
  crumbs();
  requestAnimationFrame(drawWires);if(!reduce)setTimeout(drawWires,380);
}
// Curves from each opened block to the blocks (or panel) it opened.
function drawWires(){
  while(wires.firstChild)wires.removeChild(wires.firstChild);
  var base=map.getBoundingClientRect();
  map.querySelectorAll('[data-parent]').forEach(function(box){
    var pid=box.getAttribute('data-parent');var from=map.querySelector('.card[data-id="'+CSS.escape(pid)+'"]');if(!from)return;
    // Children under an open detail panel hang from the panel, not from the block behind it.
    var prev=box.previousElementSibling;if(!box.classList.contains('panel')&&prev&&prev.classList.contains('panel')&&prev.getAttribute('data-parent')===pid)from=prev;
    var a=from.getBoundingClientRect(),x0=a.left+a.width/2-base.left,y0=a.bottom-base.top;
    var targets=box.classList.contains('panel')?[box]:Array.prototype.slice.call(box.children);
    // Only the first line of a wrapped group gets wires; lines to lower lines would cut through blocks.
    var firstTop=Math.min.apply(null,targets.map(function(t){return t.getBoundingClientRect().top}));targets=targets.filter(function(t){return t.getBoundingClientRect().top<=firstTop+2});
    targets.forEach(function(t){var b=t.getBoundingClientRect(),x1=b.left+b.width/2-base.left,y1=b.top-base.top;if(y1<=y0)return;var my=(y0+y1)/2;
      var p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d','M'+x0+','+y0+' C'+x0+','+my+' '+x1+','+my+' '+x1+','+y1);wires.appendChild(p)});
  });
}
function crumbs(){
  var c=document.getElementById('crumbs');while(c.firstChild)c.removeChild(c.firstChild);
  if(path.length<2){c.appendChild(document.createTextNode('Натисніть на блок, щоб розкрити його'));return}
  path.forEach(function(d,i){if(i)c.appendChild(document.createTextNode(' › '));var b=el('button',{type:'button'},i?d.label:'День');b.addEventListener('click',function(){var y=window.pageYOffset;path=path.slice(0,i+1);render(i+1);window.scrollTo(0,y)});c.appendChild(b)});
}
var rt;window.addEventListener('resize',function(){if(map){clearTimeout(rt);rt=setTimeout(drawWires,120)}});
// Mount (or re-mount for another day) a day model built on the server (dailyMap.buildTree).
window.DayMap={mount:function(model){
  M=model;map=document.getElementById('map');wires=document.getElementById('wires');path=[M.root];map.style.overflowAnchor='none';
  var foot=document.getElementById('foot');
  if(foot)foot.textContent='Дані: BAS, Google Analytics, Google Ads, Search Console, Microsoft Clarity. Суми продажів без ПДВ (BAS), втрати з ПДВ (як на сайті). Звіт зібрано '+new Date(M.generatedAt).toLocaleString('uk-UA',{timeZone:'Europe/Kyiv'})+'.';
  render(1);
}};
})();
