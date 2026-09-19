import {useEffect,useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {BellRing,CheckCheck,Trash2} from 'lucide-react'
import {supabase} from '../lib/supabase'
export default function Notifications({profile}){
 const [rows,setRows]=useState([]),[tab,setTab]=useState('unread');const nav=useNavigate()
 useEffect(()=>{let channel;let timer;load();timer=setInterval(load,10000);channel=supabase.channel(`notifications-page-${profile.id}`).on('postgres_changes',{event:'*',schema:'public',table:'notifications',filter:`user_id=eq.${profile.id}`},load).subscribe();return()=>{clearInterval(timer);if(channel)supabase.removeChannel(channel)}},[profile.id])
 async function load(){const {data}=await supabase.from('notifications').select('*').eq('user_id',profile.id).order('created_at',{ascending:false}).limit(150);setRows(data||[])}
 async function openNotification(n){if(!n.read_at){const readAt=new Date().toISOString();setRows(r=>r.map(x=>x.id===n.id?{...x,read_at:readAt}:x));await supabase.from('notifications').update({read_at:readAt}).eq('id',n.id)}if(n.action_url)nav(n.action_url)}
 async function markAll(){const readAt=new Date().toISOString();setRows(r=>r.map(x=>x.read_at?x:{...x,read_at:readAt}));await supabase.from('notifications').update({read_at:readAt}).eq('user_id',profile.id).is('read_at',null)}
 const unreadCount=rows.filter(x=>!x.read_at).length,shown=tab==='unread'?rows.filter(x=>!x.read_at):rows
 return <><div className="page-head"><div><span className="eyebrow">Actionable Updates</span><h1>Notifications</h1><p>Read notifications automatically leave the Unread inbox. Switch to All to review older notices.</p></div>{unreadCount>0&&<button className="btn secondary" onClick={markAll}><CheckCheck size={16}/>Mark all read</button>}</div><div className="notif-tabs"><button className={tab==='unread'?'active':''} onClick={()=>setTab('unread')}>Unread ({unreadCount})</button><button className={tab==='all'?'active':''} onClick={()=>setTab('all')}>All ({rows.length})</button></div><section className="panel notification-list">{shown.map(n=><button type="button" key={n.id} className={!n.read_at?'unread notification-item':'notification-item'} onClick={()=>openNotification(n)}><div className="notification-icon"><BellRing size={17}/></div><div><b>{n.title}</b><p>{n.message}</p><small>{new Date(n.created_at).toLocaleString()}</small></div>{!n.read_at&&<span className="unread-dot"/>}</button>)}{!shown.length&&<div className="empty">{tab==='unread'?'You are all caught up. No unread notifications.':'No notifications yet.'}</div>}</section></>
}
