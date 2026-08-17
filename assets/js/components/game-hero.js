class StartWaveGameHero extends HTMLElement {
  connectedCallback() {
    if (this.dataset.ready === 'true') return;
    const game = window.StartWaveGames?.get(this.dataset.game);
    if (!game) return;

    this.classList.add('sw-game-hero');
    this.dataset.theme = game.theme;
    const gameLabel = this.querySelector('[data-game-label]');
    if (gameLabel && !gameLabel.textContent.trim()) gameLabel.textContent = game.name;
    this.dataset.ready = 'true';
  }
}

if (!customElements.get('sw-game-hero')) {
  customElements.define('sw-game-hero', StartWaveGameHero);
}
