const { createServices, validateCredentials, validBoard } = require('../services');
const Board = require('../board');

test('가입은 이메일, 12자 비밀번호, 확인 일치를 검증한다', () => {
  expect(() => validateCredentials('bad', '123456789012', '123456789012')).toThrow();
  expect(() => validateCredentials('a@b.com', 'short', 'short')).toThrow();
  expect(() => validateCredentials('a@b.com', '123456789012', 'different')).toThrow();
  expect(() => validateCredentials('a@b.com', '123456789012', '123456789012')).not.toThrow();
});
test('손상 보드는 빈 데이터로 바꾸지 않고 거절한다', () => {
  expect(validBoard(Board.createBoard())).toBe(true);
  expect(validBoard({version: 2})).toBe(false);
  expect(validBoard({...Board.createBoard(), columns:{todo:['missing'],'in-progress':[],done:[]}})).toBe(false);
});
test('저장은 소유자 없이 revision과 보드만 RPC로 전송한다', async () => {
  const row = {data:Board.createBoard(),revision:2};
  const client = {auth:{}, rpc:jest.fn().mockResolvedValue({data:row,error:null})};
  const services = createServices(client, 'https://example.com/kanban/');
  await expect(services.store.save(row.data,1)).resolves.toEqual(row);
  expect(client.rpc).toHaveBeenCalledWith('save_board',{p_data:row.data,p_revision:1});
});
test('RPC 충돌 오류를 상위 화면으로 전달한다', async () => {
  const error = {message:'BOARD_CONFLICT',code:'P0001'};
  const services = createServices({auth:{},rpc:jest.fn().mockResolvedValue({error})}, 'https://example.com/');
  await expect(services.store.save(Board.createBoard(),0)).rejects.toMatchObject(error);
});
test('OAuth 복귀 주소와 메일 주소를 설정하고 비밀번호는 별도 저장하지 않는다', async () => {
  const auth={signInWithOAuth:jest.fn().mockResolvedValue({data:{}}),signUp:jest.fn().mockResolvedValue({data:{session:null}})};
  const services=createServices({auth},'https://example.com/kanban/');
  await services.auth.oauth('google');
  expect(auth.signInWithOAuth).toHaveBeenCalledWith({provider:'google',options:{redirectTo:'https://example.com/kanban/'}});
  await services.auth.signUp('a@b.com','123456789012');
  expect(auth.signUp).toHaveBeenCalledWith({email:'a@b.com',password:'123456789012',options:{emailRedirectTo:'https://example.com/kanban/'}});
});
test('JSONB 키 순서가 바뀌어도 정상 보드는 읽는다',async()=>{
 const data={columns:{done:[],'in-progress':[],todo:[]},cards:{},version:1};
 const services=createServices({auth:{},rpc:jest.fn().mockResolvedValue({data:[{data,revision:0}]})},'https://example.com/');
 await expect(services.store.load()).resolves.toEqual({data,revision:0});
});
