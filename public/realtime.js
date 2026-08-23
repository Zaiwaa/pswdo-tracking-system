(function(){
  if(typeof io!=='function')return;
  const socket=io();
  function identify(){const u=window.pswdoCurrentUser;if(u&&u.id)socket.emit('identify',u.id)}
  socket.on('connect',identify);
  socket.on('chat:new',()=>{if(window.__loadChat)window.__loadChat();if(window.__loadNotifications)window.__loadNotifications();});
  socket.on('notification:new',()=>{if(window.__loadNotifications)window.__loadNotifications();});
  window.addEventListener('pswdo:user',identify);
})();
