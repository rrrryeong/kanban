/** @jest-environment jsdom */
const fs=require('fs');
const Board=require('../board');
const Services=require('../services');
const {start}=require('../bootstrap');
let mounted, listener, controller;
const tick=()=>new Promise(r=>setTimeout(r,0));
function setup(store){
 document.body.innerHTML=fs.readFileSync('index.html','utf8').match(/<body>([\s\S]*)<\/body>/)[1];
 window.KanbanBoard=Board;window.KanbanServices=Services;
 mounted={destroy:jest.fn(),isEditing:()=>false,getState:()=>Board.createBoard()};
 window.KanbanApp={initApp:jest.fn(()=>mounted)};
 return {store,auth:{session:async()=>({user:{id:'a',email:'a@b.com'}}),subscribe:cb=>{listener=cb;return{unsubscribe:jest.fn()};}}};
}
afterEach(()=>controller?.destroy());
test('로그아웃 뒤 도착한 이전 계정의 조회 응답은 렌더링하지 않는다',async()=>{
 let resolve;const store={load:()=>new Promise(r=>resolve=r)};
 const pending=start({services:setup(store)});await tick();
 listener('SIGNED_OUT',null);await tick();
 resolve({data:Board.createBoard(),revision:0});controller=await pending;
 expect(window.KanbanApp.initApp).not.toHaveBeenCalled();
 expect(document.querySelector('[data-workspace]').hidden).toBe(true);
});
test('계정 변경은 기존 보드 인스턴스를 폐기한다',async()=>{
 controller=await start({services:setup({load:async()=>({data:Board.createBoard(),revision:0})})});
 listener('SIGNED_IN',{user:{id:'b',email:'b@b.com'}});
 expect(mounted.destroy).toHaveBeenCalled();await tick();
 expect(window.KanbanApp.initApp).toHaveBeenCalledTimes(2);
});
test('토큰 갱신은 기존 편집 인스턴스를 다시 만들지 않는다',async()=>{
 controller=await start({services:setup({load:async()=>({data:Board.createBoard(),revision:0})})});
 listener('TOKEN_REFRESHED',{user:{id:'a',email:'a@b.com'}});await tick();
 expect(window.KanbanApp.initApp).toHaveBeenCalledTimes(1);
});
