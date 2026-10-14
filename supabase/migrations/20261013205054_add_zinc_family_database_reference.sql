do $$
begin
  if exists (
    select 1 from public.items
    where id in ('SW-ITEM-147', 'SW-ITEM-148')
       or lower(name) in ('кусок цинка', 'слиток цинка')
  ) then
    raise exception 'Zinc canonical item precondition failed';
  end if;

  if exists (
    select 1 from public.item_external_identities
    where provider = 'bdo' and external_item_id in ('4063', '4064')
  ) then
    raise exception 'Zinc external identity precondition failed';
  end if;

  if exists (
    select 1 from public.recipes
    where id in ('SW-RECIPE-019', 'SW-RECIPE-020')
  ) then
    raise exception 'Zinc recipe precondition failed';
  end if;
end
$$;

insert into public.items (id, name, name_en, category, item_type, status)
values
  ('SW-ITEM-147', 'Кусок цинка', 'Melted Zinc Shard', 'Материалы', 'Кусок', 'curated'),
  ('SW-ITEM-148', 'Слиток цинка', 'Zinc Ingot', 'Материалы', 'Слиток', 'curated');

insert into public.item_external_identities (
  item_id, provider, external_item_id, source_name, source_url, checked_at
)
values
  ('SW-ITEM-147', 'bdo', '4063', 'BDO Codex', 'https://bdocodex.com/ru/item/4063/', statement_timestamp()),
  ('SW-ITEM-148', 'bdo', '4064', 'BDO Codex', 'https://bdocodex.com/ru/item/4064/', statement_timestamp());

insert into public.recipes (
  id, name, method, workplace, result_item_id, result_quantity, status
)
values
  ('SW-RECIPE-019', 'Нагревание цинковой руды в кусок цинка', 'Нагревание', 'Меню обработки', 'SW-ITEM-147', null, 'curated'),
  ('SW-RECIPE-020', 'Нагревание куска цинка в слиток цинка', 'Нагревание', 'Меню обработки', 'SW-ITEM-148', null, 'curated');

insert into public.recipe_inputs (recipe_id, item_id, quantity)
values
  ('SW-RECIPE-019', 'SW-ITEM-047', 5),
  ('SW-RECIPE-020', 'SW-ITEM-147', 10);

insert into public.recipe_sources (
  recipe_id, source_type, source_name, source_url, checked_at, claim_payload
)
values
  (
    'SW-RECIPE-019',
    'external_reference',
    'BDO Codex',
    'https://bdocodex.com/ru/mrecipe/9/',
    statement_timestamp(),
    '{"input_item_id":"SW-ITEM-047","input_quantity":5,"output_item_id":"SW-ITEM-147","output_quantity_min":1,"output_quantity_max":4,"method":"Нагревание","yield_note":"Результат зависит от уровня мастерства"}'::jsonb
  ),
  (
    'SW-RECIPE-020',
    'external_reference',
    'BDO Codex',
    'https://bdocodex.com/ru/mrecipe/10/',
    statement_timestamp(),
    '{"input_item_id":"SW-ITEM-147","input_quantity":10,"output_item_id":"SW-ITEM-148","output_quantity_min":1,"output_quantity_max":4,"method":"Нагревание","yield_note":"Результат зависит от уровня мастерства"}'::jsonb
  );
