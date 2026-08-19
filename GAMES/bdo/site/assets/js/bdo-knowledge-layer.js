(() => {
  const root = document.getElementById('knowledgeLayer');
  const grid = document.getElementById('knowledgeCategoryGrid');
  if (!root || !grid) return;
  const statusClass = { verified: 'is-verified', researching: 'is-researching', 'awaiting-data': 'is-awaiting' };
  fetch('../assets/data/bdo-knowledge-layer.json').then((response) => {
    if (!response.ok) throw new Error(`Knowledge layer request failed: ${response.status}`);
    return response.json();
  }).then((data) => {
    const definitions = data.statusDefinitions || {};
    const categories = data.categories || [];
    const entries = categories.flatMap((category) => category.entries || []);
    grid.replaceChildren(...categories.map((category) => {
      const article = document.createElement('article');
      article.className = `bdo-knowledge-category ${statusClass[category.status] || 'is-awaiting'}`;
      const categoryEntries = category.entries || [];
      const content = categoryEntries.length
        ? `<ul>${categoryEntries.map((entry) => `<li><a href="${entry.route}">${entry.title}</a><span>${entry.scope}</span></li>`).join('')}</ul>`
        : '<p class="bdo-knowledge-category__empty">Проверенные записи пока не добавлены.</p>';
      article.innerHTML = `<header><span aria-hidden="true">${category.icon}</span><div><p>Категория знаний</p><h2>${category.label}</h2></div></header><div class="bdo-knowledge-category__status"><i aria-hidden="true"></i>${definitions[category.status] || 'Ожидает данных'}</div>${content}`;
      return article;
    }));
    document.getElementById('knowledgeVerifiedCount').textContent = String(entries.filter((entry) => entry.status === 'verified').length);
    document.getElementById('knowledgeResearchingCount').textContent = String(categories.filter((category) => category.status === 'researching').length);
    document.getElementById('knowledgeAwaitingCount').textContent = String(categories.filter((category) => category.status === 'awaiting-data').length);
    document.getElementById('knowledgeContextNote').textContent = data.contextLinks?.[0]?.note || 'Контекстные связи пока не добавлены.';
    root.setAttribute('aria-busy', 'false');
  }).catch(() => {
    grid.innerHTML = '<p class="bdo-resource-empty">Knowledge Layer временно недоступен.</p>';
    root.setAttribute('aria-busy', 'false');
  });
})();
