with approved_mapping (item_id, external_item_id, source_url) as (
  values
    ('SW-ITEM-109', '7307', 'https://bdocodex.com/ru/item/7307/'),
    ('SW-ITEM-110', '7309', 'https://bdocodex.com/ru/item/7309/'),
    ('SW-ITEM-111', '7018', 'https://bdocodex.com/ru/item/7018/'),
    ('SW-ITEM-112', '7016', 'https://bdocodex.com/ru/item/7016/'),
    ('SW-ITEM-113', '7017', 'https://bdocodex.com/ru/item/7017/'),
    ('SW-ITEM-114', '7026', 'https://bdocodex.com/ru/item/7026/'),
    ('SW-ITEM-115', '7304', 'https://bdocodex.com/ru/item/7304/'),
    ('SW-ITEM-116', '7360', 'https://bdocodex.com/ru/item/7360/'),
    ('SW-ITEM-117', '820108', 'https://bdocodex.com/ru/item/820108/'),
    ('SW-ITEM-118', '820113', 'https://bdocodex.com/ru/item/820113/')
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
