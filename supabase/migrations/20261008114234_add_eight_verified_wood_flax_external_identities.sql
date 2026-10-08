with approved_mapping (item_id, external_item_id, source_url) as (
  values
    ('SW-ITEM-002', '4652', 'https://bdocodex.com/ru/item/4652/'),
    ('SW-ITEM-016', '4603', 'https://bdocodex.com/ru/item/4603/'),
    ('SW-ITEM-019', '4661', 'https://bdocodex.com/ru/item/4661/'),
    ('SW-ITEM-020', '4664', 'https://bdocodex.com/ru/item/4664/'),
    ('SW-ITEM-021', '4667', 'https://bdocodex.com/ru/item/4667/'),
    ('SW-ITEM-022', '4655', 'https://bdocodex.com/ru/item/4655/'),
    ('SW-ITEM-006', '5802', 'https://bdocodex.com/ru/item/5802/'),
    ('SW-ITEM-007', '5856', 'https://bdocodex.com/ru/item/5856/')
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
