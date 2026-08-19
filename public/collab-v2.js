
(function(){
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const token=()=>localStorage.getItem('pswdo_tracking_session')||'';
  let currentUser=null, peerId='';

  function rpc(name,args,ok,fail){
    let r=google.script.run.withSuccessHandler(ok||(()=>{})).withFailureHandler(fail||(e=>console.error(e)));
    r[name](...(args||[]));
  }
  function rebuildChat(){
    const panel=$('chatPanel'); if(!panel)return;
    panel.innerHTML=`
      <div class="panel-head"><div><h3>Direct Messages</h3><div class="chat-peer-label" id="chatPeerLabel">Choose an account</div></div><button class="close-panel" data-v2-close>×</button></div>
      <div class="chat-user-picker"><select id="chatPeerSelect"><option value="">Select account to chat with…</option></select></div>
      <div class="panel-body chat-list" id="chatList"></div>
      <div class="chat-compose"><input id="chatInput" maxlength="1000" placeholder="Type a private message…" disabled><button id="sendChatBtn" disabled>Send</button></div>`;
    panel.querySelector('[data-v2-close]').onclick=()=>panel.classList.add('hidden');
    $('chatPeerSelect').onchange=()=>{peerId=$('chatPeerSelect').value;$('chatInput').disabled=!peerId;$('sendChatBtn').disabled=!peerId;updatePeerLabel();loadChat();};
    $('sendChatBtn').onclick=sendChat;
    $('chatInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();sendChat();}});
  }
  function loadUsers(){
    if(!token())return;
    rpc('collabListChatUsers',[token()],rows=>{
      const sel=$('chatPeerSelect'); if(!sel)return;
      const wanted=new URLSearchParams(location.search).get('chat')||peerId;
      sel.innerHTML='<option value="">Select account to chat with…</option>'+rows.map(u=>`<option value="${esc(u.id)}">${esc(u.fullName)} — ${esc(u.position||u.role)}</option>`).join('');
      if(wanted && rows.some(u=>String(u.id)===String(wanted))){
        sel.value=wanted;peerId=wanted;$('chatInput').disabled=false;$('sendChatBtn').disabled=false;updatePeerLabel();loadChat();
        if(new URLSearchParams(location.search).has('chat'))$('chatPanel')?.classList.remove('hidden');
      }
    });
  }
  function updatePeerLabel(){
    const sel=$('chatPeerSelect'), label=$('chatPeerLabel'); if(!sel||!label)return;
    label.textContent=peerId?(sel.options[sel.selectedIndex]?.text||'Private conversation'):'Choose an account';
  }
  function loadChat(){
    if(!token()||!peerId)return;
    rpc('collabGetMessages',[token(),peerId,80],rows=>{
      if(!$('chatList'))return;
      $('chatList').innerHTML=rows.map(m=>`<div class="chat-item ${currentUser&&String(m.userId)===String(currentUser.id)?'me':'them'}"><div class="chat-meta"><b>${esc(m.fullName)}</b> · ${esc(m.createdAt)}</div><div class="chat-text">${esc(m.message)}</div></div>`).join('')||'<div class="chat-empty">No messages yet. Start the conversation.</div>';
      $('chatList').scrollTop=$('chatList').scrollHeight;
    });
  }
  function sendChat(){
    const input=$('chatInput'); const v=input?.value.trim(); if(!peerId||!v)return;
    rpc('collabSendMessage',[token(),peerId,v],()=>{input.value='';loadChat();},e=>alert(e.message||e));
  }
  function loadNotifications(){
    if(!token())return;
    rpc('collabGetNotifications',[token()],rows=>{
      const unread=rows.filter(n=>!n.read).length;
      if($('notifBadge')){$('notifBadge').textContent=unread;$('notifBadge').classList.toggle('hidden',!unread);}
      if(!$('notifList'))return;
      $('notifList').innerHTML=rows.map(n=>`<div class="notif-item ${n.read?'':'unread'}" data-v2-nid="${esc(n.id)}" data-v2-url="${esc(n.actionUrl||'')}"><div class="notif-title">${esc(n.title)}</div><div class="notif-msg">${esc(n.message)}</div><div class="notif-time">${esc(n.createdAt)}</div>${n.actionUrl?'<div class="notif-open">Open concern →</div>':''}</div>`).join('')||'<div class="notif-msg">No notifications.</div>';
      document.querySelectorAll('[data-v2-nid]').forEach(el=>el.onclick=()=>{
        const url=el.dataset.v2Url;
        rpc('collabMarkNotificationRead',[token(),el.dataset.v2Nid],()=>{if(url)location.href=url;else loadNotifications();});
      });
    });
  }
  function hook(){
    currentUser=window.pswdoCurrentUser||currentUser;
    rebuildChat();
    if($('chatBtn'))$('chatBtn').onclick=()=>{$('notifPanel')?.classList.add('hidden');$('chatPanel')?.classList.toggle('hidden');if(!$('chatPanel')?.classList.contains('hidden')){loadUsers();loadChat();}};
    if($('notifBtn'))$('notifBtn').onclick=()=>{$('chatPanel')?.classList.add('hidden');$('notifPanel')?.classList.toggle('hidden');if(!$('notifPanel')?.classList.contains('hidden'))loadNotifications();};
    if($('readAllBtn'))$('readAllBtn').onclick=()=>rpc('collabMarkAllNotificationsRead',[token()],loadNotifications);
    loadUsers();loadNotifications();
  }
  window.addEventListener('pswdo:user',()=>{currentUser=window.pswdoCurrentUser;setTimeout(hook,0)});
  document.addEventListener('DOMContentLoaded',()=>setTimeout(hook,100));
  setInterval(()=>{if(token()){loadNotifications();if(peerId&&!$('chatPanel')?.classList.contains('hidden'))loadChat();}},10000);
})();
