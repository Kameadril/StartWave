(() => {
  const sections = ['platform', 'games', 'services'];
  const sectionLabels = {
    platform: 'StartWave Games',
    games: 'Игровые модули',
    services: 'Служебные ссылки'
  };

  class GameFooter extends HTMLElement {
    connectedCallback() {
      if (this.dataset.rendered === 'true') return;

      const configuredLinks = this.collectLinks();
      const footer = document.createElement('footer');
      footer.className = 'sw-game-footer';
      footer.dataset.theme = this.dataset.theme?.trim() || 'default';

      const inner = document.createElement('div');
      inner.className = 'sw-game-footer__inner';

      const navigation = document.createElement('div');
      navigation.className = 'sw-game-footer__navigation';

      sections.forEach((sectionName) => {
        const section = this.createSection(sectionName, configuredLinks.get(sectionName) || []);
        navigation.append(section);
      });

      navigation.append(this.createInformationSection());
      inner.append(navigation, this.createBottomBar());
      footer.append(inner);

      this.replaceChildren(footer);
      this.dataset.rendered = 'true';
    }

    collectLinks() {
      const links = new Map(sections.map((section) => [section, []]));

      this.querySelectorAll('[data-footer-section]').forEach((source) => {
        const section = source.dataset.footerSection?.trim().toLowerCase();
        if (!links.has(section)) return;

        links.get(section).push({
          label: source.textContent.trim(),
          href: source.getAttribute('href') || '',
          status: source.dataset.status?.trim() || '',
          current: source.getAttribute('aria-current') || '',
          disabled: source.getAttribute('aria-disabled') === 'true'
        });
      });

      return links;
    }

    createSection(name, links) {
      const section = document.createElement('section');
      section.className = 'sw-game-footer__section';

      const title = document.createElement('h2');
      title.className = 'sw-game-footer__title';
      title.textContent = this.dataset[`${name}Label`]?.trim() || sectionLabels[name];

      const list = document.createElement('ul');
      list.className = 'sw-game-footer__links';

      links.forEach((configuration) => {
        const item = document.createElement('li');
        const link = document.createElement(configuration.disabled || !configuration.href ? 'span' : 'a');
        link.className = 'sw-game-footer__link';
        link.textContent = configuration.label;

        if (link instanceof HTMLAnchorElement) link.href = configuration.href;
        if (configuration.current) link.setAttribute('aria-current', configuration.current);
        if (configuration.disabled) link.setAttribute('aria-disabled', 'true');

        item.append(link);
        if (configuration.status) item.append(this.createStatus(configuration.status));
        list.append(item);
      });

      if (!links.length) {
        const emptyItem = document.createElement('li');
        emptyItem.className = 'sw-game-footer__empty';
        emptyItem.textContent = 'Раздел готов к наполнению';
        list.append(emptyItem);
      }

      section.append(title, list);
      return section;
    }

    createInformationSection() {
      const section = document.createElement('section');
      section.className = 'sw-game-footer__section';

      const title = document.createElement('h2');
      title.className = 'sw-game-footer__title';
      title.textContent = this.dataset.infoLabel?.trim() || 'Информация';

      const list = document.createElement('dl');
      list.className = 'sw-game-footer__meta';
      this.appendMeta(list, 'Компонент', this.dataset.componentVersion?.trim() || 'Footer v0.1');
      this.appendMeta(list, 'Статус', this.dataset.projectStatus?.trim() || 'Прототип');
      this.appendMeta(list, 'Модуль', this.dataset.moduleName?.trim() || 'StartWave Games');

      section.append(title, list);
      return section;
    }

    appendMeta(list, label, value) {
      const term = document.createElement('dt');
      term.textContent = label;
      const description = document.createElement('dd');
      description.textContent = value;
      list.append(term, description);
    }

    createBottomBar() {
      const bar = document.createElement('div');
      bar.className = 'sw-game-footer__bottom';

      const attribution = document.createElement('div');
      attribution.className = 'sw-game-footer__attribution';

      const builtWith = document.createElement('p');
      builtWith.className = 'sw-game-footer__built-with';
      builtWith.textContent = this.dataset.attribution?.trim() || 'Built with ❤️ by a human and AI';

      const brand = document.createElement('p');
      brand.className = 'sw-game-footer__brand';
      brand.textContent = this.dataset.brand?.trim() || 'StartWave Games';

      const copyright = document.createElement('p');
      copyright.className = 'sw-game-footer__copyright';
      copyright.textContent = this.dataset.copyright?.trim() || `© ${new Date().getFullYear()} StartWave`;

      attribution.append(builtWith, brand);
      bar.append(attribution, copyright);
      return bar;
    }

    createStatus(status) {
      const badge = document.createElement('span');
      badge.className = 'sw-game-footer__status';
      badge.dataset.status = status.toLowerCase();
      badge.textContent = status;
      return badge;
    }
  }

  if (!customElements.get('sw-game-footer')) customElements.define('sw-game-footer', GameFooter);
})();
