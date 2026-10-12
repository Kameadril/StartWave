with approved_mapping (item_id, external_item_id, source_url) as (
  values
    ('SW-ITEM-100', '5401', 'https://bdocodex.com/ru/item/5401/'),
    ('SW-ITEM-101', '5402', 'https://bdocodex.com/ru/item/5402/'),
    ('SW-ITEM-102', '820101', 'https://bdocodex.com/ru/item/820101/'),
    ('SW-ITEM-103', '820102', 'https://bdocodex.com/ru/item/820102/'),
    ('SW-ITEM-104', '820107', 'https://bdocodex.com/ru/item/820107/'),
    ('SW-ITEM-105', '5519', 'https://bdocodex.com/ru/item/5519/'),
    ('SW-ITEM-106', '5521', 'https://bdocodex.com/ru/item/5521/'),
    ('SW-ITEM-107', '5517', 'https://bdocodex.com/ru/item/5517/'),
    ('SW-ITEM-108', '5550', 'https://bdocodex.com/ru/item/5550/')
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
