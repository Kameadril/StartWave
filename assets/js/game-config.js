(() => {
  const games = {
    bdo: {
      name: 'Black Desert Online',
      shortName: 'Black Desert',
      logo: 'BDO',
      theme: 'bdo',
      home: '../bdo.html',
      searchPrefix: 'Black Desert Online рабочие ',
      links: [
        { label: 'Главная', href: '../bdo.html' },
        { label: 'База знаний', href: 'bdo-workers.html' },
        { label: 'Мирная жизнь', href: 'bdo-crafting.html' },
        { label: 'Боевая жизнь', href: '../bdo.html#combat' },
        { label: 'Карта', href: '../bdo.html#map' },
        { label: 'Калькуляторы', href: '../bdo.html#calculators' }
      ],
      sections: ['knowledge', 'life', 'combat', 'map', 'calculators'],
      modules: {
        workers: 'ready',
        crafting: 'development',
        map: 'planned',
        calculators: 'planned'
      }
    },
    wow: {
      name: 'World of Warcraft',
      shortName: 'WoW',
      logo: 'WoW',
      theme: 'wow',
      home: '#',
      searchPrefix: 'World of Warcraft ',
      links: [],
      sections: ['classes', 'raids', 'professions'],
      modules: { classes: 'planned', raids: 'planned', professions: 'planned' }
    },
    diablo: {
      name: 'Diablo',
      shortName: 'Diablo',
      logo: 'Diablo',
      theme: 'diablo',
      home: '#',
      searchPrefix: 'Diablo ',
      links: [],
      sections: ['classes', 'builds', 'items'],
      modules: { classes: 'planned', builds: 'planned', items: 'planned' }
    }
  };

  window.StartWaveGames = Object.freeze({
    get(gameId) {
      return games[gameId] || null;
    },
    list() {
      return Object.entries(games).map(([id, game]) => ({ id, ...game }));
    }
  });
})();
