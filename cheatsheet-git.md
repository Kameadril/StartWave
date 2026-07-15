# Git шпаргалка StartWave 🌊

## Основные команды Git

---

## Проверить состояние проекта

Команда:

```powershell
git status
```

Показывает:

- какие файлы изменились;
- какие файлы новые;
- сохранён ли проект;
- синхронизирован ли Git с GitHub.

Если всё хорошо:

```text
On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean
```

Перевод:

- я нахожусь в основной ветке;
- GitHub и компьютер совпадают;
- новых изменений нет.

---

# Добавить изменения

Команда:

```powershell
git add .
```

Что делает:

Подготавливает все новые и изменённые файлы к сохранению.

Аналогия:

Положить новые страницы книги на стол библиотекаря.

---

# Создать сохранение версии

Команда:

```powershell
git commit -m "Описание изменений"
```

Пример:

```powershell
git commit -m "Add README file"
```

Что делает:

Создаёт запись в истории проекта.

Аналогия:

Поставить закладку в книге и написать:

"Добавлен новый раздел".

---

# Отправить изменения в GitHub

Команда:

```powershell
git push
```

Что делает:

Отправляет сохранённую версию проекта в облако GitHub.

---

# Получить изменения из GitHub

Команда:

```powershell
git pull
```

Что делает:

Загружает изменения из GitHub на компьютер.

---

# Проверить подключение к GitHub

Команда:

```powershell
git remote -v
```

Правильный результат:

```text
origin  https://github.com/Kameadril/StartWave.git (fetch)
origin  https://github.com/Kameadril/StartWave.git (push)
```

---

# Ошибка: not a git repository

Если Git пишет:

```text
fatal: not a git repository (or any of the parent directories): .git
```

Это значит:

Терминал открыт не внутри папки проекта.

---

## Пример

❌ Неправильно:

```text
C:\Projects
```

✅ Правильно:

```text
C:\Projects\StartWave
```

---

## Как исправить

Перейти в папку проекта:

```powershell
cd StartWave
```

Проверить:

```powershell
git status
```

Если всё правильно:

```text
On branch main
Your branch is up to date with 'origin/main'.
```

---

# Проверка текущей папки

Показать, где я нахожусь:

```powershell
pwd
```

Показать файлы и папки:

```powershell
dir
```

Если я не вижу папку:

```text
StartWave
```

значит я нахожусь не там.

---

# Рабочий цикл StartWave

Обычная работа:

1. Изменил файлы в VS Code

↓

2. Проверил:

```powershell
git status
```

↓

3. Добавил изменения:

```powershell
git add .
```

↓

4. Сохранил версию:

```powershell
git commit -m "Что изменил"
```

↓

5. Отправил в GitHub:

```powershell
git push
```

---

# Структура проекта StartWave

```text
StartWave

├── README.md
│   Описание проекта
│
├── PROJECT_VISION.md
│   Зачем существует проект
│
├── ROADMAP.md
│   План развития
│
├── cheatsheet-git.md
│   Команды Git и опыт работы
│
├── index.html
├── bdo.html
├── ai.html
├── services.html
├── entertainment.html
│
├── assets
│   ├── css
│   ├── js
│   └── images
│
└── pages
    └── BDO-разделы
```

---

# Аналогия

VS Code:
> мастерская, где строим проект

Git:
> книга учёта всех изменений

GitHub:
> библиотека в интернете, где хранится копия проекта

Commit:
> сохранить важную версию

Push:
> отправить копию в GitHub

Status:
> проверить состояние проекта

---

# Главное правило

Не спешить.

Сначала:

Идея → План → Изменение → Проверка → Сохранение → GitHub

Как строительство дома:

Проект → Фундамент → Строительство → Проверка → Сдача