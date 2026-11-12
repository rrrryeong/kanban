-- SQL Editor에서 실행. 테스트 사용자와 보드 변경은 마지막 ROLLBACK으로 모두 취소한다.
begin;
insert into auth.users(id,email,aud,role) values
 ('ba838559-f4f9-4c53-938c-7cc4b9ec0001','kanban-rls-a@example.invalid','authenticated','authenticated'),
 ('ba838559-f4f9-4c53-938c-7cc4b9ec0002','kanban-rls-b@example.invalid','authenticated','authenticated');

set local role anon;
do $$ begin
  begin perform public.load_board(); raise exception 'TEST FAILED: anonymous RPC allowed';
  exception when insufficient_privilege then null; end;
  begin perform * from public.boards; raise exception 'TEST FAILED: anonymous SELECT allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','ba838559-f4f9-4c53-938c-7cc4b9ec0001',true);
do $$
declare b public.boards;
begin
 b:=public.create_board();
 if b.user_id <> auth.uid() or b.revision <> 0 then raise exception 'TEST FAILED: create'; end if;
 b:=public.create_board();
 begin update public.boards set user_id='ba838559-f4f9-4c53-938c-7cc4b9ec0002'; raise exception 'TEST FAILED: direct write';
 exception when insufficient_privilege then null; end;
 b:=public.save_board('{"version":1,"cards":{},"columns":{"todo":[],"in-progress":[],"done":[]}}',0);
 if b.revision <> 1 then raise exception 'TEST FAILED: revision'; end if;
 begin perform public.save_board(b.data,0); raise exception 'TEST FAILED: stale write';
 exception when raise_exception then if sqlerrm <> 'BOARD_CONFLICT' then raise; end if; end;
 begin perform public.save_board('{"version":2}',1); raise exception 'TEST FAILED: invalid board';
 exception when raise_exception then if sqlerrm <> 'INVALID_BOARD' then raise; end if; end;
end $$;

select set_config('request.jwt.claim.sub','ba838559-f4f9-4c53-938c-7cc4b9ec0002',true);
do $$
declare b public.boards;
begin
 if exists(select 1 from public.boards) then raise exception 'TEST FAILED: cross-user SELECT'; end if;
 if exists(select 1 from public.load_board()) then raise exception 'TEST FAILED: cross-user RPC'; end if;
 b:=public.create_board();
 b:=public.import_board('{"version":1,"cards":{"x":{"id":"x","title":"test","description":"","createdAt":"2026-11-12T00:00:00.000Z","updatedAt":"2026-11-12T00:00:00.000Z"}},"columns":{"todo":["x"],"in-progress":[],"done":[]}}',0);
 begin perform public.import_board(b.data,1); raise exception 'TEST FAILED: nonempty import';
 exception when raise_exception then if sqlerrm <> 'BOARD_NOT_EMPTY' then raise; end if; end;
 if (select count(*) from public.boards) <> 1 then raise exception 'TEST FAILED: isolation'; end if;
end $$;
reset role;
rollback;
select 'PASS: anonymous / ownership / revision / validation / import; all test changes rolled back' as result;
