(function(){
  const tokenKey='pswdo_tracking_session';
  function rpc(fn,args,ok,fail){
    const token=localStorage.getItem(tokenKey)||'';
    fetch('/api/rpc/'+encodeURIComponent(fn),{
      method:'POST',
      headers:{'Content-Type':'application/json',...(token?{'Authorization':'Bearer '+token}:{})},
      body:JSON.stringify({args:args||[]})
    }).then(async r=>{const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||('Request failed ('+r.status+')'));return j.result;})
      .then(v=>ok&&ok(v)).catch(e=>fail?fail(e):console.error(e));
  }
  window.google={script:{run:null}};
  function runner(ok,fail){
    return new Proxy({}, {get(_t,prop){
      if(prop==='withSuccessHandler') return cb=>runner(cb,fail);
      if(prop==='withFailureHandler') return cb=>runner(ok,cb);
      return (...args)=>rpc(String(prop),args,ok,fail);
    }});
  }
  window.google.script.run=runner();
})();
