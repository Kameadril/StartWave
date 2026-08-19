window.startWaveBdoCoupons = {
  defaultPlatform: 'pc',
  limit: 5,
  lastUpdatedAt: '2026-07-29T18:30:00+03:00',
  checkedPlatforms: ['pc', 'playstation', 'xbox'],
  platforms: {
    pc: {
      label: 'PC',
      icon: '🖥',
      activationUrl: 'https://payment.naeu.playblackdesert.com/en-US/Shop/Coupon/',
      sourceType: 'manual-seed',
      coupons: [
        {
          code: 'TYALLADVENTURERS',
          publishedAt: '2026-07-29',
          expiresAt: '2026-11-26',
          rewardIcon: '🎁',
          rewardDescription: 'Благодарственный купон для игроков Black Desert',
          isNew: true,
          source: 'Black Desert Foundry'
        },
        {
          code: 'BEYONDTHEJOURNEY',
          publishedAt: '2026-07-29',
          expiresAt: '2026-08-09',
          rewardIcon: '✨',
          rewardDescription: 'Награды события Beyond the Journey',
          isNew: true,
          source: 'Black Desert Foundry'
        },
        {
          code: '2026NAEUSHOWDOWN',
          publishedAt: '2026-07-27',
          expiresAt: '2026-08-24',
          rewardIcon: '⚔',
          rewardDescription: 'Купон NA/EU Showdown 2026',
          isNew: true,
          source: 'Black Desert Foundry'
        },
        {
          code: 'BECOMINGBRIGHTER',
          publishedAt: '2026-06-27',
          expiresAt: '2026-07-31',
          rewardIcon: '💎',
          rewardDescription: 'Временный купон события',
          isNew: false,
          source: 'Black Desert Foundry'
        },
        {
          code: 'LIGHTUPFOURYEARS',
          publishedAt: '2026-06-27',
          expiresAt: '2026-07-31',
          rewardIcon: '🌟',
          rewardDescription: 'Купон годовщины',
          isNew: false,
          source: 'Black Desert Foundry'
        }
      ]
    },
    playstation: {
      label: 'PlayStation',
      icon: '🎮',
      activationUrl: 'https://www.console.playblackdesert.com/',
      sourceType: 'future-ai-hub',
      coupons: []
    },
    xbox: {
      label: 'Xbox',
      icon: '🟢',
      activationUrl: 'https://www.console.playblackdesert.com/',
      sourceType: 'future-ai-hub',
      coupons: []
    }
  }
};
