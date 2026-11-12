/* 공개 설정과 스키마 배포 상태만 확인한다. 데이터/계정을 생성하지 않는다. */
const fs = require('node:fs');
const vm = require('node:vm');
const context={window:{}};
vm.runInNewContext(fs.readFileSync('config.js','utf8'),context);
const config=context.window.KANBAN_CONFIG;
(async()=>{
 const headers={apikey:config.publishableKey,'Content-Type':'application/json'};
 const settingsResponse=await fetch(config.supabaseUrl+'/auth/v1/settings',{headers});
 if(!settingsResponse.ok) throw new Error('인증 설정 조회 실패: '+settingsResponse.status);
 const settings=await settingsResponse.json();
 let ready=true;
 for(const provider of ['email','google','github']) {
  const enabled=settings.external[provider];console.log(`${provider}: ${enabled?'활성':'미설정'}`);if(!enabled)ready=false;
 }
 if(settings.mailer_autoconfirm) {console.log('이메일 확인 활성화 필요');ready=false;}
 for(const [name,params] of [['load_board',{}],['create_board',{}],['save_board',{p_data:{},p_revision:0}],['import_board',{p_data:{},p_revision:0}]]) {
  const response=await fetch(config.supabaseUrl+'/rest/v1/rpc/'+name,{method:'POST',headers,body:JSON.stringify(params)});
  const body=await response.json();
  // 미인증 요청은 함수가 존재하더라도 반드시 거절되어야 한다.
  if(response.status===401 && body.code==='42501')console.log(name+': 배포됨, 미인증 실행 차단');
  else {console.log(name+': '+response.status+' '+JSON.stringify(body));ready=false;}
 }
 if(!ready)process.exitCode=1;
})().catch(error=>{console.error(error.message);process.exitCode=1;});
