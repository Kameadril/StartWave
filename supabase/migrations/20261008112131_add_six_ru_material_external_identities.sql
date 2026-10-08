with approved_mapping (item_id, external_item_id, source_url) as (
  values
    ('SW-ITEM-004', '4052', 'https://bdocodex.com/ru/item/4052/'),
    ('SW-ITEM-053', '4801', 'https://bdocodex.com/ru/item/4801/'),
    ('SW-ITEM-054', '4802', 'https://bdocodex.com/ru/item/4802/'),
    ('SW-ITEM-055', '4803', 'https://bdocodex.com/ru/item/4803/'),
    ('SW-ITEM-056', '4805', 'https://bdocodex.com/ru/item/4805/'),
    ('SW-ITEM-057', '4804', 'https://bdocodex.com/ru/item/4804/')
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
