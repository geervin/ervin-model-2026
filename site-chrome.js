/* Shared navigation: keyboard/mobile access and compact back-to-top action. */
(()=>{
"use strict";
const head=document.querySelector(".site-header");
if(head){
 const button=head.querySelector(".site-mobile-toggle"),nav=head.querySelector(".site-nav");
 function collapse(){if(!button||!nav)return;nav.classList.remove("is-open");button.setAttribute("aria-expanded","false")}
 button?.addEventListener("click",()=>{
   const open=nav.classList.toggle("is-open");button.setAttribute("aria-expanded",String(open));
 });
 nav?.addEventListener("click",e=>{if(e.target.closest("a"))collapse()});
 document.addEventListener("keydown",e=>{if(e.key==="Escape")collapse()});
 document.addEventListener("pointerdown",e=>{if(!head.contains(e.target))collapse()});
}
const back=document.createElement("button");
back.type="button";back.className="site-back-top";back.textContent="↑ Top";back.setAttribute("aria-label","Back to top");
back.hidden=true;document.body.append(back);
const update=()=>{back.hidden=window.scrollY<650};
window.addEventListener("scroll",update,{passive:true});update();
back.addEventListener("click",()=>window.scrollTo({top:0,behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"}));
})();
