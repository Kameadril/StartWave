with approved_mapping (item_id, external_item_id, source_url) as (
  values
    ('SW-ITEM-061', '5001', 'https://bdocodex.com/ru/item/5001/'),
    ('SW-ITEM-062', '5002', 'https://bdocodex.com/ru/item/5002/'),
    ('SW-ITEM-063', '5009', 'https://bdocodex.com/ru/item/5009/'),
    ('SW-ITEM-064', '5004', 'https://bdocodex.com/ru/item/5004/'),
    ('SW-ITEM-065', '5010', 'https://bdocodex.com/ru/item/5010/'),
    ('SW-ITEM-066', '5003', 'https://bdocodex.com/ru/item/5003/'),
    ('SW-ITEM-067', '5012', 'https://bdocodex.com/ru/item/5012/'),
    ('SW-ITEM-068', '5013', 'https://bdocodex.com/ru/item/5013/'),
    ('SW-ITEM-069', '5015', 'https://bdocodex.com/ru/item/5015/'),
    ('SW-ITEM-070', '5014', 'https://bdocodex.com/ru/item/5014/'),
    ('SW-ITEM-071', '5016', 'https://bdocodex.com/ru/item/5016/'),
    ('SW-ITEM-072', '5018', 'https://bdocodex.com/ru/item/5018/'),
    ('SW-ITEM-073', '5017', 'https://bdocodex.com/ru/item/5017/'),
    ('SW-ITEM-074', '5020', 'https://bdocodex.com/ru/item/5020/'),
    ('SW-ITEM-075', '5023', 'https://bdocodex.com/ru/item/5023/'),
    ('SW-ITEM-076', '5024', 'https://bdocodex.com/ru/item/5024/')
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
