const {PGlite}=require('@electric-sql/pglite');
const fs=require('fs');
const Board=require('../board');
let db;
const A='00000000-0000-4000-8000-000000000001', B='00000000-0000-4000-8000-000000000002';
async function asUser(uid,fn){await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false);`);try{return await fn();}finally{await db.exec('reset role;');}}
const call=(name,args=[])=>db.query(`select * from public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')})`,args);
beforeAll(async()=>{
 db=new PGlite();
 await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key,email text,aud text,role text); insert into auth.users(id) values ('${A}'),('${B}'); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`);
 await db.exec(fs.readFileSync('supabase/migrations/202611120001_boards.sql','utf8'));
},30000);
afterAll(()=>db?.close());
test('미인증 접근은 RPC와 테이블 모두 거절한다',async()=>{
 await db.exec('set role anon');
 try{await expect(call('load_board')).rejects.toThrow();await expect(db.query('select * from public.boards')).rejects.toThrow();}finally{await db.exec('reset role');}
});
test('계정마다 보드 하나를 만들고 타인의 데이터는 읽을 수 없다',async()=>{
 await asUser(A,async()=>{await call('create_board');await call('create_board');expect((await db.query('select * from public.boards')).rows).toHaveLength(1);});
 await asUser(B,async()=>{expect((await db.query('select * from public.boards')).rows).toHaveLength(0);await call('create_board');});
});
test('직접 소유자 위조와 쓰기는 거절하고 RPC revision을 강제한다',async()=>{
 await asUser(A,async()=>{
  await expect(db.query('update public.boards set user_id=$1',[B])).rejects.toThrow();
  const data=Board.addCard(Board.createBoard(),'todo',{title:'A private'},{id:'a'});
  const saved=(await call('save_board',[data,0])).rows[0];expect(saved.revision).toBe(1);
  await expect(call('save_board',[data,0])).rejects.toThrow('BOARD_CONFLICT');
 });
 await asUser(B,async()=>expect((await call('load_board')).rows[0].data.cards).toEqual({}));
});
test('잘못된 보드와 고아/중복 참조, 제목 한도를 서버에서 거절한다',async()=>{
 const valid=Board.addCard(Board.createBoard(),'todo',{title:'valid'},{id:'x'});
 const invalid=[{version:2}, {...valid,columns:{...valid.columns,done:['x']}}, {...valid,columns:{...valid.columns,todo:[]}}, {...valid,cards:{x:{...valid.cards.x,title:'x'.repeat(101)}}}];
 await asUser(B,async()=>{for(const data of invalid)await expect(call('save_board',[data,0])).rejects.toThrow('INVALID_BOARD');});
});
test('가져오기는 빈 보드와 revision을 잠금 안에서 다시 확인한다',async()=>{
 const data=Board.addCard(Board.createBoard(),'done',{title:'legacy'},{id:'legacy'});
 await asUser(B,async()=>{expect((await call('import_board',[data,0])).rows[0].revision).toBe(1);await expect(call('import_board',[data,1])).rejects.toThrow('BOARD_NOT_EMPTY');});
});

test('운영 SQL 검증 스크립트는 PASS 후 테스트 데이터를 롤백한다',async()=>{
 const before=(await db.query('select count(*)::int as n from auth.users')).rows[0].n;
 const result=await db.exec(fs.readFileSync('supabase/tests/boards.sql','utf8'));
 expect(result[result.length-1].rows[0].result).toContain('PASS:');
 expect((await db.query('select count(*)::int as n from auth.users')).rows[0].n).toBe(before);
});
