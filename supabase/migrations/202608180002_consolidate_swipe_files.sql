-- 1. Create the unified Swipe Files table
CREATE TABLE IF NOT EXISTS public.swipe_files (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null check (char_length(name) between 1 and 80),
  description text check (char_length(description) <= 500),
  is_system boolean not null default false,
  system_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, name)
);

-- 2. Create the unified Swipe File Items table
CREATE TABLE IF NOT EXISTS public.swipe_file_items (
  id uuid primary key default gen_random_uuid(),
  swipe_file_id uuid not null references public.swipe_files(id) on delete cascade,
  ad_id uuid not null references public.ads(id) on delete cascade,
  notes text check (char_length(notes) <= 5000),
  created_at timestamptz not null default now(),
  unique(swipe_file_id, ad_id)
);

-- RLS
alter table public.swipe_files enable row level security;
alter table public.swipe_file_items enable row level security;

create policy "users manage own swipe files" on public.swipe_files for all to authenticated
  using (auth.jwt()->>'sub' = user_id) with check (auth.jwt()->>'sub' = user_id);

create policy "users manage own swipe file items" on public.swipe_file_items for all to authenticated
  using (exists (select 1 from public.swipe_files s where s.id = swipe_file_id and s.user_id = auth.jwt()->>'sub'))
  with check (exists (select 1 from public.swipe_files s where s.id = swipe_file_id and s.user_id = auth.jwt()->>'sub'));

-- Trigger for updated_at
create trigger swipe_files_touch_updated_at before update on public.swipe_files for each row execute function public.touch_updated_at();

-- DATA MIGRATION
DO $$
DECLARE
  rec record;
  default_folder_id uuid;
BEGIN
  -- 1. Migrate custom collections to swipe_files
  INSERT INTO public.swipe_files (id, user_id, name, description, created_at, updated_at)
  SELECT id, user_id, name, description, created_at, updated_at
  FROM public.collections
  ON CONFLICT (user_id, name) DO NOTHING;

  -- 2. Ensure every user in saved_ads has a default "Saved Ads" swipe file
  FOR rec IN SELECT DISTINCT user_id FROM public.saved_ads LOOP
    SELECT id INTO default_folder_id FROM public.swipe_files WHERE user_id = rec.user_id AND name = 'Saved Ads';
    IF NOT FOUND THEN
      INSERT INTO public.swipe_files (user_id, name, is_system, system_key)
      VALUES (rec.user_id, 'Saved Ads', true, 'saved_ads')
      RETURNING id INTO default_folder_id;
    ELSE
      -- Update existing to be system
      UPDATE public.swipe_files SET is_system = true, system_key = 'saved_ads' WHERE id = default_folder_id;
    END IF;

    -- 3. Insert all saved_ads into the default swipe file
    INSERT INTO public.swipe_file_items (swipe_file_id, ad_id, notes, created_at)
    SELECT default_folder_id, ad_id, notes, created_at
    FROM public.saved_ads
    WHERE user_id = rec.user_id
    ON CONFLICT (swipe_file_id, ad_id) DO NOTHING;
  END LOOP;

  -- 4. Migrate collection_ads to swipe_file_items
  INSERT INTO public.swipe_file_items (swipe_file_id, ad_id, created_at)
  SELECT ca.collection_id, sa.ad_id, ca.created_at
  FROM public.collection_ads ca
  JOIN public.saved_ads sa ON sa.id = ca.saved_ad_id
  ON CONFLICT (swipe_file_id, ad_id) DO NOTHING;
END $$;
