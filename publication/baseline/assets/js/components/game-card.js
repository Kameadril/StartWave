(() => {
  const variants = new Set(['article', 'recipe', 'item', 'calculator']);
  const layouts = new Set(['compact', 'standard', 'featured', 'horizontal']);
  const statusLabels = {
    ready: 'Готово',
    'готово': 'Готово',
    skeleton: 'Каркас',
    'каркас': 'Каркас',
    development: 'В разработке',
    'in-development': 'В разработке',
    'в-разработке': 'В разработке',
    'в разработке': 'В разработке',
    planned: 'Планируется',
    'планируется': 'Планируется',
    new: 'Новое',
    'новое': 'Новое'
  };

  function safeUrl(value, fallback = '') {
    if (!value) return fallback;
    try {
      const url = new URL(value, document.baseURI);
      return ['http:', 'https:', 'file:'].includes(url.protocol) ? value : fallback;
    } catch {
      return fallback;
    }
  }

  function splitList(value, limit = 8) {
    return (value || '').split(/[|,]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, limit);
  }

  class GameCard extends HTMLElement {
    getOption(name, fallback = '') {
      return this.getAttribute(`data-${name}`) ?? this.getAttribute(name) ?? fallback;
    }

    connectedCallback() {
      if (this.dataset.rendered === 'true') return;

      const suppliedContent = document.createDocumentFragment();
      while (this.firstChild) suppliedContent.append(this.firstChild);

      const requestedVariant = this.getOption('variant', 'article').toLowerCase();
      const legacyLayout = layouts.has(requestedVariant) ? requestedVariant : '';
      const variant = variants.has(requestedVariant) ? requestedVariant : 'article';
      const requestedLayout = this.getOption('layout', legacyLayout || 'standard').toLowerCase();
      const layout = layouts.has(requestedLayout) ? requestedLayout : 'standard';
      const title = this.getOption('title');
      const description = this.getOption('description');
      const href = safeUrl(this.getOption('href'));
      const image = safeUrl(this.getOption('image'));
      const statusKey = this.getOption('status').trim().toLowerCase();
      const tags = splitList(this.getOption('tags', this.getOption('labels')), 6);

      this.dataset.rendered = 'true';
      this.dataset.variant = variant;
      this.dataset.layout = layout;
      this.dataset.status = statusLabels[statusKey] ? statusKey : '';
      this.dataset.theme = this.getOption('theme', 'default');

      const article = document.createElement('article');
      article.className = 'sw-card';

      if (image) {
        const media = document.createElement('div');
        media.className = 'sw-card__media';
        const img = document.createElement('img');
        img.src = image;
        img.alt = this.getOption('image-alt');
        img.loading = 'lazy';
        img.decoding = 'async';
        media.append(img);
        article.append(media);
      }

      const body = document.createElement('div');
      body.className = 'sw-card__body';
      const header = document.createElement('div');
      header.className = 'sw-card__header';
      const category = this.getOption('category', this.getOption('eyebrow'));
      if (category) {
        const overline = document.createElement('p');
        overline.className = 'sw-card__category';
        overline.textContent = category;
        header.append(overline);
      }
      if (statusLabels[statusKey]) {
        const status = document.createElement('span');
        status.className = 'sw-card__status';
        status.dataset.status = statusKey;
        status.textContent = statusLabels[statusKey];
        header.append(status);
      }
      if (header.childElementCount) body.append(header);

      const heading = document.createElement('h3');
      heading.className = 'sw-card__title';
      const icon = this.getOption('icon');
      if (icon) {
        const iconNode = document.createElement('span');
        iconNode.className = 'sw-card__icon';
        iconNode.setAttribute('aria-hidden', 'true');
        iconNode.textContent = icon;
        heading.append(iconNode, ' ');
      }
      heading.append(title);
      body.append(heading);

      const copy = document.createElement('div');
      copy.className = 'sw-card__description';
      if (description) {
        const paragraph = document.createElement('p');
        paragraph.textContent = description;
        copy.append(paragraph);
      }
      copy.append(suppliedContent);
      if (copy.textContent.trim() || copy.childElementCount) body.append(copy);

      this.appendVariantDetails(body, variant);

      if (tags.length) {
        const list = document.createElement('ul');
        list.className = 'sw-card__tags';
        list.setAttribute('aria-label', 'Теги');
        tags.forEach((tag) => {
          const item = document.createElement('li');
          item.textContent = tag;
          list.append(item);
        });
        body.append(list);
      }

      const actionLabel = this.getOption('action', this.getOption('action-label'));
      if (actionLabel) {
        const action = document.createElement(href ? 'a' : 'button');
        action.className = 'sw-card__action';
        action.textContent = actionLabel;
        if (href) action.href = href;
        else action.type = 'button';
        action.setAttribute('aria-label', `${actionLabel}: ${title}`);
        body.append(action);
      }

      article.append(body);
      this.append(article);
    }

    appendVariantDetails(body, variant) {
      const details = [];
      if (variant === 'recipe') {
        const resources = splitList(this.getOption('resources'));
        const quantities = splitList(this.getOption('quantities'));
        resources.forEach((resource, index) => details.push([resource, quantities[index] || '—']));
      } else if (variant === 'item') {
        const source = this.getOption('source');
        const relations = splitList(this.getOption('relations'));
        if (source) details.push(['Источник', source]);
        if (relations.length) details.push(['Связи', relations.join(' · ')]);
      } else if (variant === 'calculator') {
        splitList(this.getOption('inputs')).forEach((input) => details.push(['Входные данные', input]));
      }

      if (!details.length) return;
      const list = document.createElement('dl');
      list.className = 'sw-card__details';
      details.forEach(([label, value]) => {
        const term = document.createElement('dt');
        term.textContent = label;
        const description = document.createElement('dd');
        description.textContent = value;
        list.append(term, description);
      });
      body.append(list);
    }
  }

  if (!customElements.get('sw-game-card')) customElements.define('sw-game-card', GameCard);
})();
