(() => {
  const grid = document.getElementById('bdoWorkerGrid');
  const search = document.getElementById('workerArchiveSearch');
  const count = document.getElementById('workerArchiveResultCount');
  const empty = document.getElementById('workerArchiveEmptyState');

  if (!grid || !search || !count || !empty) return;

  const normalize = (value) => String(value ?? '').toLocaleLowerCase('ru-RU').trim();
  const statusLabels = { unresearched: 'Не исследовано', researching: 'Исследуется', verified: 'Подтверждено' };
  const listCount = (value) => Array.isArray(value) ? value.length : 0;

  const createCard = (worker) => {
    const article = document.createElement('article');
    article.className = 'bdo-resource-record bdo-worker-record';
    article.id = worker.id;
    article.dataset.workerId = worker.id;
    article.innerHTML = `
      <header class="bdo-resource-record__header">
        <span class="bdo-resource-record__glyph" aria-hidden="true">👷</span>
        <div><p class="bdo-resource-record__eyebrow">Worker record</p><h3>${worker.name}</h3></div>
        <span class="bdo-resource-record__status">${statusLabels[worker.status] || worker.status}</span>
      </header>
      <dl class="bdo-resource-record__facts">
        <div><dt>ID</dt><dd><code>${worker.id}</code></dd></div>
        <div><dt>Тип</dt><dd>${worker.workerType}</dd></div>
        <div><dt>Город найма</dt><dd>${worker.hireCity || 'Не подтверждён'}</dd></div>
        <div><dt>Регион</dt><dd>${worker.region}</dd></div>
        <div><dt>Источник</dt><dd>${listCount(worker.source)} источников</dd></div>
        <div><dt>Дата проверки</dt><dd><time datetime="${worker.checkedAt}">${worker.checkedAt}</time></dd></div>
      </dl>
      <div class="bdo-resource-record__relations" aria-label="Связи рабочего">
        <span class="bdo-resource-record__relations-title">Подтверждённые связи</span>
        <span>Узлы: <strong>${listCount(worker.nodes)}</strong></span>
        <span>Задачи: <strong>${listCount(worker.tasks)}</strong></span>
        <span>Ресурсы: <strong>${listCount(worker.resources)}</strong></span>
        <span>Производство: <strong>${listCount(worker.production)}</strong></span>
        <span>Изображения: <strong>${listCount(worker.images)}</strong></span>
      </div>`;
    window.BdoWorldRelations?.attach(article, 'worker', worker);
    return article;
  };

  const render = (workers) => {
    grid.replaceChildren(...workers.map(createCard));
    count.textContent = `${workers.length} записей`;
    empty.hidden = workers.length !== 0;
  };

  fetch('../assets/data/bdo-workers.json')
    .then((response) => {
      if (!response.ok) throw new Error(`Worker data request failed: ${response.status}`);
      return response.json();
    })
    .then((data) => {
      const workers = Array.isArray(data.workers) ? data.workers : [];
      render(workers);
      search.addEventListener('input', () => {
        const query = normalize(search.value);
        render(workers.filter((worker) => normalize(`${worker.name} ${worker.workerType} ${worker.hireCity} ${worker.region} ${worker.id} ${worker.status}`).includes(query)));
      });
    })
    .catch(() => {
      count.textContent = 'Данные недоступны';
      empty.hidden = false;
      empty.textContent = 'Не удалось загрузить архив рабочих.';
    });
})();
