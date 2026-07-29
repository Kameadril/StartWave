# Commit Guide

## Типы коммитов

```text
feat(...)      Новый функционал
fix(...)       Исправление ошибок
style(...)     Только дизайн
refactor(...)  Переписывание кода
docs(...)      Документация
perf(...)      Оптимизация
test(...)      Тестирование
chore(...)     Служебные изменения
```

## Примеры

```text
feat(bdo): complete coupons module and homepage polish
feat(bdo): add workers knowledge page
style(bdo): redesign workers page to BDO theme
fix(bdo): correct barter calculations
docs: update roadmap
refactor(ai): simplify search logic
```

## Рекомендации

- Один коммит — одна понятная задача.
- Сообщение должно объяснять результат, а не процесс.
- Scope в скобках использовать для раздела или модуля: `bdo`, `ai`, `docs`, `ui`.
- Не объединять документацию, дизайн и функционал в один коммит без необходимости.
