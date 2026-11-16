-- Nullable, provenance-aware metadata for the ad overview. This migration does
-- not generate or scrape data; trusted server-side enrichment jobs may populate it.
alter table public.ads
  add column if not exists business_contact_email text,
  add column if not exists business_contact_provenance text,
  add column if not exists business_contact_verified_at timestamptz,
  add column if not exists transcript_data jsonb,
  add column if not exists creative_analysis jsonb;

alter table public.ads
  drop constraint if exists ads_business_contact_email_valid,
  add constraint ads_business_contact_email_valid check (
    business_contact_email is null or (
      business_contact_email = lower(btrim(business_contact_email)) and
      business_contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' and
      business_contact_provenance is not null and
      char_length(business_contact_provenance) between 2 and 500
    )
  ),
  drop constraint if exists ads_transcript_data_shape,
  add constraint ads_transcript_data_shape check (
    transcript_data is null or (
      jsonb_typeof(transcript_data) = 'object' and
      transcript_data->>'status' in ('available', 'processing', 'unavailable', 'failed') and
      jsonb_typeof(coalesce(transcript_data->'segments', '[]'::jsonb)) = 'array'
    )
  ),
  drop constraint if exists ads_creative_analysis_shape,
  add constraint ads_creative_analysis_shape check (
    creative_analysis is null or (
      jsonb_typeof(creative_analysis) = 'object' and
      creative_analysis->>'status' in ('complete', 'partial', 'not_analyzed', 'failed')
    )
  );

comment on column public.ads.business_contact_email is
  'Verified public business contact email only; never inferred from a brand name.';
comment on column public.ads.business_contact_provenance is
  'Required source/provenance for a verified public business contact email.';
comment on column public.ads.transcript_data is
  'Timestamped transcript with explicit status and optional provenance.';
comment on column public.ads.creative_analysis is
  'Source-labelled creative analysis; must not be represented as platform targeting.';
