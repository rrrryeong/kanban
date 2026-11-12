/** @jest-environment jsdom */
const fs=require('fs');
const Board=require('../board');
const {initApp}=require('../app');
let app;
beforeEach(()=>{document.body.innerHTML=fs.readFileSync('index.html','utf8').match(/<body>([\s\S]*)<\/body>/)[1];});
afterEach(()=>app?.destroy());
const flush=()=>new Promise(resolve=>setTimeout(resolve,0));
function add(){document.querySelector('[data-action=add]').click();document.querySelector('#card-title').value='원격 카드';document.querySelector('[data-card-form]').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));}
test('저장 성공 전에는 보드를 변경하지 않고 성공 후 확정한다',async()=>{
 let resolve;const save=jest.fn(()=>new Promise(r=>resolve=r));
 app=initApp({initialBoard:Board.createBoard(),persist:save});add();
 expect(save).toHaveBeenCalled(); expect(Object.keys(app.getState().cards)).toHaveLength(0);
 resolve();await flush();expect(Object.keys(app.getState().cards)).toHaveLength(1);
});
test('저장 실패는 입력과 기존 상태를 유지하고 재시도한다',async()=>{
 const save=jest.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce();
 app=initApp({initialBoard:Board.createBoard(),persist:save});add();await flush();
 expect(Object.keys(app.getState().cards)).toHaveLength(0);
 expect(document.querySelector('#card-title').value).toBe('원격 카드');
 expect(document.querySelector('[data-card-dialog]').hasAttribute('open')).toBe(true);
 document.querySelector('[data-card-form]').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await flush();
 expect(Object.keys(app.getState().cards)).toHaveLength(1);
});
test('폐기된 계정의 늦은 저장 응답은 무시한다',async()=>{
 let resolve;app=initApp({initialBoard:Board.createBoard(),persist:()=>new Promise(r=>resolve=r)});add();app.destroy();resolve();await flush();
 expect(document.querySelectorAll('.card')).toHaveLength(0);
});
