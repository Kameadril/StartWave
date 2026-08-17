class StartWaveGameSearch extends HTMLElement {
  connectedCallback() {
    if (this.dataset.ready === 'true') {
      return;
    }

    this.game = window.StartWaveGames?.get(this.dataset.game);
    const modes = ['game', 'platform', 'external', 'ai']
      .map((name) => this.getModeConfiguration(name))
      .filter((mode) => mode.label);

    if (!modes.length) {
      return;
    }

    this.activeMode = modes.find((mode) => mode.name === this.dataset.defaultMode && !mode.disabled)
      || modes.find((mode) => !mode.disabled);

    const search = document.createElement('div');
    search.className = 'sw-game-search';
    search.setAttribute('role', 'search');
    search.setAttribute('aria-label', this.dataset.label?.trim() || 'Поиск');

    this.modeList = document.createElement('div');
    this.modeList.className = 'sw-game-search__modes';
    this.modeList.setAttribute('aria-label', 'Область поиска');

    modes.forEach((mode) => {
      const button = document.createElement('button');
      button.className = 'sw-game-search__mode';
      button.type = 'button';
      button.textContent = mode.label;
      button.disabled = mode.disabled;
      button.dataset.mode = mode.name;
      button.setAttribute('aria-pressed', String(mode === this.activeMode));
      if (mode.disabled) {
        button.title = 'Режим будет доступен позже';
      }
      button.addEventListener('click', () => this.selectMode(mode));
      this.modeList.append(button);
    });

    this.form = document.createElement('form');
    this.form.className = 'sw-game-search__form';
    this.form.method = 'get';
    this.form.target = '_blank';

    const label = document.createElement('label');
    label.className = 'visually-hidden';
    label.htmlFor = this.dataset.inputId?.trim() || `game-search-${StartWaveGameSearch.nextId++}`;
    label.textContent = this.dataset.label?.trim() || 'Поисковый запрос';

    this.input = document.createElement('input');
    this.input.className = 'sw-game-search__input';
    this.input.id = label.htmlFor;
    this.input.type = 'search';
    this.input.required = true;
    this.input.autocomplete = 'off';
    this.input.placeholder = this.dataset.placeholder?.trim() || 'Что найти?';

    this.submit = document.createElement('button');
    this.submit.className = 'sw-game-search__submit';
    this.submit.type = 'submit';
    this.submit.textContent = this.dataset.submitLabel?.trim() || 'Найти';

    this.hint = document.createElement('p');
    this.hint.className = 'sw-game-search__hint';
    this.hint.setAttribute('aria-live', 'polite');

    this.form.append(label, this.input, this.submit);
    search.append(this.modeList, this.form, this.hint);
    this.replaceChildren(search);
    this.form.addEventListener('submit', (event) => this.prepareQuery(event));
    this.selectMode(this.activeMode);
    this.dataset.ready = 'true';
  }

  getModeConfiguration(name) {
    return {
      name,
      label: this.dataset[`${name}Label`]?.trim(),
      action: this.dataset[`${name}Action`]?.trim(),
      queryPrefix: this.dataset[`${name}QueryPrefix`]?.trim()
        || (name === 'game' ? this.game?.searchPrefix : '')
        || '',
      disabled: this.dataset[`${name}Disabled`] === 'true' || !this.dataset[`${name}Action`]?.trim(),
    };
  }

  selectMode(mode) {
    if (!mode || mode.disabled) {
      return;
    }

    this.activeMode = mode;
    this.form.action = mode.action;
    this.input.name = this.dataset.queryName?.trim() || 'q';
    this.modeList.querySelectorAll('[data-mode]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.mode === mode.name));
    });
    this.hint.textContent = mode.queryPrefix
      ? `Запрос будет уточнён для режима «${mode.label}».`
      : `Режим: ${mode.label}.`;
  }

  prepareQuery(event) {
    const query = this.input.value.trim();
    if (!query) {
      event.preventDefault();
      this.input.focus();
      return;
    }

    this.input.value = `${this.activeMode.queryPrefix}${query}`;
    window.setTimeout(() => {
      this.input.value = query;
    });
  }
}

StartWaveGameSearch.nextId = 1;

if (!customElements.get('sw-game-search')) {
  customElements.define('sw-game-search', StartWaveGameSearch);
}
