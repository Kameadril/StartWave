class StartWaveGameNavigation extends HTMLElement {
  connectedCallback() {
    if (this.dataset.ready === 'true') {
      return;
    }

    const game = window.StartWaveGames?.get(this.dataset.game);
    const gameName = this.dataset.gameName?.trim() || game?.name;
    const gameUrl = this.dataset.gameUrl?.trim() || game?.home;
    const navigationLabel = this.dataset.navigationLabel?.trim() || gameName;
    const links = Array.from(this.querySelectorAll(':scope > a'));
    if (!links.length && game) {
      game.links.forEach(({ label, href }) => {
        const link = document.createElement('a');
        link.href = href;
        link.textContent = label;
        this.append(link);
        links.push(link);
      });
    }

    if (!gameName || !gameUrl || !links.length) {
      return;
    }

    const navigationId = this.id || `game-navigation-${StartWaveGameNavigation.nextId++}`;
    const currentUrl = new URL(window.location.href);

    links.forEach((link) => {
      const linkUrl = new URL(link.href, currentUrl);
      const isCurrent = linkUrl.pathname === currentUrl.pathname
        && (!linkUrl.hash || linkUrl.hash === currentUrl.hash);

      if (isCurrent) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });

    const bar = document.createElement('div');
    bar.className = 'sw-game-bar';

    const title = document.createElement('a');
    title.className = 'sw-game-title';
    title.href = gameUrl;
    title.textContent = gameName;

    const navigation = document.createElement('nav');
    navigation.className = 'sw-game-navigation';
    navigation.id = navigationId;
    navigation.setAttribute('aria-label', navigationLabel);
    navigation.append(...links);

    const actions = document.createElement('div');
    actions.className = 'sw-game-bar__actions';

    const toggle = document.createElement('button');
    toggle.className = 'sw-game-nav-toggle';
    toggle.type = 'button';
    toggle.textContent = 'Игра';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', navigationId);
    toggle.setAttribute('aria-label', 'Открыть меню игры');
    toggle.dataset.openLabel = 'Открыть меню игры';
    toggle.dataset.closeLabel = 'Закрыть меню игры';
    toggle.dataset.gameNavToggle = '';

    actions.append(toggle);
    bar.append(title, navigation, actions);
    this.replaceChildren(bar);
    this.dataset.ready = 'true';
  }
}

StartWaveGameNavigation.nextId = 1;

if (!customElements.get('sw-game-navigation')) {
  customElements.define('sw-game-navigation', StartWaveGameNavigation);
}
