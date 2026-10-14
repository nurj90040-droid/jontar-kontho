const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
function modal(open){$("#modal").classList.toggle("hidden",!open)}
$("#openPost").onclick=()=>modal(true);$("#heroPost").onclick=()=>modal(true);$("#close").onclick=()=>modal(false);
$("#modal").onclick=e=>{if(e.target.id==="modal")modal(false)};
async function load(){
 const q=new URLSearchParams({district:$("#district").value,status:$("#status").value});
 try{
  const r=await fetch("/api/feed?"+q); if(!r.ok) throw 0; const d=await r.json();
  $("#statTotal").textContent=d.stats.total;$("#statVerified").textContent=d.stats.verified;$("#statSent").textContent=d.stats.sent;
  $("#posts").innerHTML=d.posts.map(post=>`<article class="post">
   <div class="posttop"><div class="author"><div class="avatar">👤</div><div><b>Anonymous User</b><div class="meta">📍 ${esc(post.district)} · ${esc(post.created_at?.slice(0,10)||"")}</div></div></div>
   <span class="badge ${post.status==="verified"?"ok":""}">${post.status==="verified"?"✓ যাচাইকৃত":"যাচাইাধীন"}</span></div>
   <h3>${esc(post.category)} · ${esc(post.office||"প্রতিষ্ঠান উল্লেখ করা হয়নি")}</h3>
   <div class="postbody">${esc(post.body)}</div>
   ${post.evidence_count?`<div class="evidence">📎 ${post.evidence_count}টি প্রমাণ সংযুক্ত</div>`:""}
   <div class="meta" style="margin-top:10px">অভিযোগ #${esc(post.tracking_code)}</div>
   <div class="actions"><button onclick="support('${post.id}')">👍 ${post.support_count||0} সমর্থন</button><button onclick="reportPost('${post.id}')">⚑ রিপোর্ট</button></div>
  </article>`).join("")||"<div class='loading'>কোনো অভিযোগ পাওয়া যায়নি।</div>";
 }catch(e){$("#posts").innerHTML="<div class='loading'>সার্ভারে সংযোগ করা যাচ্ছে না। Cloudflare সেটআপ সম্পূর্ণ হয়েছে কি না দেখুন।</div>"}
}
async function support(id){try{await fetch("/api/support",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id})});load()}catch{}}
function reportPost(id){const reason=prompt("কেন রিপোর্ট করছেন?");if(reason)fetch("/api/report",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id,reason})}).then(()=>alert("রিপোর্ট গ্রহণ করা হয়েছে।"))}
$("#district").onchange=load;$("#status").onchange=load;
$("#form").onsubmit=async e=>{
 e.preventDefault();const msg=$("#formMsg");msg.textContent="জমা হচ্ছে…";
 const fd=new FormData(e.target);
 try{const r=await fetch("/api/submit",{method:"POST",body:fd});const d=await r.json();if(!r.ok)throw new Error(d.message||"ব্যর্থ");
 msg.textContent=`অভিযোগ গ্রহণ করা হয়েছে। আপনার tracking number: ${d.tracking_code}`;e.target.reset();setTimeout(()=>{modal(false);load()},1800)
 }catch(err){msg.textContent="দুঃখিত, এখন জমা দেওয়া যাচ্ছে না। "+err.message}
};
load();
