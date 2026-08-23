
(function(){
  function enhance(){
    document.querySelectorAll('[data-status]').forEach(sel=>{
      const cell=sel.closest('td'); if(!cell||cell.querySelector('[data-quick-approve]'))return;
      const b=document.createElement('button');b.type='button';b.dataset.quickApprove=sel.dataset.status;b.textContent='Approve';
      b.style.cssText='margin-left:7px;background:#15803d;color:#fff;border:0;border-radius:8px;padding:8px 10px;font-weight:800;cursor:pointer;display:'+(sel.value==='Pending'?'inline-block':'none');
      sel.addEventListener('change',()=>b.style.display=sel.value==='Pending'?'inline-block':'none');
      b.onclick=()=>google.script.run.withSuccessHandler(()=>{sel.value='Active';b.style.display='none';alert('Account approved.');}).withFailureHandler(e=>alert(e.message||e)).adminApproveUser(sel.dataset.status);
      cell.appendChild(b);
    });
    const p=new URLSearchParams(location.search);
    if(p.get('section')==='deletions')document.getElementById('adminDeletionBody')?.scrollIntoView({behavior:'smooth',block:'center'});
    if(p.get('section')==='users')document.getElementById('adminUsersBody')?.scrollIntoView({behavior:'smooth',block:'center'});
  }
  document.addEventListener('DOMContentLoaded',()=>{enhance();new MutationObserver(enhance).observe(document.body,{subtree:true,childList:true});});
})();
