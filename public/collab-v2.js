
(function(){
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const token=()=>localStorage.getItem('pswdo_tracking_session')||'';
  let currentUser=null, peerId='';

  function rpc(name,args,ok,fail){
    let r=google.script.run.withSuccessHandler(ok||(()=>{})).withFailureHandler(fail||(e=>console.error(e)));
    r[name](...(args||[]));
  }
  let chatUsers=[];
  function rebuildChat(){
    const panel=$('chatPanel'); if(!panel)return;
    panel.innerHTML=`
      <div class="panel-head">
        <div><h3>Direct Messages</h3><div class="chat-peer-label" id="chatPeerLabel">Search an account</div></div>
        <button class="close-panel" data-v2-close>×</button>
      </div>
      <div class="chat-account-search">
        <input id="chatAccountSearch" type="search" placeholder="Search name or position..." autocomplete="off">
        <div id="chatAccountResults" class="chat-account-results"></div>
      </div>
      <div class="panel-body chat-list" id="chatList"><div class="chat-empty">Search and choose an account to start a private conversation.</div></div>
      <div class="chat-compose">
        <input id="chatInput" maxlength="1000" placeholder="Type a private message…" disabled>
        <button id="sendChatBtn" disabled>Send</button>
      </div>`;
    panel.querySelector('[data-v2-close]').onclick=()=>panel.classList.add('hidden');
    $('chatAccountSearch').addEventListener('input',renderAccountResults);
    $('sendChatBtn').onclick=sendChat;
    $('chatInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();sendChat();}});
  }

  function renderAccountResults(){
    const box=$('chatAccountResults'), input=$('chatAccountSearch');
    if(!box||!input)return;
    const q=input.value.trim().toLowerCase();
    const rows=(q
      ? chatUsers.filter(u=>(`${u.fullName} ${u.position||''} ${u.role||''}`).toLowerCase().includes(q))
      : chatUsers.slice(0,8));
    box.innerHTML=rows.map(u=>`
      <button type="button" class="chat-account-result ${String(u.id)===String(peerId)?'active':''}" data-chat-user="${esc(u.id)}">
        <span class="chat-account-avatar">${esc((u.fullName||'?').trim().charAt(0).toUpperCase())}</span>
        <span class="chat-account-copy">
          <b>${esc(u.fullName)}</b>
          <small>${esc(u.position||u.role||'User')}</small>
        </span>
      </button>`).join('') || '<div class="chat-account-none">No matching account.</div>';

    box.querySelectorAll('[data-chat-user]').forEach(btn=>{
      btn.onclick=()=>selectPeer(btn.dataset.chatUser);
    });
  }

  function selectPeer(id){
    const u=chatUsers.find(x=>String(x.id)===String(id));
    if(!u)return;
    peerId=String(u.id);
    $('chatPeerLabel').textContent=`Chatting with ${u.fullName}`;
    $('chatInput').disabled=false;
    $('sendChatBtn').disabled=false;
    $('chatAccountSearch').value=u.fullName;
    renderAccountResults();
    loadChat();
  }

  function loadUsers(){
    if(!token())return;
    rpc('collabListChatUsers',[token()],rows=>{
      chatUsers=Array.isArray(rows)?rows:[];
      const wanted=new URLSearchParams(location.search).get('chat')||peerId;
      renderAccountResults();
      if(wanted && chatUsers.some(u=>String(u.id)===String(wanted))){
        selectPeer(wanted);
        if(new URLSearchParams(location.search).has('chat'))$('chatPanel')?.classList.remove('hidden');
      }
    });
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
      $('notifList').innerHTML=rows.map(n=>`<div class="notif-item ${n.read?'':'unread'}" data-v2-nid="${esc(n.id)}" data-v2-url="${esc(n.actionUrl||'')}"><div class="notif-title">${esc(n.title)}</div><div class="notif-msg">${esc(n.message)}</div><div class="notif-time">${esc(n.createdAt)}</div>${n.actionUrl?'<div class="notif-open">Open →</div>':''}</div>`).join('')||'<div class="notif-msg">No notifications.</div>';
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
