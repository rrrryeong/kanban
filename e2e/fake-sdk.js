/* 테스트에서 vendor SDK 요청에만 대신 응답하는 SDK 대역. 운영에서는 로드하지 않는다. */
window.supabase={createClient(){
 const callbacks=[];
 const member={user:{id:'member',email:'member@example.com'}};
 let session=localStorage.getItem('__signedout')?null:member;
 const emit=(event,next)=>{session=next;callbacks.forEach(cb=>cb(event,next));};
 window.__authEvent=emit;
 async function request(name,args){
  const response=await fetch('/__kanban_test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,args,user:session?.user.id,seed:window.__seedBoard,fail:window.__failSave,loadFail:window.__failLoad})});
  const data=await response.json();return data;
 }
 return {auth:{
  getSession:async()=>({data:{session}}),
  onAuthStateChange:cb=>{callbacks.push(cb);return{data:{subscription:{unsubscribe(){callbacks.splice(callbacks.indexOf(cb),1);}}}};},
  signInWithPassword:async({email,password})=>{if(password==='wrong')return{error:{message:'Invalid login credentials'}};localStorage.removeItem('__signedout');const next={user:{id:email==='other@example.com'?'other':'member',email}};emit('SIGNED_IN',next);return{data:{session:next}};},
  signUp:async()=>({data:{session:null}}),
  signInWithOAuth:async({provider})=>{window.__provider=provider;if(window.__oauthFail)return{error:{message:'access_denied'}};emit('SIGNED_IN',member);return{data:{session:member}};},
  resend:async()=>({data:{}}),resetPasswordForEmail:async()=>({data:{}}),updateUser:async()=>({data:{}}),
  signOut:async()=>{localStorage.setItem('__signedout','1');emit('SIGNED_OUT',null);return{data:{}};},
 },rpc:request};
}};
