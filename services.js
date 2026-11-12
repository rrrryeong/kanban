/* Supabase 어댑터: UI와 외부 SDK를 분리한다. */
(function (g, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./board') : g.KanbanBoard);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else g.KanbanServices = api;
})(typeof self !== 'undefined' ? self : this, function (Board) {
  function validateCredentials(email, password, confirmation) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('올바른 이메일을 입력해 주세요.');
    if (password.length < 12) throw new Error('비밀번호는 12자 이상이어야 합니다.');
    if (confirmation !== undefined && confirmation !== password) throw new Error('비밀번호 확인이 일치하지 않습니다.');
  }
  // JSON 객체 키 순서는 Postgres JSONB에서 바뀔 수 있으므로 정규화해 비교한다.
  function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
    return value;
  }
  function strictBoard(board) {
    try { return board?.version === 1 && JSON.stringify(canonical(Board.deserialize(JSON.stringify(board)))) === JSON.stringify(canonical(board)); }
    catch (_) { return false; }
  }
  function createServices(client, redirectTo) {
    async function unwrap(promise) {
      const { data, error } = await promise;
      if (error) throw error;
      return data;
    }
    async function rpc(name, args) {
      const result = await unwrap(client.rpc(name, args));
      const row = Array.isArray(result) ? result[0] : result;
      if (row && (!strictBoard(row.data) || !Number.isSafeInteger(row.revision))) throw new Error('저장된 보드 형식이 올바르지 않습니다.');
      return row;
    }
    return {
      auth: {
        session: async () => (await unwrap(client.auth.getSession())).session,
        subscribe: fn => client.auth.onAuthStateChange(fn).data.subscription,
        oauth: provider => unwrap(client.auth.signInWithOAuth({provider, options:{redirectTo}})),
        signIn: (email,password) => unwrap(client.auth.signInWithPassword({email,password})),
        signUp: (email,password) => unwrap(client.auth.signUp({email,password, options:{emailRedirectTo:redirectTo}})),
        resend: email => unwrap(client.auth.resend({type:'signup',email,options:{emailRedirectTo:redirectTo}})),
        reset: email => unwrap(client.auth.resetPasswordForEmail(email,{redirectTo})),
        updatePassword: password => unwrap(client.auth.updateUser({password})),
        signOut: () => unwrap(client.auth.signOut({scope:'local'})),
      },
      store: {
        load: () => rpc('load_board',{}),
        create: () => rpc('create_board',{}),
        save: (board,revision) => rpc('save_board',{p_data:board,p_revision:revision}),
        importBoard: (board,revision) => rpc('import_board',{p_data:board,p_revision:revision}),
      },
    };
  }
  return {createServices,validateCredentials,validBoard:strictBoard};
});
