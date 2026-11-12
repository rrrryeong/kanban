/* 인증된 계정에만 보드 인스턴스를 연결한다. */
(function (g) {
  'use strict';
  async function start({services, root = document} = {}) {
    const $ = s => root.querySelector(s);
    const Board = g.KanbanBoard;
    const UI = g.KanbanApp;
    const panel = $('[data-auth-panel]');
    const form = $('[data-auth-form]');
    const status = $('[data-auth-status]');
    const cloudStatus = $('[data-cloud-status]');
    const workspace = $('[data-workspace]');
    const listeners=[];
    let disposed=false;
    function listen(target,type,fn) { target.addEventListener(type,fn); listeners.push(()=>target.removeEventListener(type,fn)); }
    let mode = 'login', app, session, generation = 0, revision, authBusy = false, recovery = false, loading = false;
    let draft = null;
    let currentUser = null;
    function message(error) {
      const text = error?.message || '';
      if (text.includes('BOARD_CONFLICT') || text.includes('BOARD_NOT_EMPTY')) return '다른 곳에서 보드가 변경되었습니다. 초안을 보관한 뒤 최신 보드를 불러와 다시 적용해 주세요.';
      if (/Invalid login credentials/i.test(text)) return '이메일 또는 비밀번호를 확인해 주세요.';
      if (/Email not confirmed/i.test(text)) return '이메일 확인 후 로그인해 주세요. 확인 메일을 재발송할 수 있습니다.';
      if (/rate|too many/i.test(text)) return '요청이 많습니다. 잠시 후 다시 시도해 주세요.';
      if (/code verifier|flow state|expired|access_denied|denied/i.test(text)) return '인증이 취소되었거나 만료되었습니다. 메일을 요청한 브라우저에서 다시 시도해 주세요.';
      return '요청을 완료하지 못했습니다. 연결 및 설정을 확인하고 다시 시도해 주세요.';
    }
    function setMode(value) {
      mode=value;
      $('[data-auth-title]').textContent = {login:'로그인',signup:'회원가입',reset:'비밀번호 찾기',password:'새 비밀번호 설정'}[mode];
      $('[data-password-field]').hidden = mode === 'reset';
      $('[data-email-field]').hidden = mode === 'password';
      $('[data-confirm-field]').hidden = !['signup','password'].includes(mode);
      $('[data-auth-submit]').textContent = {login:'로그인',signup:'가입하기',reset:'재설정 메일 보내기',password:'비밀번호 변경'}[mode];
      $('[data-password]').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
      $('[data-oauth-buttons]').hidden = mode === 'password';
      status.textContent='';
      (mode === 'password' ? $('[data-password]') : $('[data-email]')).focus();
    }
    function clearBoard() {
      generation++;
      app?.destroy(); app=null; currentUser=null;
      workspace.hidden=true;
      $('[data-account]').hidden=true;
      $('[data-legacy]').hidden=true;
      $('[data-draft]').hidden=true;
      $('[data-draft-text]').textContent='';
      $('[data-legacy-preview]').textContent='';
      cloudStatus.textContent=''; draft=null;
      loading=false;
    }
    function showLegacy() {
      $('[data-legacy]').hidden=true;
      try {
        if (Object.keys(app.getState().cards).length || localStorage.getItem(`kanban.imported.${session.user.id}`)) return;
        const raw=localStorage.getItem('kanban.board');
        const board=JSON.parse(raw);
        if (!g.KanbanServices.validBoard(board) || !Object.keys(board.cards).length) return;
        $('[data-legacy-preview]').textContent=JSON.stringify(board,null,2);
        $('[data-legacy]').hidden=false;
      } catch (_) { /* 원본은 보존하고 손상 데이터는 가져오지 않는다. */ }
    }
    async function loadBoard({refresh=false}={}) {
      if (!session || recovery || loading || (refresh && app?.isEditing())) return;
      const token=++generation;
      const userId=session.user.id;
      loading=true;
      workspace.inert=true;
      $('[data-account]').hidden=false;
      $('[data-user]').textContent=session.user.email || '로그인 사용자';
      panel.hidden=true;
      cloudStatus.textContent='보드를 불러오는 중입니다…';
      try {
        let row=await services.store.load();
        if (token!==generation) return;
        if (!row) row=await services.store.create();
        if (token!==generation) return;
        app?.destroy();
        revision=row.revision;
        app=UI.initApp({root,initialBoard:row.data,persist:async board=>{
          const saved=await services.store.save(board,revision);
          if (token!==generation) throw new Error('STALE_SESSION');
          revision=saved.revision;
          cloudStatus.textContent='저장되었습니다.';
          $('[data-legacy]').hidden=true;
        },onBusy:busy=>{
          if (token===generation && busy) cloudStatus.textContent='저장 중입니다…';
        },onError:(error,next)=>{
          cloudStatus.textContent='저장 실패. '+message(error);
          draft=next;
          $('[data-draft-text]').textContent=JSON.stringify(draft,null,2);
          $('[data-draft]').hidden=false;
        }});
        currentUser=userId;
        workspace.hidden=false;
        workspace.inert=false;
        cloudStatus.textContent='';
        showLegacy();
      } catch(error) {
        if(token===generation) { cloudStatus.textContent='보드 조회 실패. '+message(error); workspace.inert=true; }
      } finally { if(token===generation) loading=false; }
    }
    async function receive(event,next) {
      if(disposed) return;
      if (event==='PASSWORD_RECOVERY') {
        recovery=true; session=next; clearBoard(); panel.hidden=false; setMode('password'); return;
      }
      const changed=session?.user.id!==next?.user.id;
      if (changed || !next) clearBoard();
      session=next;
      if(!session) { recovery=false; panel.hidden=false; setMode('login'); return; }
      if(recovery) return;
      if(currentUser===session.user.id && app) return;
      await loadBoard();
    }
    async function action(fn) {
      if(authBusy) return;
      authBusy=true;
      panel.querySelectorAll('button').forEach(b=>b.disabled=true);
      try { await fn(); } catch(error) {status.textContent=message(error);}
      finally {authBusy=false;panel.querySelectorAll('button').forEach(b=>b.disabled=false);}
    }
    listen(form,'submit',event=>{
      event.preventDefault();
      action(async()=>{
        const email=$('[data-email]').value.trim();
        const password=$('[data-password]').value;
        if(mode==='password') {
          g.KanbanServices.validateCredentials('valid@example.com',password,$('[data-confirm]').value);
          await services.auth.updatePassword(password);
          recovery=false;
          await services.auth.signOut();
          await receive('SIGNED_OUT',null);
          status.textContent='비밀번호를 변경했습니다. 다시 로그인해 주세요.';
        } else if(mode==='reset') {
          g.KanbanServices.validateCredentials(email,'000000000000');
          await services.auth.reset(email);
          status.textContent='재설정 메일을 요청했습니다. 같은 브라우저에서 링크를 열어 주세요.';
        } else if(mode==='signup') {
          g.KanbanServices.validateCredentials(email,password,$('[data-confirm]').value);
          await services.auth.signUp(email,password);
          status.textContent='확인 메일을 요청했습니다. 같은 브라우저에서 확인 후 로그인해 주세요.';
        } else {
          g.KanbanServices.validateCredentials(email,'000000000000');
          if(!password) throw new Error('password');
          const result=await services.auth.signIn(email,password);
          await receive('SIGNED_IN',result.session);
        }
        $('[data-password]').value=''; $('[data-confirm]').value='';
      });
    });
    listen(root,'click',event=>{
      const target=event.target.closest('button');
      if(!target) return;
      if(target.dataset.authMode) {setMode(target.dataset.authMode);return;}
      if(target.dataset.provider) action(()=>services.auth.oauth(target.dataset.provider));
      if(target.matches('[data-resend]')) action(async()=>{
        const email=$('[data-email]').value.trim();
        g.KanbanServices.validateCredentials(email,'000000000000');
        await services.auth.resend(email);status.textContent='확인 메일을 재요청했습니다. 같은 브라우저에서 확인해 주세요.';
      });
      if(target.matches('[data-logout]')) {
        $('[data-password]').value=''; $('[data-confirm]').value='';
        clearBoard(); session=null; recovery=false; panel.hidden=false; setMode('login');
        action(async()=>{await services.auth.signOut();await receive('SIGNED_OUT',null);});
      }
      if(target.matches('[data-reload-board]')) {
        // 최신 보드를 불러와도 충돌 초안은 아래 텍스트 영역에 남긴다.
        app?.destroy();app=null;loadBoard();
      }
      if(target.matches('[data-import]')) action(async()=>{
        if(!app || app.isEditing()) return;
        const token=generation, uid=session.user.id;
        const board=JSON.parse($('[data-legacy-preview]').textContent);
        workspace.inert=true;
        try {
          await services.store.importBoard(board,revision);
          if(token!==generation) return;
          try {localStorage.setItem(`kanban.imported.${uid}`,'1');} catch(_) {}
          await loadBoard();
        } catch(error) {if(token===generation) cloudStatus.textContent='가져오기 실패. '+message(error);}
        finally {if(token===generation)workspace.inert=false;}
      });
      if(target.matches('[data-skip-import]')) $('[data-legacy]').hidden=true;
    });
    listen(document,'visibilitychange',()=>{if(document.visibilityState==='visible')loadBoard({refresh:true});});
    listen(window,'focus',()=>loadBoard({refresh:true}));
    try {
      if(!services) {
        const config=g.KANBAN_CONFIG;
        if(!config?.supabaseUrl || !config?.publishableKey || !g.supabase) throw new Error('CONFIG');
        const client=g.supabase.createClient(config.supabaseUrl,config.publishableKey,{auth:{flowType:'pkce',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'kanban.auth'}});
        services=g.KanbanServices.createServices(client,location.origin+location.pathname);
      }
      const subscription=services.auth.subscribe((event,next)=>{
        // SDK의 Auth 잠금 안에서 비동기 SDK 호출을 하지 않는다.
        if(event==='SIGNED_OUT' || (session && session.user.id!==next?.user.id)) {
          clearBoard(); $('[data-password]').value=''; $('[data-confirm]').value='';
        }
        setTimeout(()=>receive(event,next).catch(error=>{status.textContent=message(error);}),0);
      });
      const initial=await services.auth.session();
      if(!recovery) await receive('INITIAL_SESSION',initial);
      const url=new URL(location.href);
      const error=url.searchParams.get('error_description') || new URLSearchParams(url.hash.slice(1)).get('error_description');
      if(error) status.textContent=message({message:error});
      if(url.searchParams.has('code') || error) {
        ['code','error','error_code','error_description'].forEach(key=>url.searchParams.delete(key));url.hash='';history.replaceState(null,'',url);
      }
      return {destroy:()=>{disposed=true;subscription.unsubscribe();listeners.forEach(remove=>remove());clearBoard();}};
    } catch(error) { clearBoard();panel.hidden=false;setMode('login');status.textContent=message(error)+' GITHUB.md의 Supabase 설정을 확인해 주세요.'; }
  }
  g.KanbanBootstrap={start};
  if(typeof module==='object' && module.exports) module.exports={start};
  else if(g.document) {if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>start());else start();}
})(typeof window!=='undefined'?window:globalThis);
