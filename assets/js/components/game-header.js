class StartWaveGameHeader extends HTMLElement {
  connectedCallback() {
    if (this.dataset.ready === 'true') return;
    const game = window.StartWaveGames?.get(this.dataset.game);
    if (!game) return;

    document.body.classList.add('sw-games', `sw-games--${game.theme}`);
    this.classList.add('sw-game-header');
    this.dataset.ready = 'true';
  }
}

if (!customElements.get('sw-game-header')) {
  customElements.define('sw-game-header', StartWaveGameHeader);
}
