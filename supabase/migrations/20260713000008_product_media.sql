-- Fancy Finery — support images AND videos as product media.
-- product_images now carries a media_type; the bucket holds both.
alter table public.product_images
  add column if not exists media_type text not null default 'image'
    check (media_type in ('image', 'video'));
