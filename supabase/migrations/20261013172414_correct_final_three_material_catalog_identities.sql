update public.items
set
  name = case id
    when 'SW-ITEM-014' then 'Древесина'
    when 'SW-ITEM-015' then 'Обработанный камень'
    when 'SW-ITEM-027' then 'Необработанный пиломатериал'
  end,
  name_en = case id
    when 'SW-ITEM-014' then 'Standardized Timber Square'
    when 'SW-ITEM-015' then 'Polished Stone'
    when 'SW-ITEM-027' then 'Usable Scantling'
  end,
  item_type = case id
    when 'SW-ITEM-014' then 'Обработанная древесина'
    when 'SW-ITEM-015' then 'Обработанный камень'
    when 'SW-ITEM-027' then 'Пиломатериал'
  end,
  updated_at = statement_timestamp()
where (id, name) in (
  ('SW-ITEM-014', 'Доска'),
  ('SW-ITEM-015', 'Фанера'),
  ('SW-ITEM-027', 'Древесина сосны')
);

update public.recipes
set
  name = case id
    when 'SW-RECIPE-001' then 'Обработка брёвен в необработанный пиломатериал'
    when 'SW-RECIPE-002' then 'Обработка необработанного пиломатериала в древесину'
    when 'SW-RECIPE-003' then 'Шлифовка грубого камня'
  end,
  method = case id when 'SW-RECIPE-003' then 'Шлифовка' else 'Рубка' end,
  result_item_id = case id
    when 'SW-RECIPE-001' then 'SW-ITEM-027'
    when 'SW-RECIPE-002' then 'SW-ITEM-014'
    when 'SW-RECIPE-003' then 'SW-ITEM-015'
  end,
  updated_at = statement_timestamp()
where id in ('SW-RECIPE-001', 'SW-RECIPE-002', 'SW-RECIPE-003');

delete from public.recipe_inputs
where recipe_id in ('SW-RECIPE-001', 'SW-RECIPE-002', 'SW-RECIPE-003', 'SW-RECIPE-010')
  and item_id in ('SW-ITEM-014', 'SW-ITEM-015', 'SW-ITEM-016', 'SW-ITEM-027', 'SW-ITEM-005', 'SW-ITEM-013');

insert into public.recipe_inputs (recipe_id, item_id, quantity)
values
  ('SW-RECIPE-001', 'SW-ITEM-013', 10),
  ('SW-RECIPE-002', 'SW-ITEM-027', 10),
  ('SW-RECIPE-003', 'SW-ITEM-005', 10),
  ('SW-RECIPE-010', 'SW-ITEM-016', 10);

delete from public.item_resources
where item_id = 'SW-ITEM-027'
  and resource_id = 'bdo-resource-wood-pine';

with approved_mapping (item_id, external_item_id, source_url) as (
  values
    ('SW-ITEM-014', '4685', 'https://bdocodex.com/ru/item/4685/'),
    ('SW-ITEM-015', '4068', 'https://bdocodex.com/ru/item/4068/'),
    ('SW-ITEM-027', '4669', 'https://bdocodex.com/ru/item/4669/')
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
