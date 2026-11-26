
alter table public.items
  add column if not exists image_urls text[] not null default '{}'::text[];

update public.items
set image_urls = array[image_url]
where image_url is not null
  and cardinality(image_urls) = 0;
