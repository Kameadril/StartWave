(() => {
  const grid = document.getElementById('bdoResourceGrid');
  const search = document.getElementById('archiveSearch');
  const count = document.getElementById('archiveResultCount');
  const empty = document.getElementById('archiveEmptyState');
  let totalCount = 0;

  if (!grid || !search || !count || !empty) return;

  const normalize = (value) => value.toLocaleLowerCase('ru-RU').trim();

  const createCard = (resource) => {
    const article = document.createElement('article');
    article.className = 'bdo-resource-record';
    article.id = resource.id;
    article.dataset.resourceId = resource.id;
    const isLivingPreview = resource.id === 'bdo-resource-wood-pine';
    if (isLivingPreview) article.classList.add('bdo-resource-record--living');

    const relationFields = Object.entries(resource.relations)
      .map(([key, values]) => `<span>${key}: <strong>${values.length}</strong></span>`)
      .join('');

    const pineArchive = resource.archive ? `
      <div class="bdo-resource-record__archive">
        <p class="bdo-resource-record__eyebrow">Calpheon Resource Archive</p>
        <h4>${resource.archive.title}</h4>
        <p>${resource.archive.description}</p>
        <div class="bdo-resource-record__archive-links">
          <a href="bdo-items.html">Предметы: ${resource.relations.items.length}</a>
          <a href="bdo-recipes.html">Рецепты: ${resource.relations.recipes.length}</a>
          <a href="bdo-production.html">Производство: ${resource.relations.productions.length}</a>
        </div>
      </div>` : '';

    article.innerHTML = `
      <header class="bdo-resource-record__header">
        <span class="bdo-resource-record__glyph" aria-hidden="true">${resource.name === 'Бревно' ? '🪵' : '🌲'}</span>
        <div>
          <p class="bdo-resource-record__eyebrow">${isLivingPreview ? 'Living Object · v0.4' : 'Resource record'}</p>
          <h3>${resource.name}</h3>
        </div>
        <span class="bdo-resource-record__status"><i aria-hidden="true"></i> Проверено</span>
      </header>
      <dl class="bdo-resource-record__facts">
        <div><dt>ID</dt><dd><code>${resource.id}</code></dd></div>
        <div><dt>Категория</dt><dd>${resource.category}</dd></div>
        <div><dt>Тип</dt><dd>${resource.resourceType}</dd></div>
        <div><dt>Источник</dt><dd>${resource.verification.source}</dd></div>
        <div><dt>Дата проверки</dt><dd><time datetime="${resource.verification.checkedAt}">${resource.verification.checkedAt}</time></dd></div>
      </dl>
      <div class="bdo-resource-record__relations" aria-label="Технические поля будущих связей">
        <span class="bdo-resource-record__relations-title">${resource.archive ? 'Связи Calpheon Archive' : 'Будущие связи'}</span>
        ${relationFields}
      </div>
      ${pineArchive}`;

    window.BdoWorldRelations?.attach(article, 'resource', resource);

    return article;
  };

  const render = (resources) => {
    grid.replaceChildren(...resources.map(createCard));
    count.textContent = `${resources.length} из ${totalCount} записей`;
    empty.hidden = resources.length !== 0;
  };

  fetch('../assets/data/bdo-resources.json')
    .then((response) => {
      if (!response.ok) throw new Error(`Resource data request failed: ${response.status}`);
      return response.json();
    })
    .then((data) => {
      const resources = data.resources || [];
      totalCount = resources.length;
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
