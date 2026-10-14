const json = (data, status = 200, headers = {}) => Response.json(data, { status, headers });
const allowedTypes = new Set(['image/jpeg','image/png','image/webp','video/mp4','video/webm','application/pdf']);
const allowedStatuses = new Set(['pending','reviewing','verified','rejected','authority_ready','sent']);
const cookieName = 'jk_admin';
const encoder = new TextEncoder();
function b64u(bytes) { let s=''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_'); }
function unb64u(s) { s=s.replace(/-/g,'+').replace(/_/g,'/'); while(s.length%4)s+='='; return Uint8Array.from(atob(s),c=>c.charCodeAt(0)); }
async function sign(value, secret) { const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']); return b64u(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(value)))); }
async function makeCookie(secret) { const payload=b64u(encoder.encode(JSON.stringify({exp:Date.now()+8*60*60*1000}))); return payload+'.'+await sign(payload,secret); }
async function isAdmin(request, env) {
  if (!env.SESSION_SECRET) return false;
  const raw=(request.headers.get('Cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='));
  if(!raw)return false;
  const token=decodeURIComponent(raw.slice(cookieName.length+1)); const parts=token.split('.'); if(parts.length!==2)return false;
  if(await sign(parts[0],env.SESSION_SECRET)!==parts[1])return false;
  try { return JSON.parse(new TextDecoder().decode(unb64u(parts[0]))).exp>Date.now(); } catch { return false; }
}
function cookie(value, maxAge=28800) { return `${cookieName}=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`; }
function code(){return 'BD-'+Array.from(crypto.getRandomValues(new Uint8Array(4)),b=>b.toString(16).padStart(2,'0')).join('').toUpperCase();}
function safeText(v,max=6000){return String(v??'').trim().slice(0,max)}
function originOkay(request){const origin=request.headers.get('Origin'); if(!origin)return true; try{return new URL(origin).host===new URL(request.url).host;}catch{return false;}}
async function bodyJson(request){try{return await request.json()}catch{return {}}}
async function adminGate(request,env){if(!await isAdmin(request,env))return json({message:'Admin login required'},401);return null;}
async function route(request,env){
  if(!env.DB || !env.EVIDENCE)return json({message:'Cloudflare binding setup অসম্পূর্ণ। README দেখুন।'},503);
  const url=new URL(request.url), path=url.pathname, method=request.method;
  if(method==='GET' && path==='/api/feed'){
    const district=safeText(url.searchParams.get('district'),80);
    // Public pages show only moderator-verified reports. Private contact and evidence keys are never returned.
    let sql='SELECT id, tracking_code, category, district, office, body, status, support_count, created_at, (SELECT COUNT(*) FROM evidence e WHERE e.complaint_id=c.id) AS evidence_count FROM complaints c WHERE status = ?';
    const args=['verified']; if(district){sql+=' AND district = ?';args.push(district);} sql+=' ORDER BY created_at DESC LIMIT 100';
    const {results=[]}=await env.DB.prepare(sql).bind(...args).all();
    const total=await env.DB.prepare('SELECT COUNT(*) AS n FROM complaints').first();
    const verified=await env.DB.prepare("SELECT COUNT(*) AS n FROM complaints WHERE status='verified'").first();
    const sent=await env.DB.prepare("SELECT COUNT(*) AS n FROM complaints WHERE status='sent'").first();
    return json({posts:results,stats:{total:total?.n||0,verified:verified?.n||0,sent:sent?.n||0}});
  }
  if(method==='POST' && path==='/api/submit'){
    if(!originOkay(request))return json({message:'Origin rejected'},403);
    let form; try{form=await request.formData()}catch{return json({message:'ফর্মটি পড়া যায়নি'},400)}
    const body=safeText(form.get('body')); if(body.length<30)return json({message:'অভিযোগের বিস্তারিত অন্তত ৩০ অক্ষর হতে হবে।'},400);
    const files=form.getAll('evidence').filter(f=>f && typeof f.arrayBuffer==='function' && f.size>0);
    if(files.length>5)return json({message:'সর্বোচ্চ ৫টি ফাইল সংযুক্ত করা যাবে।'},400);
    for(const f of files){if(!allowedTypes.has(f.type))return json({message:'শুধু JPG, PNG, WEBP, MP4, WEBM অথবা PDF ফাইল গ্রহণ করা হয়।'},400);if(f.size>10*1024*1024)return json({message:'প্রতিটি ফাইল সর্বোচ্চ ১০ MB হতে পারবে।'},400);}
    const id=crypto.randomUUID(), tracking=code(), now=new Date().toISOString();
    await env.DB.prepare('INSERT INTO complaints (id,tracking_code,category,district,office,incident_date,body,status,support_count,authority_consent,contact,created_at) VALUES (?,?,?,?,?,?,?,\'pending\',0,?,?,?)')
      .bind(id,tracking,safeText(form.get('category'),100),safeText(form.get('district'),80),safeText(form.get('office'),160),safeText(form.get('incident_date'),20)||null,body,form.get('authority_consent')==='on'?1:0,safeText(form.get('contact'),200),now).run();
    try{
      for(const f of files){const key=`evidence-${id}-${crypto.randomUUID()}`;await env.EVIDENCE.put(key,await f.arrayBuffer(),{httpMetadata:{contentType:f.type}});await env.DB.prepare('INSERT INTO evidence (id,complaint_id,object_key,name,content_type,size) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),id,key,safeText(f.name,180),f.type,f.size).run();}
    }catch(e){await env.DB.prepare('DELETE FROM evidence WHERE complaint_id=?').bind(id).run();await env.DB.prepare('DELETE FROM complaints WHERE id=?').bind(id).run();return json({message:'প্রমাণ সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।'},500);}
    return json({ok:true,tracking_code:tracking});
  }
  if(method==='POST' && path==='/api/support'){
    if(!originOkay(request))return json({message:'Origin rejected'},403);const b=await bodyJson(request);const result=await env.DB.prepare("UPDATE complaints SET support_count=support_count+1 WHERE id=? AND status='verified'").bind(safeText(b.id,80)).run();return result.meta?.changes?json({ok:true}):json({message:'যাচাইকৃত অভিযোগ পাওয়া যায়নি'},404);
  }
  if(method==='POST' && path==='/api/report'){
    if(!originOkay(request))return json({message:'Origin rejected'},403);const b=await bodyJson(request);const id=safeText(b.id,80);const c=await env.DB.prepare("SELECT id FROM complaints WHERE id=? AND status='verified'").bind(id).first();if(!c)return json({message:'যাচাইকৃত অভিযোগ পাওয়া যায়নি'},404);
    await env.DB.prepare('INSERT INTO reports (id,complaint_id,reason,created_at) VALUES (?,?,?,?)').bind(crypto.randomUUID(),id,safeText(b.reason,500),new Date().toISOString()).run();return json({ok:true});
  }
  if(path==='/api/admin/login' && method==='POST'){
    if(!originOkay(request))return json({message:'Origin rejected'},403);if(!env.ADMIN_PASSWORD||!env.SESSION_SECRET)return json({message:'Cloudflare-এ ADMIN_PASSWORD এবং SESSION_SECRET সেট করুন।'},503);
    const b=await bodyJson(request);if(String(b.password||'')!==env.ADMIN_PASSWORD)return json({message:'পাসওয়ার্ড ভুল'},401);
    return json({ok:true},200,{'Set-Cookie':cookie(await makeCookie(env.SESSION_SECRET),'28800')});
  }
  if(path==='/api/admin/me' && method==='GET')return await isAdmin(request,env)?json({ok:true}):json({ok:false},401);
  if(path==='/api/admin/logout' && method==='POST')return json({ok:true},200,{'Set-Cookie':cookie('',0)});
  if(path.startsWith('/api/admin/')){
    const denied=await adminGate(request,env);if(denied)return denied;
    if(path==='/api/admin/complaints' && method==='GET'){
      const status=safeText(url.searchParams.get('status'),40);let sql='SELECT * FROM complaints';const args=[];if(status){sql+=' WHERE status=?';args.push(status);}sql+=' ORDER BY created_at DESC LIMIT 300';const {results=[]}=await env.DB.prepare(sql).bind(...args).all();
      const out=[];for(const c of results){const {results:ev=[]}=await env.DB.prepare('SELECT name,content_type AS type,size,object_key AS path FROM evidence WHERE complaint_id=?').bind(c.id).all();out.push({...c,authority_consent:!!c.authority_consent,evidence:ev});}return json(out);
    }
    if(path==='/api/admin/status' && method==='POST'){
      if(!originOkay(request))return json({message:'Origin rejected'},403);const b=await bodyJson(request),status=safeText(b.status,40),id=safeText(b.id,80),note=safeText(b.note,1000);if(!allowedStatuses.has(status))return json({message:'invalid status'},400);
      const c=await env.DB.prepare('SELECT id FROM complaints WHERE id=?').bind(id).first();if(!c)return json({message:'অভিযোগ পাওয়া যায়নি'},404);const now=new Date().toISOString();
      await env.DB.prepare('UPDATE complaints SET status=?,moderation_note=?,updated_at=?,verified_at=CASE WHEN ?=\'verified\' THEN ? ELSE verified_at END,sent_at=CASE WHEN ?=\'sent\' THEN ? ELSE sent_at END WHERE id=?').bind(status,note,now,status,now,status,now,id).run();return json({ok:true});
    }
    const match=path.match(/^\/api\/admin\/evidence\/([^/]+)\/(.+)$/);
    if(match && method==='GET'){
      const complaintId=decodeURIComponent(match[1]),key=decodeURIComponent(match[2]);const f=await env.DB.prepare('SELECT name,content_type,object_key FROM evidence WHERE complaint_id=? AND object_key=?').bind(complaintId,key).first();if(!f)return json({message:'ফাইল পাওয়া যায়নি'},404);const obj=await env.EVIDENCE.get(f.object_key);if(!obj)return json({message:'ফাইল পাওয়া যায়নি'},404);return new Response(obj.body,{headers:{'Content-Type':f.content_type||'application/octet-stream','Content-Disposition':`inline; filename*=UTF-8''${encodeURIComponent(f.name)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
    }
  }
  return json({message:'Not found'},404);
}
export async function onRequest(context){try{return await route(context.request,context.env);}catch(e){console.error('API error',e);return json({message:'সার্ভারে সমস্যা হয়েছে। পরে আবার চেষ্টা করুন।'},500);}}
