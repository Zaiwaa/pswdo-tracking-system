require('dotenv').config();
const path = require('path');
const http = require('http');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const { query, initDb } = require('./src/db');
const { signUser, publicUser, authenticate, requireAdmin } = require('./src/auth');

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 24) {
  throw new Error('JWT_SECRET must be set to a long random value.');
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true, credentials: true } });
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true, limit: '4mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function fmtDateTime(value) {
  const d = value ? new Date(value) : new Date();
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: true
  }).format(d).replace(',', '');
}
function dateOnly(v) { return v ? String(v).slice(0,10) : ''; }
function normalizeEmail(v){ return String(v||'').trim().toLowerCase(); }
function normalizeRoutingTimestamp(value){
  const t=String(value||'').trim(); const m=t.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/); if(!m)return t;
  let h=Number(m[4]); const suffix=h>=12?'PM':'AM'; h=h%12||12; return `${m[1]}-${m[2]}-${m[3]} ${String(h).padStart(2,'0')}:${m[5]} ${suffix}`;
}
function buildRouting(details, liaison, remarks){ return (details||[]).map(x=>({checkpoint:x.checkpoint||'',timestamp:normalizeRoutingTimestamp(x.timestamp)||fmtDateTime(),assignedLiaison:liaison||'',remarks:remarks||'',extra:x.extra||''})).filter(x=>x.checkpoint); }
function currentStatus(routing){ if(!routing.length)return 'Not yet routed'; const x=routing[routing.length-1]; return x.extra?`${x.checkpoint} - ${x.extra}`:x.timestamp?`${x.checkpoint} - ${x.timestamp}`:x.checkpoint; }
function calcProgress(count){ return Math.min(100,Math.round((count/7)*100)); }
function saveRemarkData(data){
  const raw=String(data.remarkImageBase64||''); if(!raw)return '';
  if(!/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(raw)) throw new Error('Invalid image upload data.');
  if(raw.length>2800000) throw new Error('Remark image is too large. Use an image under about 2 MB.');
  return raw;
}
async function notifyUsers(title,message,excludeId,type='info',actionUrl=''){
  const users=await query("SELECT id FROM users WHERE status='Active' AND ($1::uuid IS NULL OR id<>$1::uuid)",[excludeId||null]);
  for(const u of users.rows) await query('INSERT INTO notifications(id,user_id,title,message,type,action_url) VALUES($1,$2,$3,$4,$5,$6)',[uuidv4(),u.id,title,message,type,actionUrl||null]);
  io.emit('notification:new');
}
async function notifyUser(userId,title,message,type='info',actionUrl=''){
  if(!userId)return;
  await query('INSERT INTO notifications(id,user_id,title,message,type,action_url) VALUES($1,$2,$3,$4,$5,$6)',[uuidv4(),userId,title,message,type,actionUrl||null]);
  io.to(`user:${userId}`).emit('notification:new');
}

async function notifyAdmins(title,message,excludeId,type='approval',actionUrl=''){
  const r=await query("SELECT id FROM users WHERE role='Administrator' AND status='Active' AND ($1::uuid IS NULL OR id<>$1::uuid)",[excludeId||null]);
  for(const u of r.rows){
    await query('INSERT INTO notifications(id,user_id,title,message,type,action_url) VALUES($1,$2,$3,$4,$5,$6)',[uuidv4(),u.id,title,message,type,actionUrl||null]);
    io.to(`user:${u.id}`).emit('notification:new');
  }
}

app.get('/api/health', async (_req,res)=>{ try{await query('SELECT 1');res.json({ok:true});}catch(e){res.status(500).json({ok:false});} });
app.get('/', (_req,res)=>res.redirect('/dashboard.html'));

// Public auth RPCs
app.post('/api/rpc/authRegister', async (req,res,next)=>{try{
  const p=req.body.args?.[0]||{}; const fullName=String(p.fullName||'').trim(),email=normalizeEmail(p.email),position=String(p.position||'').trim(),password=String(p.password||'');
  if(!fullName||!email||!position||!password) throw new Error('Full name, email, position, and password are required.');
  if(password.length<8) throw new Error('Password must be at least 8 characters.');
  if((await query('SELECT 1 FROM users WHERE email=$1',[email])).rowCount) throw new Error('An account with this email already exists.');
  const hash=await bcrypt.hash(password,12), id=uuidv4();
  await query("INSERT INTO users(id,full_name,email,position,role,password_hash,status) VALUES($1,$2,$3,$4,'User',$5,'Pending')",[id,fullName,email,position,hash]);
  await notifyAdmins('New account awaiting approval',`${fullName} (${position}) created an account.`,null,'account',`/admin.html?section=users&user=${id}`);
  res.json({result:{success:true,message:'Account created. An administrator must approve it before you can log in.'}});
}catch(e){next(e)}});

app.post('/api/rpc/authLogin', async (req,res,next)=>{try{
  const [emailIn,password]=req.body.args||[]; const email=normalizeEmail(emailIn); const r=await query('SELECT * FROM users WHERE email=$1',[email]); const u=r.rows[0];
  if(!u||!(await bcrypt.compare(String(password||''),u.password_hash))) throw new Error('Invalid email or password.');
  if(u.status!=='Active') throw new Error(u.status==='Pending'?'Your account is waiting for administrator approval.':'This account is not active.');
  await query('UPDATE users SET last_login=NOW() WHERE id=$1',[u.id]); const token=signUser(u); res.json({result:{success:true,token,user:publicUser(u)}});
}catch(e){next(e)}});


function publicTrackingDocument(x){
  const routing=Array.isArray(x.routing)?x.routing:[];
  return {
    referenceNumber:x.reference_number,
    programUnit:x.program_unit,
    documentType:x.document_type,
    documentDescription:x.document_description,
    dateCreated:dateOnly(x.date_created),
    assignedLiaison:x.assigned_liaison||'',
    currentStatus:x.current_status,
    approvalState:x.approval_state||'Pending',
    progressPercent:x.progress_percent||0,
    lastUpdated:fmtDateTime(x.updated_at||x.created_at),
    routing:routing.map(ev=>({checkpoint:ev.checkpoint||'',timestamp:ev.timestamp||'',assignedLiaison:ev.assignedLiaison||'',extra:ev.extra||''})),
  };
}
function trackingBaseUrl(req){
  const configured=String(process.env.APP_BASE_URL||'').trim().replace(/\/$/,'');
  return configured || `${req.protocol}://${req.get('host')}`;
}
async function audit(userId,documentId,action,details={}){
  await query('INSERT INTO audit_logs(user_id,document_id,action,details) VALUES($1,$2,$3,$4)',[userId||null,documentId||null,action,JSON.stringify(details||{})]);
}
async function optionalUser(req){
  try{
    const header=req.headers.authorization||''; const token=header.startsWith('Bearer ')?header.slice(7):''; if(!token)return null;
    const jwt=require('jsonwebtoken'); const payload=jwt.verify(token,process.env.JWT_SECRET);
    const r=await query("SELECT * FROM users WHERE id=$1 AND status='Active'",[payload.sub]); return r.rows[0]||null;
  }catch(_e){return null;}
}

// Public QR tracking page and API. The token is random and does not expose the internal document UUID.
app.get('/track/:token', (_req,res)=>res.sendFile(path.join(__dirname,'public','track.html')));
app.get('/qr/:token', (_req,res)=>res.sendFile(path.join(__dirname,'public','qr-print.html')));
app.get('/api/public/track/:token', async (req,res,next)=>{try{
  const r=await query('SELECT * FROM documents WHERE public_token=$1',[req.params.token]);
  if(!r.rowCount)return res.status(404).json({error:'Document not found.'});
  res.json({document:publicTrackingDocument(r.rows[0])});
}catch(e){next(e)}});
app.get('/api/public/track/:token/qr.png', async (req,res,next)=>{try{
  const r=await query('SELECT reference_number FROM documents WHERE public_token=$1',[req.params.token]);
  if(!r.rowCount)return res.status(404).send('Document not found.');
  const url=`${trackingBaseUrl(req)}/track/${encodeURIComponent(req.params.token)}`;
  const png=await QRCode.toBuffer(url,{type:'png',width:720,margin:2,errorCorrectionLevel:'M'});
  res.type('png').send(png);
}catch(e){next(e)}});
app.get('/api/public/track/:token/label', async (req,res,next)=>{try{
  const r=await query('SELECT reference_number,document_description FROM documents WHERE public_token=$1',[req.params.token]);
  if(!r.rowCount)return res.status(404).json({error:'Document not found.'});
  res.json({referenceNumber:r.rows[0].reference_number,description:r.rows[0].document_description,trackingUrl:`${trackingBaseUrl(req)}/track/${req.params.token}`});
}catch(e){next(e)}});

// Logged-in staff can receive or update a document directly after scanning its QR code.
app.post('/api/track/:token/action', authenticate, async (req,res,next)=>{try{
  const action=String(req.body.action||'').trim();
  const office=String(req.body.office||req.user.position||'').trim();
  const remarks=String(req.body.remarks||'').trim().slice(0,1000);
  if(!['receive','forward','status'].includes(action))throw new Error('Invalid tracking action.');
  const r=await query('SELECT * FROM documents WHERE public_token=$1',[req.params.token]);
  if(!r.rowCount)return res.status(404).json({error:'Document not found.'});
  const d=r.rows[0], routing=Array.isArray(d.routing)?[...d.routing]:[];
  let checkpoint='Status Updated';
  if(action==='receive')checkpoint='Received';
  if(action==='forward')checkpoint='Forwarded';
  const ev={checkpoint,timestamp:fmtDateTime(),assignedLiaison:req.user.full_name,extra:office,remarks};
  routing.push(ev);
  const status=office?`${checkpoint} - ${office}`:checkpoint;
  await query('UPDATE documents SET assigned_liaison=$1,current_status=$2,progress_percent=$3,routing=$4,updated_at=NOW() WHERE id=$5',[req.user.full_name,status,calcProgress(routing.length),JSON.stringify(routing),d.id]);
  await insertHistory(d.id,d.reference_number,ev);
  await audit(req.user.id,d.id,`QR_${action.toUpperCase()}`,{office,remarks});
  await notifyUsers('Document tracking update',`${req.user.full_name} ${checkpoint.toLowerCase()} ${d.reference_number}${office?` at ${office}`:''}.`,req.user.id,'document',`/documents.html?ref=${encodeURIComponent(d.reference_number)}`);
  io.emit('document:update',{referenceNumber:d.reference_number});
  res.json({success:true,document:publicTrackingDocument({...d,routing,current_status:status,assigned_liaison:req.user.full_name,updated_at:new Date()})});
}catch(e){next(e)}});

// Auth middleware for all remaining RPCs
app.post('/api/rpc/:fn', authenticate, async (req,res,next)=>{try{
  const fn=req.params.fn, a=req.body.args||[], me=req.user;
  let result;
  switch(fn){
    case 'authCurrentUser': result=publicUser(me); break;
    case 'authLogout': result={success:true}; break;
    case 'authUpdateProfile': {
      const p=a[a.length-1]||{}; const fullName=String(p.fullName||'').trim(),position=String(p.position||'').trim(); if(!fullName||!position)throw new Error('Full name and position are required.');
      const r=await query('UPDATE users SET full_name=$1,position=$2 WHERE id=$3 RETURNING *',[fullName,position,me.id]); result={success:true,user:publicUser(r.rows[0])}; break;
    }
    case 'collabListChatUsers': {
      const r=await query("SELECT id,full_name,position,role FROM users WHERE status='Active' AND id<>$1 ORDER BY full_name",[me.id]);
      result=r.rows.map(x=>({id:String(x.id),fullName:x.full_name,position:x.position||'',role:x.role||'User'})); break;
    }
    case 'collabSendMessage': {
      const recipientId=String(a[a.length-2]||'').trim();
      const message=String(a[a.length-1]||'').trim();
      if(!recipientId)throw new Error('Choose an account to message.');
      if(recipientId===String(me.id))throw new Error('You cannot message yourself.');
      if(!message)throw new Error('Message cannot be empty.');
      if(message.length>1000)throw new Error('Message is too long.');
      const peer=await query("SELECT id FROM users WHERE id=$1 AND status='Active'",[recipientId]);
      if(!peer.rowCount)throw new Error('Recipient is unavailable.');
      await query('INSERT INTO messages(id,user_id,recipient_id,message) VALUES($1,$2,$3,$4)',[uuidv4(),me.id,recipientId,message]);
      await notifyUser(recipientId,'New direct message',`${me.full_name} sent you a message.`,'chat',`/dashboard.html?chat=${me.id}`);
      io.to(`user:${recipientId}`).emit('chat:new',{from:String(me.id)});
      io.to(`user:${me.id}`).emit('chat:new',{from:String(me.id)});
      result={success:true}; break;
    }
    case 'collabGetMessages': {
      const peerId=String(a[a.length-2]||'').trim();
      const limit=Math.min(Number(a[a.length-1])||50,100);
      if(!peerId){result=[];break;}
      const r=await query(`SELECT m.id,m.user_id,m.recipient_id,u.full_name,u.position,m.message,m.created_at
        FROM messages m JOIN users u ON u.id=m.user_id
        WHERE (m.user_id=$1 AND m.recipient_id=$2) OR (m.user_id=$2 AND m.recipient_id=$1)
        ORDER BY m.created_at DESC LIMIT $3`,[me.id,peerId,limit]);
      result=r.rows.reverse().map(x=>({id:String(x.id),userId:String(x.user_id),recipientId:String(x.recipient_id||''),fullName:x.full_name,position:x.position,message:x.message,createdAt:fmtDateTime(x.created_at)})); break;
    }
    case 'collabGetNotifications': {
      const r=await query('SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50',[me.id]); result=r.rows.map(x=>({id:String(x.id),title:x.title,message:x.message,type:x.type,actionUrl:x.action_url||'',createdAt:fmtDateTime(x.created_at),read:!!x.read_at})); break;
    }
    case 'collabMarkNotificationRead': await query('UPDATE notifications SET read_at=COALESCE(read_at,NOW()) WHERE id=$1 AND user_id=$2',[a[a.length-1],me.id]); result={success:true}; break;
    case 'collabMarkAllNotificationsRead': await query('UPDATE notifications SET read_at=COALESCE(read_at,NOW()) WHERE user_id=$1',[me.id]); result={success:true}; break;
    case 'dtGenerateReferenceNumber': {
      const offset=a.length>=4?1:0; const programUnit=a[offset],documentType=a[offset+1],dateCreated=a[offset+2]; result=await generateReference(programUnit,documentType,dateCreated); break;
    }
    case 'dtGetDocuments': result=await getDocuments(); break;
    case 'dtSaveDocument': result=await saveDocument(a[a.length-1],me); break;
    case 'dtUpdateDocument': result=await updateDocument(a[a.length-1],me); break;
    case 'dtDeleteDocument': result=await deleteDocument(a[a.length-1],me); break;
    case 'dtGetQrInfo': result=await getQrInfo(a[a.length-1]); break;
    case 'dtGetAuditLog': result=await getAuditLog(a[a.length-1],me); break;
    case 'dtGetRoutingHistory': result=await getRoutingHistory(a[a.length-1]); break;
    case 'dtRequestHistoryDeletion': result=await requestDeletion('history',a[a.length-3],String(a[a.length-2]),a[a.length-1],me); break;
    case 'dtRequestRemarkDeletion': result=await requestDeletion('remark',a[a.length-3],String(a[a.length-2]),a[a.length-1],me); break;
    case 'dashGetDashboardData': result=await getDashboardData(); break;
    case 'dashGetDashboardRecordsByStatus': result=await getDashboardRecords(a[a.length-1]); break;
    case 'adminListUsers': if(me.role!=='Administrator')throw Object.assign(new Error('Administrator access required.'),{status:403}); result=(await query('SELECT id,full_name,email,position,role,status,created_at,last_login FROM users ORDER BY created_at DESC')).rows.map(publicAdminUser); break;
    case 'adminSetUserStatus': if(me.role!=='Administrator')throw Object.assign(new Error('Administrator access required.'),{status:403}); result=await adminSetStatus(me,a[a.length-2],a[a.length-1]); break;
    case 'adminApproveUser': if(me.role!=='Administrator')throw Object.assign(new Error('Administrator access required.'),{status:403}); result=await adminSetStatus(me,a[a.length-1],'Active'); break;
    case 'adminSetUserRole': if(me.role!=='Administrator')throw Object.assign(new Error('Administrator access required.'),{status:403}); result=await adminSetRole(me,a[a.length-2],a[a.length-1]); break;
    case 'adminResetPassword': if(me.role!=='Administrator')throw Object.assign(new Error('Administrator access required.'),{status:403}); result=await adminResetPassword(me,a[a.length-2],a[a.length-1]); break;
    case 'adminListDeletionRequests': if(me.role!=='Administrator')throw Object.assign(new Error('Administrator access required.'),{status:403}); result=await adminListDeletionRequests(); break;
    case 'adminReviewDeletionRequest': if(me.role!=='Administrator')throw Object.assign(new Error('Administrator access required.'),{status:403}); result=await adminReviewDeletionRequest(a[a.length-3],a[a.length-2],a[a.length-1],me); break;
    default: return res.status(404).json({error:`Unknown server function: ${fn}`});
  }
  res.json({result});
}catch(e){next(e)}});

function publicAdminUser(u){return{id:String(u.id),fullName:u.full_name,email:u.email,position:u.position,role:u.role,status:u.status,createdAt:fmtDateTime(u.created_at),lastLogin:u.last_login?fmtDateTime(u.last_login):''}}
async function adminSetStatus(me,userId,status){ if(String(userId)===String(me.id)&&status!=='Active')throw new Error('You cannot disable your own administrator account.'); if(!['Active','Pending','Disabled'].includes(status))throw new Error('Invalid status.'); const r=await query('UPDATE users SET status=$1 WHERE id=$2 RETURNING *',[status,userId]); if(!r.rowCount)throw new Error('User not found.'); await notifyUser(userId,'Account status updated',`Your account status is now ${status}.`,'account'); return{success:true}; }
async function adminSetRole(me,userId,role){ if(String(userId)===String(me.id)&&role!=='Administrator')throw new Error('You cannot remove your own administrator role.'); if(!['Administrator','User'].includes(role))throw new Error('Invalid role.'); const r=await query('UPDATE users SET role=$1 WHERE id=$2 RETURNING *',[role,userId]); if(!r.rowCount)throw new Error('User not found.'); await notifyUser(userId,'Role updated',`Your role is now ${role}.`,'account'); return{success:true}; }
async function adminResetPassword(_me,userId,newPassword){ newPassword=String(newPassword||''); if(newPassword.length<8)throw new Error('Temporary password must be at least 8 characters.'); const hash=await bcrypt.hash(newPassword,12); if(!(await query('UPDATE users SET password_hash=$1 WHERE id=$2',[hash,userId])).rowCount)throw new Error('User not found.'); await notifyUser(userId,'Password reset','An administrator reset your password. Sign in using the temporary password provided to you.','account'); return{success:true}; }

async function generateReference(_programUnit,_documentType,dateCreated){
  const year=String(dateCreated||new Date().toISOString().slice(0,10)).slice(0,4);
  const r=await query('SELECT reference_number FROM documents WHERE reference_number LIKE $1',[`PSWDO-${year}-%`]);
  let max=0;
  for(const x of r.rows){
    const m=String(x.reference_number||'').match(/^PSWDO-\d{4}-(\d+)$/);
    if(m)max=Math.max(max,Number(m[1]));
  }
  return `PSWDO-${year}-${String(max+1).padStart(4,'0')}`;
}
async function getDocuments(){ const r=await query('SELECT * FROM documents ORDER BY created_at DESC'); return r.rows.map(x=>({id:String(x.id),referenceNumber:x.reference_number,programUnit:x.program_unit,documentType:x.document_type,documentDescription:x.document_description,amount:x.amount==null?'':Number(x.amount),dateCreated:dateOnly(x.date_created),assignedLiaison:x.assigned_liaison||'',currentStatus:x.current_status,progressPercent:x.progress_percent,approvalState:x.approval_state,remarks:JSON.stringify(x.remarks_history||[]),attachmentLink:x.attachment_link||'',routing:x.routing||[],routingDetails:x.routing||[],checklist:x.checklist||[],qrToken:String(x.public_token||'')})); }
async function saveDocument(data,me){ validateDocument(data); const id=uuidv4(), ref=data.referenceNumber||await generateReference(data.programUnit,data.documentType,data.dateCreated), routing=buildRouting(data.routingDetails||[],data.assignedLiaison||'',data.remarks||''), image=saveRemarkData(data); const remarks=[]; if(String(data.remarks||'').trim()||image)remarks.push({timestamp:fmtDateTime(),remark:String(data.remarks||'').trim(),imageUrl:image,imageName:data.remarkImageName||''});
  await query(`INSERT INTO documents(id,reference_number,program_unit,document_type,document_description,amount,date_created,assigned_liaison,current_status,progress_percent,approval_state,remarks_history,attachment_link,routing,checklist,created_by,public_token) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'Pending',$11,$12,$13,$14,$15,$16)`,[id,ref,data.programUnit,data.documentType,data.documentDescription,data.amount?Number(data.amount):null,data.dateCreated,data.assignedLiaison||'',currentStatus(routing),calcProgress(routing.length),JSON.stringify(remarks),data.attachmentLink||'',JSON.stringify(routing),JSON.stringify(data.checklist||[]),me.id,uuidv4()]);
  for(const ev of routing)await insertHistory(id,ref,ev); await audit(me.id,id,'DOCUMENT_CREATED',{referenceNumber:ref}); await notifyUsers('New document added',`${me.full_name} added ${ref}.`,me.id,'document',`/documents.html?ref=${encodeURIComponent(ref)}`); return{success:true}; }
async function updateDocument(data,me){ validateDocument(data); const r=await query('SELECT * FROM documents WHERE id=$1',[data.id]); if(!r.rowCount)throw new Error('Record not found.'); const old=r.rows[0], routing=Array.isArray(old.routing)?[...old.routing]:[], newEvents=buildRouting(data.routingDetails||[],data.assignedLiaison||'',data.remarks||''); routing.push(...newEvents); const remarks=Array.isArray(old.remarks_history)?[...old.remarks_history]:[],image=saveRemarkData(data); if(String(data.remarks||'').trim()||image)remarks.push({timestamp:fmtDateTime(),remark:String(data.remarks||'').trim(),imageUrl:image,imageName:data.remarkImageName||''});
  await query(`UPDATE documents SET program_unit=$1,document_type=$2,document_description=$3,amount=$4,date_created=$5,assigned_liaison=$6,current_status=$7,progress_percent=$8,remarks_history=$9,attachment_link=$10,routing=$11,checklist=$12,updated_at=NOW() WHERE id=$13`,[data.programUnit,data.documentType,data.documentDescription,data.amount?Number(data.amount):null,data.dateCreated,data.assignedLiaison||'',currentStatus(routing),calcProgress(routing.length),JSON.stringify(remarks),data.attachmentLink||'',JSON.stringify(routing),JSON.stringify(data.checklist||[]),data.id]);
  for(const ev of newEvents)await insertHistory(data.id,old.reference_number,ev); await audit(me.id,data.id,'DOCUMENT_UPDATED',{referenceNumber:old.reference_number}); await notifyUsers('Document updated',`${me.full_name} updated ${old.reference_number}.`,me.id,'document'); return{success:true}; }
async function deleteDocument(id,me){ const prior=await query('SELECT reference_number FROM documents WHERE id=$1',[id]); if(!prior.rowCount)throw new Error('Record not found.'); await audit(me.id,id,'DOCUMENT_DELETED',{referenceNumber:prior.rows[0].reference_number}); const r=await query('DELETE FROM documents WHERE id=$1 RETURNING reference_number',[id]); await notifyUsers('Document deleted',`${me.full_name} deleted ${r.rows[0].reference_number}.`,me.id,'document'); return{success:true}; }
function validateDocument(d){if(!d||!d.programUnit)throw new Error('Program required');if(!d.documentType)throw new Error('Type required');if(!d.documentDescription)throw new Error('Description required');if(!d.dateCreated)throw new Error('Date required');}
async function insertHistory(id,ref,ev){await query('INSERT INTO routing_history(document_id,reference_number,checkpoint,event_timestamp,assigned_liaison,remarks) VALUES($1,$2,$3,$4,$5,$6)',[id,ref,ev.checkpoint,ev.timestamp,ev.assignedLiaison||'',ev.extra||ev.remarks||'']);}
async function getRoutingHistory(documentId){
  const r=await query(`SELECT id,checkpoint,event_timestamp,assigned_liaison,remarks,created_at FROM routing_history WHERE document_id=$1 ORDER BY id ASC`,[documentId]);
  return r.rows.map(x=>({id:String(x.id),checkpoint:x.checkpoint||'',timestamp:x.event_timestamp||'',assignedLiaison:x.assigned_liaison||'',remarks:x.remarks||'',createdAt:fmtDateTime(x.created_at)}));
}
async function deleteRoutingHistory(historyId,reason,me){
  reason=String(reason||'').trim();
  if(reason.length<3)throw new Error('Please provide a reason for deleting this history entry.');
  const hr=await query(`SELECT * FROM routing_history WHERE id=$1`,[historyId]);
  if(!hr.rowCount)throw new Error('History entry not found.');
  const h=hr.rows[0];
  const dr=await query('SELECT * FROM documents WHERE id=$1',[h.document_id]);
  if(!dr.rowCount)throw new Error('Document not found.');
  const d=dr.rows[0];
  const routing=Array.isArray(d.routing)?[...d.routing]:[];
  const norm=v=>String(v||'').trim();
  let idx=routing.findIndex(ev=>norm(ev.checkpoint)===norm(h.checkpoint)&&norm(ev.timestamp)===norm(h.event_timestamp)&&norm(ev.assignedLiaison)===norm(h.assigned_liaison)&&[norm(ev.extra),norm(ev.remarks)].includes(norm(h.remarks)));
  if(idx<0)idx=routing.findIndex(ev=>norm(ev.checkpoint)===norm(h.checkpoint)&&norm(ev.timestamp)===norm(h.event_timestamp));
  const removedRouting=idx>=0?routing.splice(idx,1)[0]:null;
  const newStatus=currentStatus(routing);
  const newLiaison=routing.length?String(routing[routing.length-1].assignedLiaison||''):'';
  const client=await require('./src/db').pool.connect();
  try{
    await client.query('BEGIN');
    await client.query('DELETE FROM routing_history WHERE id=$1',[historyId]);
    await client.query('UPDATE documents SET routing=$1,current_status=$2,assigned_liaison=$3,progress_percent=$4,updated_at=NOW() WHERE id=$5',[JSON.stringify(routing),newStatus,newLiaison,calcProgress(routing.length),d.id]);
    await client.query('INSERT INTO audit_logs(user_id,document_id,action,details) VALUES($1,$2,$3,$4)',[me.id,d.id,'ROUTING_HISTORY_DELETED',JSON.stringify({historyId:String(historyId),reason,deletedEntry:{checkpoint:h.checkpoint,timestamp:h.event_timestamp,assignedLiaison:h.assigned_liaison,remarks:h.remarks},removedRouting})]);
    await client.query('COMMIT');
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
  await notifyUsers('Document history corrected',`${me.full_name} removed a mistaken history entry from ${d.reference_number}.`,me.id,'document');
  io.emit('document:update',{referenceNumber:d.reference_number});
  return{success:true,currentStatus:newStatus};
}

async function deleteRemark(documentId,remarkIndex,reason,me){
  reason=String(reason||'').trim();
  if(reason.length<3)throw new Error('Please provide a reason for deleting this remark.');
  const dr=await query('SELECT id,reference_number,remarks_history FROM documents WHERE id=$1',[documentId]);
  if(!dr.rowCount)throw new Error('Document not found.');
  const d=dr.rows[0];
  const remarks=Array.isArray(d.remarks_history)?[...d.remarks_history]:[];
  const idx=Number(remarkIndex);
  if(!Number.isInteger(idx)||idx<0||idx>=remarks.length)throw new Error('Remark not found. Refresh the document and try again.');
  const removed=remarks.splice(idx,1)[0];
  const client=await require('./src/db').pool.connect();
  try{
    await client.query('BEGIN');
    await client.query('UPDATE documents SET remarks_history=$1,updated_at=NOW() WHERE id=$2',[JSON.stringify(remarks),documentId]);
    await client.query('INSERT INTO audit_logs(user_id,document_id,action,details) VALUES($1,$2,$3,$4)',[me.id,documentId,'DOCUMENT_REMARK_DELETED',JSON.stringify({remarkIndex:idx,reason,deletedRemark:removed})]);
    await client.query('COMMIT');
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
  await notifyUsers('Document remark corrected',`${me.full_name} removed a mistaken remark from ${d.reference_number}.`,me.id,'document');
  io.emit('document:update',{referenceNumber:d.reference_number});
  return{success:true};
}


async function requestDeletion(targetType,documentId,targetKey,reason,me){
  reason=String(reason||'').trim();
  if(reason.length<5)throw new Error('Please explain why this entry should be removed.');
  const dr=await query('SELECT id,reference_number,remarks_history FROM documents WHERE id=$1',[documentId]);
  if(!dr.rowCount)throw new Error('Document not found.');
  const d=dr.rows[0]; let snapshot;
  if(targetType==='history'){
    const hr=await query('SELECT id,checkpoint,event_timestamp,assigned_liaison,remarks,created_at FROM routing_history WHERE id=$1 AND document_id=$2',[targetKey,documentId]);
    if(!hr.rowCount)throw new Error('History entry not found. Refresh and try again.');
    snapshot=hr.rows[0];
  }else if(targetType==='remark'){
    const remarks=Array.isArray(d.remarks_history)?d.remarks_history:[]; const idx=Number(targetKey);
    if(!Number.isInteger(idx)||idx<0||idx>=remarks.length)throw new Error('Remark not found. Refresh and try again.');
    snapshot=remarks[idx];
  }else throw new Error('Invalid deletion request type.');
  const dup=await query("SELECT id FROM deletion_requests WHERE document_id=$1 AND target_type=$2 AND target_key=$3 AND status='Pending'",[documentId,targetType,String(targetKey)]);
  if(dup.rowCount)throw new Error('A deletion request for this entry is already waiting for administrator approval.');
  const id=uuidv4();
  await query('INSERT INTO deletion_requests(id,requester_id,document_id,target_type,target_key,target_snapshot,reason) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,me.id,documentId,targetType,String(targetKey),JSON.stringify(snapshot||{}),reason]);
  await audit(me.id,documentId,'DELETION_REQUESTED',{requestId:id,targetType,targetKey:String(targetKey),reason,snapshot});
  await notifyAdmins('Deletion approval requested',`${me.full_name} requested removal of a ${targetType==='history'?'history entry':'remark'} from ${d.reference_number}.`,null,'approval',`/admin.html?section=deletions&request=${id}`);
  return{success:true,requestId:id,message:'Deletion request sent to administrators for approval.'};
}

async function adminListDeletionRequests(){
  const r=await query(`SELECT q.*,d.reference_number,u.full_name requester_name,u.position requester_position,rv.full_name reviewer_name
    FROM deletion_requests q
    JOIN documents d ON d.id=q.document_id
    JOIN users u ON u.id=q.requester_id
    LEFT JOIN users rv ON rv.id=q.reviewed_by
    ORDER BY CASE q.status WHEN 'Pending' THEN 0 ELSE 1 END,q.created_at DESC LIMIT 200`);
  return r.rows.map(x=>({id:String(x.id),documentId:String(x.document_id),referenceNumber:x.reference_number,targetType:x.target_type,targetKey:x.target_key,targetSnapshot:x.target_snapshot||{},reason:x.reason,status:x.status,requesterId:String(x.requester_id),requesterName:x.requester_name,requesterPosition:x.requester_position,createdAt:fmtDateTime(x.created_at),reviewerName:x.reviewer_name||'',reviewNote:x.review_note||'',reviewedAt:x.reviewed_at?fmtDateTime(x.reviewed_at):''}));
}

function sameJson(a,b){try{return JSON.stringify(a??null)===JSON.stringify(b??null)}catch(_e){return false}}

async function adminReviewDeletionRequest(requestId,decision,note,me){
  decision=String(decision||'').trim(); note=String(note||'').trim();
  if(!['Approved','Rejected'].includes(decision))throw new Error('Decision must be Approved or Rejected.');
  const client=await require('./src/db').pool.connect(); let reqRow,ref='';
  try{
    await client.query('BEGIN');
    const rr=await client.query(`SELECT q.*,d.reference_number,d.remarks_history FROM deletion_requests q JOIN documents d ON d.id=q.document_id WHERE q.id=$1 FOR UPDATE`,[requestId]);
    if(!rr.rowCount)throw new Error('Deletion request not found.');
    reqRow=rr.rows[0]; ref=reqRow.reference_number;
    if(reqRow.status!=='Pending')throw new Error(`This request has already been ${reqRow.status.toLowerCase()}.`);
    if(decision==='Approved'){
      if(reqRow.target_type==='history'){
        const hr=await client.query('SELECT * FROM routing_history WHERE id=$1 AND document_id=$2',[reqRow.target_key,reqRow.document_id]);
        if(!hr.rowCount)throw new Error('The requested history entry no longer exists.');
        await client.query('DELETE FROM routing_history WHERE id=$1 AND document_id=$2',[reqRow.target_key,reqRow.document_id]);
        const rem=await client.query('SELECT checkpoint,event_timestamp,assigned_liaison,remarks FROM routing_history WHERE document_id=$1 ORDER BY id ASC',[reqRow.document_id]);
        const routing=rem.rows.map(x=>({checkpoint:x.checkpoint||'',timestamp:x.event_timestamp||'',assignedLiaison:x.assigned_liaison||'',remarks:x.remarks||'',extra:''}));
        const last=routing.at(-1), newStatus=last?(last.extra?`${last.checkpoint} - ${last.extra}`:last.timestamp?`${last.checkpoint} - ${last.timestamp}`:last.checkpoint):'Not yet routed';
        const newLiaison=last?.assignedLiaison||'';
        await client.query('UPDATE documents SET routing=$1,current_status=$2,assigned_liaison=$3,progress_percent=$4,updated_at=NOW() WHERE id=$5',[JSON.stringify(routing),newStatus,newLiaison,calcProgress(routing.length),reqRow.document_id]);
      }else{
        const remarks=Array.isArray(reqRow.remarks_history)?[...reqRow.remarks_history]:[]; let idx=Number(reqRow.target_key);
        if(!(Number.isInteger(idx)&&idx>=0&&idx<remarks.length&&sameJson(remarks[idx],reqRow.target_snapshot))){idx=remarks.findIndex(x=>sameJson(x,reqRow.target_snapshot));}
        if(idx<0)throw new Error('The requested remark no longer exists or has already been changed.');
        remarks.splice(idx,1);
        await client.query('UPDATE documents SET remarks_history=$1,updated_at=NOW() WHERE id=$2',[JSON.stringify(remarks),reqRow.document_id]);
      }
    }
    await client.query('UPDATE deletion_requests SET status=$1,reviewed_by=$2,review_note=$3,reviewed_at=NOW() WHERE id=$4',[decision,me.id,note||null,requestId]);
    await client.query('INSERT INTO audit_logs(user_id,document_id,action,details) VALUES($1,$2,$3,$4)',[me.id,reqRow.document_id,decision==='Approved'?'DELETION_REQUEST_APPROVED':'DELETION_REQUEST_REJECTED',JSON.stringify({requestId:String(requestId),requesterId:String(reqRow.requester_id),targetType:reqRow.target_type,targetKey:reqRow.target_key,reason:reqRow.reason,reviewNote:note,targetSnapshot:reqRow.target_snapshot})]);
    await client.query('COMMIT');
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
  await notifyUser(reqRow.requester_id,`Deletion request ${decision.toLowerCase()}`,`Your request to remove a ${reqRow.target_type==='history'?'history entry':'remark'} from ${ref} was ${decision.toLowerCase()}${note?`: ${note}`:'.'}`,'approval',`/documents.html?ref=${encodeURIComponent(ref)}`);
  if(decision==='Approved'){
    await notifyUsers('Document correction approved',`${me.full_name} approved removal of a mistaken ${reqRow.target_type==='history'?'history entry':'remark'} from ${ref}.`,me.id,'document');
    io.emit('document:update',{referenceNumber:ref});
  }
  return{success:true,status:decision};
}

async function getQrInfo(id){
  const r=await query('SELECT public_token,reference_number,document_description FROM documents WHERE id=$1',[id]);
  if(!r.rowCount)throw new Error('Record not found.');
  return{token:String(r.rows[0].public_token),referenceNumber:r.rows[0].reference_number,description:r.rows[0].document_description};
}
async function getAuditLog(id,me){
  const r=await query(`SELECT a.action,a.details,a.created_at,u.full_name,u.position FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id WHERE a.document_id=$1 ORDER BY a.created_at DESC LIMIT 100`,[id]);
  return r.rows.map(x=>({action:x.action,details:x.details||{},createdAt:fmtDateTime(x.created_at),fullName:x.full_name||'System',position:x.position||''}));
}
function isApproved(x){const latest=(x.routing||[]).at(-1);return String(x.approval_state||'').toLowerCase()==='approved'||String(latest?.checkpoint||'').toLowerCase()==='completed/approved'}
function mapDashboard(x){const activity=(new Date(x.updated_at)-new Date(x.created_at)>1000)?'Updated':'Added';return{referenceNumber:x.reference_number,programUnit:x.program_unit,documentType:x.document_type,documentDescription:x.document_description,currentStatus:x.current_status,approvalState:x.approval_state||'Pending',latestRoutingCheckpoint:(x.routing||[]).at(-1)?.checkpoint||'',activityType:activity,activityDate:fmtDateTime(x.updated_at||x.created_at)}}
async function getDashboardRecords(status='ALL'){const r=await query('SELECT * FROM documents ORDER BY updated_at DESC');let rows=r.rows;if(String(status).toUpperCase()==='PENDING')rows=rows.filter(x=>!isApproved(x));if(String(status).toUpperCase()==='APPROVED')rows=rows.filter(isApproved);return rows.map(mapDashboard)}
async function getDashboardData(){const r=await query('SELECT * FROM documents ORDER BY updated_at DESC');const docs=r.rows,approved=docs.filter(isApproved),pending=docs.filter(x=>!isApproved(x));const countBy=(key)=>docs.reduce((m,x)=>(m[x[key]||'Unknown']=(m[x[key]||'Unknown']||0)+1,m),{});const top=o=>Object.entries(o).sort((a,b)=>b[1]-a[1])[0]?.[0]||'';return{totalDocuments:docs.length,approvedDocuments:approved.length,pendingDocuments:pending.length,returnToSenderDocuments:docs.filter(x=>String(x.approval_state).toLowerCase()==='return to sender').length,topProgramUnit:top(countBy('program_unit')),topDocumentType:top(countBy('document_type')),recentActivity:docs.slice(0,10).map(mapDashboard)}}

io.on('connection', socket=>{ socket.on('identify',userId=>{if(userId)socket.join(`user:${userId}`)}); });

app.use((err,_req,res,_next)=>{console.error(err);res.status(err.status||400).json({error:err.message||'Something went wrong.'});});

initDb().then(()=>server.listen(PORT,()=>console.log(`PSWDO Tracking System running on port ${PORT}`))).catch(err=>{console.error('Startup failed:',err);process.exit(1)});
