(() => {
  const grid = document.getElementById('bdoResourceGrid');
  const search = document.getElementById('archiveSearch');
  const count = document.getElementById('archiveResultCount');
  const empty = document.getElementById('archiveEmptyState');

  if (!grid || !search || !count || !empty) return;

  const normalize = (value) => value.toLocaleLowerCase('ru-RU').trim();

  const createCard = (resource) => {
    const article = document.createElement('article');
    article.className = 'bdo-resource-record';
    article.id = resource.id;
    article.dataset.resourceId = resource.id;

    const relationFields = Object.keys(resource.relations)
      .map((key) => `<span>${key}: <strong>0</strong></span>`)
      .join('');

    article.innerHTML = `
      <header class="bdo-resource-record__header">
        <span class="bdo-resource-record__glyph" aria-hidden="true">${resource.name === 'Бревно' ? '🪵' : '🌲'}</span>
        <div>
          <p class="bdo-resource-record__eyebrow">Resource record</p>
          <h3>${resource.name}</h3>
        </div>
        <span class="bdo-resource-record__status">Проверено</span>
      </header>
      <dl class="bdo-resource-record__facts">
        <div><dt>ID</dt><dd><code>${resource.id}</code></dd></div>
        <div><dt>Категория</dt><dd>${resource.category}</dd></div>
        <div><dt>Тип</dt><dd>${resource.resourceType}</dd></div>
        <div><dt>Источник</dt><dd>${resource.verification.source}</dd></div>
        <div><dt>Дата проверки</dt><dd><time datetime="${resource.verification.checkedAt}">${resource.verification.checkedAt}</time></dd></div>
      </dl>
      <div class="bdo-resource-record__relations" aria-label="Поля будущих связей">
        <span class="bdo-resource-record__relations-title">Будущие связи</span>
        ${relationFields}
      </div>`;

    window.BdoWorldRelations?.attach(article, 'resource', resource);

    return article;
  };

  const render = (resources) => {
    grid.replaceChildren(...resources.map(createCard));
    count.textContent = `${resources.length} из 14 записей`;
    empty.hidden = resources.length !== 0;
  };

  fetch('../assets/data/bdo-resources.json')
    .then((response) => {
      if (!response.ok) throw new Error(`Resource data request failed: ${response.status}`);
      return response.json();
    })
    .then((data) => {
      const resources = data.resources || [];
      render(resources);
      search.addEventListener('input', () => {
        const query = normalize(search.value);
        const filtered = resources.filter((resource) =>
          normalize(`${resource.name} ${resource.category} ${resource.resourceType} ${resource.id}`).includes(query));
        render(filtered);
      });
    })
    .catch(() => {
      count.textContent = 'Данные временно недоступны';
      empty.hidden = false;
      empty.textContent = 'Не удалось открыть World Data Layer.';
    });
})();
