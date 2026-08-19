
(function(){
  function applyDeepLink(){
    const ref=new URLSearchParams(location.search).get('ref'); if(!ref)return;
    let tries=0;
    const timer=setInterval(()=>{tries++;const input=document.getElementById('dtSearchInput');if(input){input.value=ref;if(typeof dtApplyFilters==='function')dtApplyFilters();}
      if(typeof dtAllRecords!=='undefined'&&Array.isArray(dtAllRecords)){const d=dtAllRecords.find(x=>String(x.referenceNumber)===String(ref));if(d&&typeof dtView==='function'){clearInterval(timer);setTimeout(()=>dtView(d.id),150);}}
      if(tries>24)clearInterval(timer);
    },250);
  }
  document.addEventListener('DOMContentLoaded',applyDeepLink);
})();
