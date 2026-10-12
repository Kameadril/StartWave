with approved_mapping (item_id, external_item_id, source_url) as (
  values
    ('SW-ITEM-119', '7001', 'https://bdocodex.com/ru/item/7001/'),
    ('SW-ITEM-120', '7002', 'https://bdocodex.com/ru/item/7002/'),
    ('SW-ITEM-121', '7005', 'https://bdocodex.com/ru/item/7005/'),
    ('SW-ITEM-122', '820117', 'https://bdocodex.com/ru/item/820117/'),
    ('SW-ITEM-129', '7022', 'https://bdocodex.com/ru/item/7022/'),
    ('SW-ITEM-130', '7021', 'https://bdocodex.com/ru/item/7021/'),
    ('SW-ITEM-123', '7003', 'https://bdocodex.com/ru/item/7003/'),
    ('SW-ITEM-126', '7004', 'https://bdocodex.com/ru/item/7004/'),
    ('SW-ITEM-124', '7306', 'https://bdocodex.com/ru/item/7306/'),
    ('SW-ITEM-127', '820120', 'https://bdocodex.com/ru/item/820120/'),
    ('SW-ITEM-128', '820123', 'https://bdocodex.com/ru/item/820123/'),
    ('SW-ITEM-125', '7301', 'https://bdocodex.com/ru/item/7301/')
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
