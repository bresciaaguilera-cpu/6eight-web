
(()=>{const KEY='68inspired_cart_v2';
const C=window.ShopCatalog;
const money=c=>(c/100).toLocaleString('es-ES',{style:'currency',currency:'EUR'});
const get=()=>{try{const a=JSON.parse(localStorage.getItem(KEY)||'[]');return [...new Set(a)].filter(x=>typeof x==="string"&&Object.hasOwn(C,x))}catch(e){return[]}};
const set=a=>{localStorage.setItem(KEY,JSON.stringify([...new Set(a)]));render()};
const base=a=>a.filter(x=>C[x]?.core).reduce((s,x)=>s+C[x].p,0);
const isFirst=()=>localStorage.getItem('68inspired_has_order')!=='1';
const rewards=b=>({mini:isFirst()&&b>0,spicy:b>=5000,d68:b>=6800});
const totals=a=>{const b=base(a),r=rewards(b);let subtotal=a.reduce((s,x)=>s+(x==='50-preguntas-picantes'&&r.spicy?0:C[x].p),0);let discount=r.d68?a.filter(x=>C[x].core).reduce((s,x)=>s+C[x].p-Math.round(C[x].p*.9),0):0;return{b,r,subtotal,discount,total:subtotal-discount}};
let overlay,drawer,bump,fab;
function inject(){if(document.getElementById('cartFab'))return;document.body.insertAdjacentHTML('beforeend',`
<button id="cartFab" aria-label="Abrir cesta">Cesta <span class="count">0</span></button>
<div id="cartOverlay"></div><aside id="cartDrawer" aria-label="Cesta"><div class="cart-head"><h2>Vuestra cesta</h2><button class="cart-close" aria-label="Cerrar">×</button></div><div class="cart-body"></div><div class="cart-foot"></div></aside>
<div id="bumpModal"><div class="bump-card"><span class="bump-tag">Antes de pagar</span><h3>¿Le ponemos un poco de chispa?</h3><p>Añade <strong>50 preguntas picantes para dos</strong>. Es un PDF exclusivo de esta cesta y, si llegáis a 50 € en productos, os sale gratis automáticamente.</p><div class="bump-price">Ahora por 4,95 €</div><div class="bump-actions"><button class="bump-yes">Sí, añadirlo</button><button class="bump-no">No, seguir al pago</button></div></div></div>
<div class="cart-toast" id="cartToast">Añadido a la cesta</div>`);
fab=document.getElementById('cartFab');overlay=document.getElementById('cartOverlay');drawer=document.getElementById('cartDrawer');bump=document.getElementById('bumpModal');
fab.onclick=()=>open(); overlay.onclick=close; drawer.querySelector('.cart-close').onclick=close; bump.querySelector('.bump-no').onclick=()=>{bump.classList.remove('open');goCheckout()}; bump.querySelector('.bump-yes').onclick=()=>{const a=get();if(!a.includes('50-preguntas-picantes'))a.push('50-preguntas-picantes');set(a);bump.classList.remove('open');goCheckout()};
document.addEventListener('click',e=>{const b=e.target.closest('[data-cart-add]');if(!b)return;e.preventDefault();add(b.dataset.cartAdd)});
render();}
function open(){drawer.classList.add('open');overlay.classList.add('open')}
function close(){drawer.classList.remove('open');overlay.classList.remove('open')}
function toast(){const t=document.getElementById('cartToast');t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1400)}
function add(id){if(!Object.hasOwn(C,id))return;const a=get();if(!a.includes(id))a.push(id);set(a);toast();open()}
function remove(id){set(get().filter(x=>x!==id))}
function rewardCopy(t){const b=t.b;if(b<5000)return [(isFirst()?'🎁 Regalo de bienvenida incluido. ':'')+'Te faltan '+money(5000-b)+' para llevarte también el PDF picante gratis.',b/6800*100];if(b<6800)return [(isFirst()?'🎁 Regalo de bienvenida + ':'')+'🔥 PDF picante desbloqueado. Te faltan '+money(6800-b)+' para el descuento 68.',b/6800*100];return ['✨ 68 desbloqueado: '+(isFirst()?'regalo de bienvenida + ':'')+'PDF picante + 10 % de descuento.',100]}
function render(){if(!fab)return;const a=get(),t=totals(a),body=drawer.querySelector('.cart-body'),foot=drawer.querySelector('.cart-foot');fab.querySelector('.count').textContent=a.length;
if(!a.length){body.innerHTML='<div class="cart-empty"><strong>La cesta está vacía.</strong><br>Una parada bonita puede empezar con un PDF.</div>';foot.innerHTML='';return}
const rc=rewardCopy(t);let gifts='';if(t.r.mini)gifts+='<div class="cart-gift"><span>🎁 12 mini citas</span><strong>GRATIS</strong></div>';if(t.r.spicy)gifts+='<div class="cart-gift"><span>🔥 50 preguntas picantes</span><strong>GRATIS</strong></div>';
body.innerHTML=a.map(id=>`<div class="cart-item"><div><strong>${C[id].n}</strong><small>${id==='50-preguntas-picantes'&&t.r.spicy?'Regalo desbloqueado':money(C[id].p)}</small></div><button class="cart-remove" data-remove="${id}">Quitar</button></div>`).join('')+`<div class="cart-rewards"><h3>La ruta del 68</h3><div class="reward-progress"><i style="width:${Math.min(100,rc[1])}%"></i></div><div class="reward ${t.r.mini?'unlocked':''}">🎁 Primer pedido · 12 mini citas GRATIS</div><div class="reward ${t.r.spicy?'unlocked':''}">50 € · 50 preguntas picantes gratis</div><div class="reward ${t.r.d68?'unlocked':''}">68 € · 10 % de descuento automático</div><p style="font-size:.78rem;margin:9px 0 0">${rc[0]}</p>${gifts}</div>`;
body.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>remove(b.dataset.remove));
foot.innerHTML=`<div class="cart-line"><span>Subtotal</span><span>${money(t.subtotal)}</span></div>${t.discount?'<div class="cart-line"><span>Descuento 68 (10 %)</span><span>-'+money(t.discount)+'</span></div>':''}<div class="cart-line total"><span>Total</span><span>${money(t.total)}</span></div><button class="cart-checkout">Continuar al pago</button><div class="cart-note">El regalo de bienvenida se incluye en el primer pedido desde este navegador. Los demás premios se activan automáticamente.</div>`;
foot.querySelector('.cart-checkout').onclick=checkout;}
function checkout(){const a=get(),t=totals(a);if(!t.b)return;if(t.b<5000&&!a.includes('50-preguntas-picantes')){bump.classList.add('open');return}goCheckout()}
async function goCheckout(){const a=get();if(!a.length)return;const btn=drawer.querySelector('.cart-checkout');if(btn){btn.disabled=true;btn.textContent='Preparando pago…'}try{const r=await fetch('/api/create-checkout-session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({productIds:a,welcomeGift:isFirst()})});const d=await r.json();if(!r.ok||!d.url)throw new Error(d.error||'No se pudo iniciar el pago');location.href=d.url}catch(e){alert(e.message||'No se pudo iniciar el pago');if(btn){btn.disabled=false;btn.textContent='Continuar al pago'}}}
window.Cart68={add,open,get};document.readyState==='loading'?document.addEventListener('DOMContentLoaded',inject):inject();})();