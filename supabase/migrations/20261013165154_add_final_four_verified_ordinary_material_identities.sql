with approved_mapping (item_id, external_item_id, source_url) as (
  values
    ('SW-ITEM-131', '7020', 'https://bdocodex.com/ru/item/7020/'),
    ('SW-ITEM-133', '7348', 'https://bdocodex.com/ru/item/7348/'),
    ('SW-ITEM-135', '820110', 'https://bdocodex.com/ru/item/820110/'),
    ('SW-ITEM-136', '7347', 'https://bdocodex.com/ru/item/7347/')
)
insert into public.item_external_identities (
  item_id,
  provider,
  external_item_id,
  source_name,
  source_url,
  checked_at
)
select
  item_id,
  'bdo',
  external_item_id,
  'BDO Codex',
  source_url,
  statement_timestamp()
from approved_mapping;
