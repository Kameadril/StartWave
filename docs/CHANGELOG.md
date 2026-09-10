# StartWave Internal Changelog

## Назначение

Документ предназначен для внутренней фиксации важных изменений в структуре, документации и редакционных стандартах StartWave.

Документ будет постепенно заполняться по мере развития проекта.

## Основные разделы

### Документация

- Изменения внутренних стандартов.
- Новые документы.
- Обновления редакционных правил.

### Архитектура

- Изменения структуры проекта.
- Новые общие компоненты.
- Решения, влияющие на поддержку сайта.

### Контент

- Новые страницы базы знаний.
- Крупные переработки статей.
- Проверенные игровые механики.

### Проверки

- Что было проверено перед публикацией.
- Какие ограничения или замечания остались.

## Статус

Каркас создан. Записи будут добавляться после следующих значимых изменений.

## 2026-09-02 — восстановление Publication Factory

- Обнаружен отсутствующий `infra/build-public.mjs`; источником восстановления стала старая копия проекта от 21.08.2026.
- Старый builder был опасен для нынешней архитектуры: удалял `dist`, зеркалировал canonical Atlas в публикацию и не соответствовал текущей структуре source.
- Перед восстановлением создан полный timestamped backup с SHA-256 manifest.
- Builder восстановлен и адаптирован: поддерживает отдельный staging output и атомарную замену результата, не зеркалирует Atlas и сохраняет UNKNOWN/dist-only файлы.
- `npm run build` дважды дал воспроизводимый результат с одинаковыми SHA-256 manifest; deploy не выполнялся.
- Шесть исторических broken BDO links остаются отдельным техническим долгом: `pages/bdo-world-connection.html`, `pages/bdo-barter.html`, `bdo-card-classes.webp`, `bdo-card-guilds.webp`, `bdo-knowledge-layer.js` и ссылка `bdo-workers.html → bdo-barter.html`.
- Локальный Git повреждён: `.git/HEAD` отсутствует. Ремонт Git зафиксирован как отдельная задача; commit/push и изменение Git metadata в рамках этого пакета не выполнялись.
- Две утверждённые пользовательские мем-иллюстрации ожидают добавления: их файлы недоступны в текущем рабочем окружении, а существующий Markdown-формат Летописи не содержит механизма attachments.

## 2026-09-02 — перенос Publication Factory в Google Drive

- Для совместной работы Mac/Windows физически определён минимальный полный dependency set `npm run build`: `infra/build-public.mjs`, `package.json`, семь source HTML-файлов, каталоги `assets`, `GAMES/bdo/site/pages`, `GAMES/bdo/site/assets` и publication-only baseline `dist` — всего 226 файлов.
- Shared workspace для Windows: `G:\Мой диск\StartWave`; PRIVATE runtime и секреты не переносились, смешения с `C:\StartWave-AI-Private` не было.
- Перед изменениями создан точечный backup `/Users/kameadrilicloud.com/StartWave-backups/StartWave-publication-factory-google-drive-pre-sync-20260902-145730`: сохранены только четыре заменённых target-файла и прежний `docs/CHANGELOG.md`; 14 новых файлов перечислены отдельно. SHA-256 `MANIFEST.sha256`: `dba34b1ee48016098fd3ac676d13a59fe7a6d4d333957a8c159fc86a3e24a91c`; реестр перечитан и проверен полностью.
- После синхронизации все 226 dependency-файлов shared workspace совпали с Mac current source; SHA-256 их manifest: `4dca89fd845f96e77363ab7d4e8b7cd8b3c3904430a522279f391b181913aa18`.
- Shared builder SHA-256: `9f6c1c6942e943d890c3ff52c1e9fefe5d167c693d2367641fb69bf2f9c52721`; shared `package.json` SHA-256: `7ce8e67f8e8ff1aa4e78536595bb669c8872a1ec330b719a5a24dc3a8ac3ce08`.
- `npm run build -- --output .publication-factory-staging-20260902-145730` дважды успешно выполнен непосредственно из Google Drive workspace. Оба запуска дали 237 файлов и одинаковый staging manifest SHA-256 `a0a65d233a97ee4e1c63b9a1e74aeda18ca22ac4df57a5321e152f8c619e6670`.
- Production `dist` сборкой не изменён: 225 файлов, manifest SHA-256 до/после `0c1ca84d806d9e7d652da4996c2b39331c729c58864d253246be2a1ef302c616`. Deploy не выполнялся.
- Canonical Atlas не читался как источник публикации и не изменялся: 10 canonical JSON, manifest SHA-256 до/после `09a405904b7d1f2e7663a3a1d3ed180a5035241635396f2971fc389a10c17b13`; полный каталог с существующими Google Drive duplicate-файлами также неизменен — 20 файлов, SHA-256 `771d9f3bee964027349b61b7ab27591b9997857420c8f1f0f848a75ca261c851`.
- Исторические broken BDO links и Google Drive duplicate-файлы не исправлялись; Git не ремонтировался и не изменялся.
- Статус: Publication Factory перенесена и подготовлена для Windows live-test, но принятой до физической проверки на KAMEADRIL не объявляется.
