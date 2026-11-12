begin;

create function public.valid_board(b jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare col text; cid jsonb; item record; seen text[] := '{}'; card jsonb;
begin
  if jsonb_typeof(b) is distinct from 'object' or b->'version' is distinct from '1'::jsonb
    or jsonb_typeof(b->'cards') is distinct from 'object'
    or jsonb_typeof(b->'columns') is distinct from 'object'
    or (select count(*) from jsonb_object_keys(b)) <> 3
    or (select count(*) from jsonb_object_keys(b->'columns')) <> 3 then return false; end if;
  foreach col in array array['todo','in-progress','done'] loop
    if jsonb_typeof(b->'columns'->col) is distinct from 'array' then return false; end if;
    for cid in select value from jsonb_array_elements(b->'columns'->col) loop
      if jsonb_typeof(cid) <> 'string' or cid #>> '{}' = any(seen)
        or not (b->'cards' ? (cid #>> '{}')) then return false; end if;
      seen := array_append(seen,cid #>> '{}');
    end loop;
  end loop;
  if cardinality(seen) <> (select count(*) from jsonb_object_keys(b->'cards')) then return false; end if;
  for item in select key,value from jsonb_each(b->'cards') loop
    card:=item.value;
    if item.key = '' or jsonb_typeof(card) <> 'object'
      or (select count(*) from jsonb_object_keys(card)) <> 5
      or card->>'id' is distinct from item.key
      or jsonb_typeof(card->'id') is distinct from 'string'
      or jsonb_typeof(card->'title') is distinct from 'string'
      or char_length(btrim(card->>'title')) not between 1 and 100
      or jsonb_typeof(card->'description') is distinct from 'string'
      or char_length(card->>'description') > 1000
      or jsonb_typeof(card->'createdAt') is distinct from 'string'
      or jsonb_typeof(card->'updatedAt') is distinct from 'string'
      or (card->>'createdAt') !~ '^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$'
      or (card->>'updatedAt') !~ '^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$' then return false; end if;
    perform (card->>'createdAt')::timestamptz, (card->>'updatedAt')::timestamptz;
  end loop;
  return true;
exception when others then return false;
end;
$$;

create table public.boards (
 user_id uuid primary key references auth.users(id) on delete cascade,
 data jsonb not null check(public.valid_board(data)),
 revision bigint not null default 0 check(revision >= 0),
 updated_at timestamptz not null default now()
);
alter table public.boards enable row level security;
create policy own_board_select on public.boards for select to authenticated using ((select auth.uid()) = user_id);
create policy own_board_insert on public.boards for insert to authenticated with check ((select auth.uid()) = user_id);
create policy own_board_update on public.boards for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.boards from public, anon, authenticated;
grant select on public.boards to authenticated;

create function public.load_board() returns setof public.boards language sql stable security invoker set search_path = '' as $$
 select * from public.boards where user_id = auth.uid();
$$;
create function public.create_board() returns public.boards language plpgsql security definer set search_path = '' as $$
declare result public.boards;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 insert into public.boards(user_id,data) values (auth.uid(),'{"version":1,"cards":{},"columns":{"todo":[],"in-progress":[],"done":[]}}') on conflict(user_id) do nothing;
 select * into result from public.boards where user_id=auth.uid();
 return result;
end;
$$;
create function public.save_board(p_data jsonb,p_revision bigint) returns public.boards language plpgsql security definer set search_path = '' as $$
declare result public.boards;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if not public.valid_board(p_data) then raise exception 'INVALID_BOARD'; end if;
 update public.boards set data=p_data,revision=revision+1,updated_at=clock_timestamp()
 where user_id=auth.uid() and revision=p_revision returning * into result;
 if not found then raise exception 'BOARD_CONFLICT'; end if;
 return result;
end;
$$;
create function public.import_board(p_data jsonb,p_revision bigint) returns public.boards language plpgsql security definer set search_path = '' as $$
declare current_board public.boards;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if not public.valid_board(p_data) then raise exception 'INVALID_BOARD'; end if;
 select * into current_board from public.boards where user_id=auth.uid() for update;
 if not found or current_board.revision <> p_revision then raise exception 'BOARD_CONFLICT'; end if;
 if current_board.data->'cards' <> '{}'::jsonb then raise exception 'BOARD_NOT_EMPTY'; end if;
 return public.save_board(p_data,p_revision);
end;
$$;
revoke all on function public.valid_board(jsonb), public.load_board(), public.create_board(), public.save_board(jsonb,bigint),public.import_board(jsonb,bigint) from public,anon,authenticated;
grant execute on function public.valid_board(jsonb), public.load_board(), public.create_board(), public.save_board(jsonb,bigint),public.import_board(jsonb,bigint) to authenticated;
commit;
