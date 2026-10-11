with approved_mapping (item_id, external_item_id, source_url) as (
  values
    ('SW-ITEM-029', '4604', 'https://bdocodex.com/ru/item/4604/'),
    ('SW-ITEM-031', '4608', 'https://bdocodex.com/ru/item/4608/'),
    ('SW-ITEM-033', '4609', 'https://bdocodex.com/ru/item/4609/'),
    ('SW-ITEM-035', '4606', 'https://bdocodex.com/ru/item/4606/'),
    ('SW-ITEM-037', '4610', 'https://bdocodex.com/ru/item/4610/'),
    ('SW-ITEM-039', '4611', 'https://bdocodex.com/ru/item/4611/'),
    ('SW-ITEM-041', '4677', 'https://bdocodex.com/ru/item/4677/'),
    ('SW-ITEM-042', '4681', 'https://bdocodex.com/ru/item/4681/'),
    ('SW-ITEM-058', '4614', 'https://bdocodex.com/ru/item/4614/'),
    ('SW-ITEM-059', '4619', 'https://bdocodex.com/ru/item/4619/'),
    ('SW-ITEM-060', '4621', 'https://bdocodex.com/ru/item/4621/'),
    ('SW-ITEM-137', '4607', 'https://bdocodex.com/ru/item/4607/'),
    ('SW-ITEM-140', '4616', 'https://bdocodex.com/ru/item/4616/')
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
