create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'creator' check (role in ('creator','marketer','educator')),
  default_domain text not null default 'general',
  default_language text not null default 'en',
  default_voice text not null default 'Kore',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'creator')
  );
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- PROJECTS
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  source_type text not null check (source_type in ('paste','url','file')),
  source_url text,
  source_filename text,
  source_text text not null check (char_length(source_text) between 200 and 60000),
  source_word_count int not null default 0,
  domain text not null default 'general' check (domain in
    ('agriculture','education','marketing','technology','health','finance','travel','news','general')),
  target_platform text not null default 'youtube_shorts',
  aspect_ratio text not null default '9:16' check (aspect_ratio in ('9:16','16:9','1:1')),
  target_duration_seconds int not null default 45 check (target_duration_seconds between 15 and 180),
  tone text not null default 'informative',
  language text not null default 'en',
  audience text not null default '',
  voice_name text not null default 'Kore',
  visual_style text not null default 'cinematic',
  include_cta boolean not null default true,
  extra_instructions text not null default '',
  status text not null default 'draft' check (status in
    ('draft','analyzing','scripted','media_generating','ready','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_projects_user_created on public.projects (user_id, created_at desc);
create index idx_projects_user_status on public.projects (user_id, status);
create trigger trg_projects_updated before update on public.projects
  for each row execute function public.set_updated_at();

-- CONTENT ANALYSES (one per project)
create table public.content_analyses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  suggested_title text not null,
  summary text not null,
  key_points jsonb not null default '[]'::jsonb,
  detected_topic text not null default '',
  audience_insights jsonb not null default '{}'::jsonb,
  recommended_structure jsonb not null default '[]'::jsonb,
  model text not null,
  created_at timestamptz not null default now()
);
create index idx_analyses_user on public.content_analyses (user_id);

-- SCRIPTS (versioned)
create table public.scripts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  version int not null,
  video_title text not null,
  hook text not null,
  call_to_action text not null default '',
  caption_text text not null default '',
  hashtags text[] not null default '{}',
  total_duration_seconds int not null default 0,
  advisory_note text not null default '',
  model text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (project_id, version)
);
create unique index uq_scripts_one_active on public.scripts (project_id) where is_active;
create index idx_scripts_user on public.scripts (user_id);

-- SCENES
create table public.scenes (
  id uuid primary key default gen_random_uuid(),
  script_id uuid not null references public.scripts(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  scene_index int not null check (scene_index >= 0),
  duration_seconds numeric(5,2) not null check (duration_seconds between 1 and 30),
  narration text not null,
  on_screen_text text not null default '',
  visual_description text not null,
  image_prompt text not null,
  camera_motion text not null default 'slow_zoom_in' check (camera_motion in
    ('static','slow_zoom_in','slow_zoom_out','pan_left','pan_right','tilt_up','tilt_down')),
  transition text not null default 'cut' check (transition in ('cut','fade','slide','zoom','dissolve')),
  mood text not null default '',
  music_cue text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (script_id, scene_index) deferrable initially deferred
);
create index idx_scenes_project on public.scenes (project_id, scene_index);
create index idx_scenes_user on public.scenes (user_id);
create trigger trg_scenes_updated before update on public.scenes
  for each row execute function public.set_updated_at();

-- AUDIO ASSETS
create table public.audio_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  scene_id uuid references public.scenes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('scene','full_track')),
  storage_path text not null,
  voice_name text not null,
  duration_ms int not null default 0,
  mime_type text not null default 'audio/wav',
  created_at timestamptz not null default now()
);
create index idx_audio_project on public.audio_assets (project_id);
create index idx_audio_scene on public.audio_assets (scene_id);

-- IMAGE ASSETS
create table public.image_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  scene_id uuid not null references public.scenes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  prompt_used text not null,
  aspect_ratio text not null,
  mime_type text not null default 'image/png',
  created_at timestamptz not null default now()
);
create index idx_images_project on public.image_assets (project_id);
create index idx_images_scene on public.image_assets (scene_id);

-- EXPORTS
create table public.exports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('json','srt','vtt','audio_wav','images_zip','storyboard_pdf')),
  created_at timestamptz not null default now()
);
create index idx_exports_project on public.exports (project_id);

-- GENERATION LOGS (metadata only, never prompt or source content)
create table public.generation_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  operation text not null check (operation in ('analyze','script','regen_scene','tts','image')),
  model text not null,
  status text not null check (status in ('success','validation_failed','api_error','rate_limited')),
  latency_ms int not null default 0,
  error_code text,
  created_at timestamptz not null default now()
);
create index idx_genlogs_user_created on public.generation_logs (user_id, created_at desc);

-- STORAGE BUCKETS (private)
insert into storage.buckets (id, name, public)
values ('project-audio','project-audio', false), ('project-images','project-images', false)
on conflict (id) do nothing;

