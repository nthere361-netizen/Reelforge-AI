alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.content_analyses enable row level security;
alter table public.scripts enable row level security;
alter table public.scenes enable row level security;
alter table public.audio_assets enable row level security;
alter table public.image_assets enable row level security;
alter table public.exports enable row level security;
alter table public.generation_logs enable row level security;

-- profiles: id is the owner key
create policy profiles_select on public.profiles for select using ((select auth.uid()) = id);
create policy profiles_update on public.profiles for update
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- generic owner policies for user_id tables
do $$
declare t text;
begin
  foreach t in array array['projects','content_analyses','scripts','scenes',
                            'audio_assets','image_assets','exports']
  loop
    execute format('create policy %I on public.%I for select using ((select auth.uid()) = user_id)', t||'_select', t);
    execute format('create policy %I on public.%I for insert with check ((select auth.uid()) = user_id)', t||'_insert', t);
    execute format('create policy %I on public.%I for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t||'_update', t);
    execute format('create policy %I on public.%I for delete using ((select auth.uid()) = user_id)', t||'_delete', t);
  end loop;
end $$;

-- generation_logs: users may only read their own; inserts come from the server
create policy genlogs_select on public.generation_logs for select using ((select auth.uid()) = user_id);
create policy genlogs_insert on public.generation_logs for insert with check ((select auth.uid()) = user_id);

-- storage: objects live under <user_id>/<project_id>/...
create policy storage_audio_owner on storage.objects for all
  using (bucket_id = 'project-audio' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'project-audio' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy storage_images_owner on storage.objects for all
  using (bucket_id = 'project-images' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'project-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

