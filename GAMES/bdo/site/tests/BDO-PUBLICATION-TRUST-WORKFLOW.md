# BDO publication trust workflow (v3.2)

Этот workflow не запускает браузер и не превращает digest build-роли в доверенный.

## Честная граница Node.js/macOS

Стандартный Node.js на macOS даёт `O_NOFOLLOW` только для конечного компонента pathname и не предоставляет JavaScript API для `openat`, `mkdirat`, `renameat` или descriptor-relative обхода дерева. Поэтому последовательность «проверить каталог, затем записать по pathname» не является строгой защитой от замены промежуточного компонента.

В v3.2 обе опасные pathname-записи удалены из разрешённого workflow:

- `prepare:bdo-ui:publication` завершается fail-closed с `BLOCKED_UNSAFE_NODE_PATH_WRITE` и ничего не создаёт;
- `record:bdo-ui:anchor` завершается fail-closed с тем же классом ошибки и ничего не создаёт.

Это намеренный безопасный результат, а не завершённый materialization workflow. Для создания publication и anchor нужен отдельный, независимо проверенный owner-controlled helper, который на поддерживаемой платформе удерживает directory descriptors и использует descriptor-relative primitives для каждого компонента. До появления и независимого review такого helper следующий шаг preparation/anchor — **BLOCKED**. Self-derived anchor запрещён.

## Чтение доверенного anchor

Runner и verifier не открывают pathname anchor. Поддерживаемый owner-controlled launcher открывает уже защищённый anchor с `O_RDONLY|O_NOFOLLOW`, фиксирует его identity (`dev`, `ino`, regular-file type) и напрямую запускает Node runner, передавая тот же объект как inherited FD 3. Дочерний процесс до любой попытки запуска server/browser повторно проверяет type и identity, после чего неизменённый verifier доказывает read-only access mode и выполняет bounded read. Harness проверяет размер до `Buffer.alloc`, читает кусками не более 64 KiB, проверяет EOF и повторный `fstat`. Лимит anchor/manifest — 256 KiB.

Пример только формы запуска после независимого создания и открытия anchor (не разрешение запускать браузер):

```sh
node GAMES/bdo/site/tests/bdo-verify-trust-anchor.mjs \
  --publication /absolute/publication \
  --manifest /absolute/publication/manifest.json \
  --anchor-fd 3 \
  3< /owner-opened/protected-anchor.json

node GAMES/bdo/site/tests/bdo-browser-launcher.mjs \
  --trust-anchor /owner-controlled/protected-anchor.json \
  --publication /absolute/publication \
  --manifest /absolute/publication/manifest.json
```

Запуск runner напрямую, через `npm run ... -- --trust-anchor-fd 3` или с shell redirection не является поддерживаемым owner entry point: промежуточный `npm` не гарантирует нужное наследование FD 3. Path traversal launcher не является descriptor-relative и безопасен только в независимом owner context с защищёнными от build-роли ancestor-каталогами; `O_NOFOLLOW` защищает конечный компонент, но не доказывает организационную независимость оператора.

После получения descriptor verifier повторяет контроль manifest (до 256 KiB), точного набора 10 файлов, каждого SHA-256, лимитов 1 MiB/file и 4 MiB total, а также ровно 13 publication records. Проверенные publication bytes затем используются как immutable in-memory snapshot. Runner сохраняет общий timeout, bounded stderr и SIGTERM→SIGKILL cleanup.

## Минимальный безопасный следующий шаг

Новый независимый STRICT READ-ONLY review должен подтвердить, что v3.2 действительно не выполняет pathname-записей publication/anchor, anchor читается только через inherited descriptor, bounded-read закрывает рост файла, а production/adapter байты не изменились. Отдельная реализация owner-controlled materializer, browser/DOM, canonical transfer и deployment требуют новых разрешений.

## Изолированный native candidate v3.2-materializer

В этой review-копии добавлен macOS helper `tools/bdo-owner-materializer` с двумя операциями. Это candidate для независимого аудита, а не разрешённый production workflow.

- `materialize` принимает только inherited `O_RDONLY` directory FD источника и publication parent, фиксированный leaf и exact-набор 10 файлов. Все чтения, создания каталогов/файлов, cleanup и exclusive publish выполняются descriptor-relative. Существующий target не заменяется.
- `seal-anchor` в отдельном owner-вызове снова читает publication descriptor-relative, требует независимо переданный lowercase digest manifest и создаёт anchor через `RENAME_EXCL` без замены.
- Helper требует, чтобы root FD принадлежали effective owner, не были group/world-writable и не имели extended ACL; найденная ACL entry и любая ошибка/неожиданный результат ACL API блокируют операцию. Та же fail-closed ACL-проверка применяется к publication candidate, его читаемым компонентам и создаваемым publication/anchor файлам. Неизвестные inherited FD блокируют операцию. Это проверяемая локальная policy, но не доказательство организационной независимости reviewer.
- Publication/anchor становятся `0444`, каталоги candidate — `0555`; это defense-in-depth. Same-size overwrite исключается только реальным разделением owner/build/runner и отсутствием доступных writable handle/backing authority. Один FD, hash или повторный `fstat` этого не доказывает.
- Verifier дополнительно отвергает writable inherited anchor FD. Поскольку Node не предоставляет `fcntl(F_GETFL)`, macOS-контракт проверяется non-mutating zero-length `write`: `EBADF` требуется для `O_RDONLY`, принятие записи означает fail-closed.

Owner обязан заранее открыть каждый root из защищённого каталога через `openat(..., O_RDONLY|O_DIRECTORY|O_NOFOLLOW)`, закрыть прочие FD и напрямую запустить helper. После sealing owner отдельно открывает final anchor `O_RDONLY|O_NOFOLLOW` и передаёт только этот FD verifier/runner. Identity pathname в anchor — метаданные совместимости; helper никогда не использует их как write authority.

Не выполнены и не разрешены: реальная публикация, отдельные UID/ACL role tests, многократные race/fault probes, browser/DOM/CDP, canonical transfer, Git, LIVE, Cloudflare и deployment. До независимого STRICT READ-ONLY аудита candidate остаётся NO-GO для любого из этих действий.
