const timeElement = document.getElementById('miniTime');
const dateElement = document.getElementById('miniDate');
const cardTimeElement = document.getElementById('cardTime');
const cardDateElement = document.getElementById('cardDate');
const prototypeTimeElement = document.getElementById('prototypeTime');
const prototypeTimeDateElement = document.getElementById('prototypeTimeDate');
const prototypeDateElement = document.getElementById('prototypeDate');
const prototypeCalendarNoteElement = document.getElementById('prototypeCalendarNote');
const prototypeWeatherElement = document.getElementById('prototypeWeather');
const prototypeWeatherNoteElement = document.getElementById('prototypeWeatherNote');
const prototypeCardTitleElement = document.getElementById('prototypeCardTitle');
const prototypeCardTextElement = document.getElementById('prototypeCardText');
const prototypeHoroscopeElement = document.getElementById('prototypeHoroscope');
const prototypeQuoteElement = document.getElementById('prototypeQuote');
const bdoCouponsListElement = document.getElementById('bdoCouponsList');
const searchForms = document.querySelectorAll('.search-box');
const searchEngineStorageKey = 'startwave-search-engine';
const searchEngines = {
  yandex: {
    action: 'https://yandex.ru/search/',
    queryParameter: 'text'
  },
  google: {
    action: 'https://www.google.com/search',
    queryParameter: 'q'
  }
};
const todayPrototypeData = {
  calendar: {
    note: 'Нет событий на сегодня'
  },
  dayCard: {
    title: 'Вдох',
    text: 'Один спокойный шаг важнее десяти шумных планов.'
  },
  horoscope: 'День подходит для мягкого старта, ясных решений и маленьких действий.',
  quote: '«Маленький шаг тоже двигает волну».'
};
const weatherLocation = {
  name: 'Москва',
  latitude: 55.7558,
  longitude: 37.6173
};
const weatherCodeDescriptions = {
  0: 'Ясно',
  1: 'Преимущественно ясно',
  2: 'Переменная облачность',
  3: 'Пасмурно',
  45: 'Туман',
  48: 'Иней и туман',
  51: 'Лёгкая морось',
  53: 'Морось',
  55: 'Сильная морось',
  56: 'Ледяная морось',
  57: 'Сильная ледяная морось',
  61: 'Небольшой дождь',
  63: 'Дождь',
  65: 'Сильный дождь',
  66: 'Ледяной дождь',
  67: 'Сильный ледяной дождь',
  71: 'Небольшой снег',
  73: 'Снег',
  75: 'Сильный снег',
  77: 'Снежные зёрна',
  80: 'Небольшой ливень',
  81: 'Ливень',
  82: 'Сильный ливень',
  85: 'Небольшой снегопад',
  86: 'Сильный снегопад',
  95: 'Гроза',
  96: 'Гроза с градом',
  99: 'Сильная гроза с градом'
};
const bdoInterfacePoints = {
  filters: {
    number: '1',
    title: 'Фильтры «Город» и «Ранг»',
    example: 'Пример: Велия, Ранг',
    description: 'Позволяют быстро отобрать рабочих по городу и рангу.'
  },
  'worker-rank': {
    number: '2',
    title: 'Уровень, ранг и раса рабочего',
    example: 'Пример: Ур.34 Мастер-гигант',
    description: 'Строка показывает уровень рабочего, его ранг и расу.'
  },
  stamina: {
    number: '3',
    title: 'Выносливость',
    example: 'Пример: 23/35',
    description: 'Показывает текущую и максимальную выносливость рабочего. Она расходуется во время выполнения рабочих циклов.'
  },
  'task-place': {
    number: '4',
    title: 'Текущее место или задание',
    example: 'Пример: Каменный зал',
    description: 'Показывает, куда отправлен рабочий или где выполняется его текущее задание.'
  },
  'worker-city': {
    number: '5',
    title: 'Город рабочего',
    example: 'Пример: Кальфеон',
    description: 'Город, к которому привязан рабочий и из которого начинается его маршрут.'
  },
  'work-time': {
    number: '6',
    title: 'Время выполнения',
    example: 'Пример: 2 ч. 27 мин.',
    description: 'Время, оставшееся до окончания текущего рабочего цикла.'
  },
  controls: {
    number: '7',
    title: 'Кнопки управления',
    example: '',
    description: 'Позволяют открыть информацию о рабочем, изменить или остановить задание и управлять повторением работы.'
  },
  recover: {
    number: '8',
    title: 'Кнопка «Восстановление»',
    example: '',
    description: 'Используется для восстановления выносливости рабочих с помощью подходящей еды.'
  },
  repeat: {
    number: '9',
    title: 'Кнопка «Повтор»',
    example: '',
    description: 'Позволяет снова отправить рабочих на ранее назначенные задания.'
  }
};

function getSavedSearchEngine() {
  try {
    const savedEngine = localStorage.getItem(searchEngineStorageKey);
    return searchEngines[savedEngine] ? savedEngine : 'yandex';
  } catch {
    return 'yandex';
  }
}

function getCouponTimeState(expiresAt) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const expiresDate = new Date(`${expiresAt}T23:59:59`);
  const expiresDay = new Date(expiresDate.getFullYear(), expiresDate.getMonth(), expiresDate.getDate());
  const diffDays = Math.ceil((expiresDay - today) / 86400000);

  if (diffDays < 0) {
    return {
      status: 'expired',
      statusText: '⚫ Истёк',
      timeLeft: 'Истёк'
    };
  }

  if (diffDays === 0) {
    return {
      status: 'today',
      statusText: '🔴 Заканчивается сегодня',
      timeLeft: 'Сегодня'
    };
  }

  if (diffDays <= 7) {
    return {
      status: 'soon',
      statusText: '🟡 Скоро закончится',
      timeLeft: `Осталось ${diffDays} ${getRussianDayWord(diffDays)}`
    };
  }

  return {
    status: 'active',
    statusText: '🟢 Активен',
    timeLeft: `Осталось ${diffDays} ${getRussianDayWord(diffDays)}`
  };
}

function getRussianDayWord(dayCount) {
  const lastDigit = dayCount % 10;
  const lastTwoDigits = dayCount % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return 'дней';
  }

  if (lastDigit === 1) {
    return 'день';
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return 'дня';
  }

  return 'дней';
}

function formatCouponDate(dateValue) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date(`${dateValue}T12:00:00`));
}

function formatCouponDateTime(dateValue) {
  if (!dateValue) {
    return 'ожидается';
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(dateValue));
}

function initializeBdoCouponsWidget() {
  if (!bdoCouponsListElement) {
    return;
  }

  const couponData = window.startWaveBdoCoupons || {};
  const platformTabsElement = document.getElementById('bdoCouponPlatforms');
  const activationLinkElement = document.getElementById('bdoCouponActivationLink');
  const couponsMetaElement = document.getElementById('bdoCouponsMeta');
  const platforms = couponData.platforms || {};
  const platformEntries = Object.entries(platforms);
  const couponLimit = couponData.limit || 5;
  let activePlatformKey = couponData.defaultPlatform && platforms[couponData.defaultPlatform]
    ? couponData.defaultPlatform
    : platformEntries[0]?.[0];

  if (!activePlatformKey) {
    bdoCouponsListElement.innerHTML = '<p class="bdo-coupons-empty">Пока нет данных о купонах.</p>';
    return;
  }

  function createCouponRow(coupon) {
    const timeState = getCouponTimeState(coupon.expiresAt);
    const couponRow = document.createElement('article');
    couponRow.className = 'bdo-coupon-row';

    const couponIcon = document.createElement('span');
    couponIcon.className = 'bdo-coupon-icon';
    couponIcon.setAttribute('aria-hidden', 'true');
    couponIcon.textContent = coupon.rewardIcon || '🎁';

    const couponCode = document.createElement('div');
    couponCode.className = 'bdo-coupon-code';

    const couponCodeText = document.createElement('strong');
    couponCodeText.textContent = coupon.code;

    couponCode.append(couponCodeText);

    if (coupon.isNew) {
      const newBadge = document.createElement('span');
      newBadge.className = 'bdo-coupon-new';
      newBadge.textContent = 'NEW';
      couponCode.append(newBadge);
    }

    const rewardDescription = document.createElement('span');
    rewardDescription.className = 'bdo-coupon-reward';
    rewardDescription.textContent = coupon.rewardDescription;
    couponCode.append(rewardDescription);

    const copyButton = document.createElement('button');
    copyButton.className = 'bdo-coupon-copy';
    copyButton.type = 'button';
    copyButton.textContent = '📋 Скопировать';

    copyButton.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(coupon.code);
        copyButton.textContent = '✔ Скопировано';
      } catch (error) {
        copyButton.textContent = 'Код выделен';
        window.getSelection()?.selectAllChildren(couponCodeText);
      }

      window.setTimeout(() => {
        copyButton.textContent = '📋 Скопировать';
      }, 2000);
    });

    const status = document.createElement('span');
    status.className = `bdo-coupon-status is-${timeState.status}`;
    status.textContent = timeState.statusText;

    const date = document.createElement('span');
    date.className = 'bdo-coupon-date';
    date.innerHTML = `<strong>До ${formatCouponDate(coupon.expiresAt)}</strong>${timeState.timeLeft}`;

    couponRow.append(couponIcon, couponCode, copyButton, status, date);
    return couponRow;
  }

  function renderPlatformTabs() {
    if (!platformTabsElement) {
      return;
    }

    platformTabsElement.replaceChildren(...platformEntries.map(([platformKey, platform]) => {
      const tabButton = document.createElement('button');
      const isActive = platformKey === activePlatformKey;

      tabButton.className = 'bdo-coupon-platform-tab';
      tabButton.type = 'button';
      tabButton.id = `bdoCouponTab-${platformKey}`;
      tabButton.setAttribute('role', 'tab');
      tabButton.setAttribute('aria-selected', String(isActive));
      tabButton.dataset.platform = platformKey;
      tabButton.textContent = `${platform.icon} ${platform.label}`;

      tabButton.addEventListener('click', () => {
        activePlatformKey = platformKey;
        renderCouponsCenter();
      });

      return tabButton;
    }));
  }

  function renderCouponsMeta() {
    if (!couponsMetaElement) {
      return;
    }

    const checkedLabels = (couponData.checkedPlatforms || [])
      .map((platformKey) => platforms[platformKey]?.label)
      .filter(Boolean)
      .map((label) => `✔ ${label}`);

    couponsMetaElement.innerHTML = `
      <span>Последнее обновление: <strong>${formatCouponDateTime(couponData.lastUpdatedAt)}</strong></span>
      <span>Проверено: <strong>${checkedLabels.join(' · ') || 'ожидается'}</strong></span>
    `;
  }

  function renderCouponsList() {
    const activePlatform = platforms[activePlatformKey];
    const activeCoupons = (activePlatform.coupons || [])
      .filter((coupon) => getCouponTimeState(coupon.expiresAt).status !== 'expired')
      .slice(0, couponLimit);

    if (activationLinkElement) {
      activationLinkElement.href = activePlatform.activationUrl || '#bdo-coupons-title';
    }

    if (activeCoupons.length === 0) {
      bdoCouponsListElement.innerHTML = `
        <article class="bdo-coupons-empty-state">
          <strong>На данный момент активных купонов нет.</strong>
          <span>Последняя проверка: ${formatCouponDateTime(couponData.lastUpdatedAt)}</span>
        </article>
      `;
      return;
    }

    bdoCouponsListElement.replaceChildren(...activeCoupons.map(createCouponRow));
  }

  function renderCouponsCenter() {
    renderPlatformTabs();
    renderCouponsList();
    renderCouponsMeta();
  }

  renderCouponsCenter();
}

function saveSearchEngine(engine) {
  try {
    localStorage.setItem(searchEngineStorageKey, engine);
  } catch {
    // Поиск продолжает работать, даже если localStorage недоступен.
  }
}

function applySearchEngine(form, engine) {
  const selectedEngine = searchEngines[engine] ? engine : 'yandex';
  const engineSettings = searchEngines[selectedEngine];
  const engineOptions = form.querySelectorAll('.search-engine-option');
  const searchInput = form.querySelector('input[type="search"]');

  form.action = engineSettings.action;

  engineOptions.forEach((option) => {
    const isSelected = option.dataset.engine === selectedEngine;
    option.setAttribute('aria-checked', String(isSelected));
    option.tabIndex = isSelected ? 0 : -1;
  });

  if (searchInput) {
    searchInput.name = engineSettings.queryParameter;
  }
}

function initializeSearchEngineSwitch() {
  const savedEngine = getSavedSearchEngine();

  searchForms.forEach((form) => {
    const engineOptions = Array.from(form.querySelectorAll('.search-engine-option'));

    applySearchEngine(form, savedEngine);

    engineOptions.forEach((option, optionIndex) => {
      option.addEventListener('click', () => {
        applySearchEngine(form, option.dataset.engine);
        saveSearchEngine(option.dataset.engine);
      });

      option.addEventListener('keydown', (event) => {
        const previousKeys = ['ArrowLeft', 'ArrowUp'];
        const nextKeys = ['ArrowRight', 'ArrowDown'];
        let nextIndex = optionIndex;

        if (previousKeys.includes(event.key)) {
          nextIndex = (optionIndex - 1 + engineOptions.length) % engineOptions.length;
        } else if (nextKeys.includes(event.key)) {
          nextIndex = (optionIndex + 1) % engineOptions.length;
        } else if (event.key === 'Home') {
          nextIndex = 0;
        } else if (event.key === 'End') {
          nextIndex = engineOptions.length - 1;
        } else {
          return;
        }

        event.preventDefault();
        const nextOption = engineOptions[nextIndex];
        applySearchEngine(form, nextOption.dataset.engine);
        saveSearchEngine(nextOption.dataset.engine);
        nextOption.focus();
      });
    });
  });
}

function updateMiniClock() {
  const now = new Date();

  const currentTime = now.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
  });

  const currentDate = now.toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });
  const shortDate = now.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  if (timeElement) {
    timeElement.textContent = currentTime;
  }

  if (dateElement) {
    dateElement.textContent = currentDate;
  }

  if (cardTimeElement) {
    cardTimeElement.textContent = currentTime;
  }

  if (cardDateElement) {
    cardDateElement.textContent = currentDate;
  }

  if (prototypeTimeElement) {
    prototypeTimeElement.textContent = currentTime;
  }

  if (prototypeTimeDateElement) {
    prototypeTimeDateElement.textContent = shortDate;
  }

  if (prototypeDateElement) {
    prototypeDateElement.textContent = currentDate;
  }
}

function startMiniClock() {
  updateMiniClock();

  const now = new Date();
  const delay = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

  setTimeout(() => {
    updateMiniClock();
    setInterval(updateMiniClock, 60000);
  }, delay);
}

async function updatePrototypeWeather() {
  if (!prototypeWeatherElement || !prototypeWeatherNoteElement) {
    return;
  }

  const weatherUrl = new URL('https://api.open-meteo.com/v1/forecast');
  weatherUrl.searchParams.set('latitude', weatherLocation.latitude);
  weatherUrl.searchParams.set('longitude', weatherLocation.longitude);
  weatherUrl.searchParams.set('current', 'temperature_2m,apparent_temperature,weather_code');
  weatherUrl.searchParams.set('timezone', 'auto');

  try {
    const response = await fetch(weatherUrl);

    if (!response.ok) {
      throw new Error('Weather request failed');
    }

    const weather = await response.json();
    const currentWeather = weather.current;
    const temperature = Math.round(currentWeather.temperature_2m);
    const apparentTemperature = Number.isFinite(currentWeather.apparent_temperature)
      ? Math.round(currentWeather.apparent_temperature)
      : null;
    const weatherCode = currentWeather.weather_code;
    const weatherDescription = weatherCodeDescriptions[weatherCode] || 'Погода обновлена';
    const apparentText = apparentTemperature === null
      ? ''
      : `, ощущается как ${apparentTemperature > 0 ? '+' : ''}${apparentTemperature}°C`;

    prototypeWeatherElement.textContent = `${temperature > 0 ? '+' : ''}${temperature}°C`;
    prototypeWeatherNoteElement.textContent = `${weatherDescription}${apparentText}`;
  } catch {
    prototypeWeatherElement.textContent = 'Недоступно';
    prototypeWeatherNoteElement.textContent = 'Погода не загрузилась';
  }
}

function initializeTodayPrototype() {
  const dayCard = document.querySelector('.day-card-flip');

  if (prototypeCalendarNoteElement) {
    prototypeCalendarNoteElement.textContent = todayPrototypeData.calendar.note;
  }

  if (prototypeCardTitleElement) {
    prototypeCardTitleElement.textContent = todayPrototypeData.dayCard.title;
  }

  if (prototypeCardTextElement) {
    prototypeCardTextElement.textContent = todayPrototypeData.dayCard.text;
  }

  if (prototypeHoroscopeElement) {
    prototypeHoroscopeElement.textContent = todayPrototypeData.horoscope;
  }

  if (prototypeQuoteElement) {
    prototypeQuoteElement.textContent = todayPrototypeData.quote;
  }

  if (dayCard) {
    dayCard.addEventListener('click', () => {
      const isFlipped = dayCard.classList.toggle('is-flipped');
      dayCard.setAttribute('aria-pressed', String(isFlipped));
    });
  }
}

function initializeBdoInterfaceGuide() {
  const markers = document.querySelectorAll('.bdo-interface-marker');
  const numberElement = document.getElementById('bdoInterfaceNumber');
  const titleElement = document.getElementById('bdoInterfaceTitle');
  const exampleElement = document.getElementById('bdoInterfaceExample');
  const descriptionElement = document.getElementById('bdoInterfaceDescription');

  if (!markers.length || !numberElement || !titleElement || !exampleElement || !descriptionElement) {
    return;
  }

  function setActivePoint(pointId) {
    const point = bdoInterfacePoints[pointId];

    if (!point) {
      return;
    }

    markers.forEach((marker) => {
      marker.classList.toggle('active', marker.dataset.interfacePoint === pointId);
    });

    numberElement.textContent = point.number;
    titleElement.textContent = point.title;
    exampleElement.textContent = point.example;
    exampleElement.hidden = !point.example;
    descriptionElement.textContent = point.description;
  }

  markers.forEach((marker) => {
    const pointId = marker.dataset.interfacePoint;

    marker.addEventListener('mouseenter', () => setActivePoint(pointId));
    marker.addEventListener('focus', () => setActivePoint(pointId));
    marker.addEventListener('click', () => setActivePoint(pointId));
  });

  setActivePoint(markers[0].dataset.interfacePoint);
}

function initializeLearningNavigation() {
  const learningPage = document.querySelector('[data-learning-page]');

  if (!learningPage) {
    return;
  }

  const routeSections = Array.from(learningPage.querySelectorAll('[data-route-item][id]'));

  if (!routeSections.length || document.querySelector('.learning-floating-actions')) {
    return;
  }

  const floatingActions = document.createElement('div');
  floatingActions.className = 'learning-floating-actions';

  const routePanel = document.createElement('aside');
  routePanel.className = 'learning-route-panel';
  routePanel.id = 'learningRoutePanel';
  routePanel.setAttribute('aria-label', 'Маршрут обучения');

  const routeTitle = document.createElement('h2');
  routeTitle.textContent = 'Маршрут страницы';

  const routeList = document.createElement('ol');
  routeList.className = 'learning-route-list';

  const routeLinks = routeSections.map((section) => {
    const routeItem = document.createElement('li');
    const routeLink = document.createElement('a');
    const sectionTitle = section.dataset.routeTitle || section.querySelector('h2')?.textContent?.trim() || section.id;

    routeLink.href = `#${section.id}`;
    routeLink.textContent = sectionTitle;
    routeLink.dataset.routeTarget = section.id;

    routeLink.addEventListener('click', () => {
      routePanel.classList.remove('is-open');
      routeButton.setAttribute('aria-expanded', 'false');
    });

    routeItem.append(routeLink);
    routeList.append(routeItem);

    return routeLink;
  });

  routePanel.append(routeTitle, routeList);

  const routeButton = document.createElement('button');
  routeButton.className = 'learning-route-button';
  routeButton.type = 'button';
  routeButton.setAttribute('aria-controls', routePanel.id);
  routeButton.setAttribute('aria-expanded', 'false');
  routeButton.textContent = '🧭 Маршрут';

  const topButton = document.createElement('button');
  topButton.className = 'learning-top-button';
  topButton.type = 'button';
  topButton.textContent = '↑ Наверх';

  routeButton.addEventListener('click', () => {
    const isOpen = routePanel.classList.toggle('is-open');
    routeButton.setAttribute('aria-expanded', String(isOpen));
  });

  topButton.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  floatingActions.append(routePanel, routeButton, topButton);
  document.body.append(floatingActions);

  function updateTopButtonVisibility() {
    topButton.classList.toggle('is-visible', window.scrollY > 420);
  }

  updateTopButtonVisibility();
  window.addEventListener('scroll', updateTopButtonVisibility, { passive: true });

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      const visibleEntry = entries
        .filter((entry) => entry.isIntersecting)
        .sort((firstEntry, secondEntry) => secondEntry.intersectionRatio - firstEntry.intersectionRatio)[0];

      if (!visibleEntry) {
        return;
      }

      routeLinks.forEach((link) => {
        link.classList.toggle('is-active', link.dataset.routeTarget === visibleEntry.target.id);
      });
    }, {
      rootMargin: '-20% 0px -65% 0px',
      threshold: [0.1, 0.25, 0.5]
    });

    routeSections.forEach((section) => observer.observe(section));
  }
}

function initializeBdoLandingHeader() {
  const bdoHeader = document.querySelector('.bdo-site-header');

  if (!bdoHeader) {
    return;
  }

  function updateBdoHeaderState() {
    document.body.classList.toggle('is-bdo-header-scrolled', window.scrollY > 24);
  }

  updateBdoHeaderState();
  window.addEventListener('scroll', updateBdoHeaderState, { passive: true });
}

function initializeBdoLandingNavigation() {
  const bdoLanding = document.querySelector('.bdo-landing-body');
  const routeItems = Array.from(document.querySelectorAll('[data-bdo-route-group][data-bdo-route-title]'));

  if (!bdoLanding || routeItems.length === 0) {
    return;
  }

  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const routeLinksByTarget = new Map();

  function highlightTarget(target) {
    if (!target) {
      return;
    }

    target.classList.remove('is-bdo-target-highlight');
    void target.offsetWidth;
    target.classList.add('is-bdo-target-highlight');

    window.setTimeout(() => {
      target.classList.remove('is-bdo-target-highlight');
    }, 1500);
  }

  function scrollToTarget(target) {
    target.scrollIntoView({
      behavior: reducedMotionQuery.matches ? 'auto' : 'smooth',
      block: 'start'
    });
    highlightTarget(target);
  }

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const targetId = link.getAttribute('href')?.slice(1);
      const target = targetId ? document.getElementById(targetId) : null;

      if (!target) {
        return;
      }

      event.preventDefault();
      history.pushState(null, '', `#${targetId}`);
      scrollToTarget(target);
    });
  });

  const floatingActions = document.createElement('div');
  floatingActions.className = 'bdo-floating-actions';

  const routePanel = document.createElement('div');
  routePanel.className = 'bdo-route-panel';
  routePanel.id = 'bdoRoutePanel';
  routePanel.setAttribute('aria-label', 'Маршрут BDO');

  const routeTitle = document.createElement('h2');
  routeTitle.textContent = 'Маршрут BDO';
  routePanel.append(routeTitle);

  const groups = routeItems.reduce((groupMap, item) => {
    const groupName = item.dataset.bdoRouteGroup;

    if (!groupMap.has(groupName)) {
      groupMap.set(groupName, []);
    }

    groupMap.get(groupName).push(item);
    return groupMap;
  }, new Map());

  groups.forEach((items, groupName) => {
    const groupBlock = document.createElement('section');
    groupBlock.className = 'bdo-route-group';

    const groupTitle = document.createElement('h3');
    groupTitle.textContent = groupName;

    const groupList = document.createElement('ol');
    groupList.className = 'bdo-route-list';

    items.forEach((item) => {
      const listItem = document.createElement('li');
      const routeLink = document.createElement('a');

      routeLink.href = `#${item.id}`;
      routeLink.textContent = item.dataset.bdoRouteTitle;
      routeLink.dataset.routeTarget = item.id;

      routeLink.addEventListener('click', () => {
        routePanel.classList.remove('is-open');
        routeButton.setAttribute('aria-expanded', 'false');
      });

      routeLinksByTarget.set(item.id, routeLink);
      listItem.append(routeLink);
      groupList.append(listItem);
    });

    groupBlock.append(groupTitle, groupList);
    routePanel.append(groupBlock);
  });

  const routeButton = document.createElement('button');
  routeButton.className = 'bdo-route-button';
  routeButton.type = 'button';
  routeButton.setAttribute('aria-controls', routePanel.id);
  routeButton.setAttribute('aria-expanded', 'false');
  routeButton.textContent = '🧭 Маршрут';

  const topButton = document.createElement('button');
  topButton.className = 'bdo-top-button';
  topButton.type = 'button';
  topButton.textContent = '↑ Наверх';

  routeButton.addEventListener('click', () => {
    const isOpen = routePanel.classList.toggle('is-open');
    routeButton.setAttribute('aria-expanded', String(isOpen));
  });

  topButton.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: reducedMotionQuery.matches ? 'auto' : 'smooth'
    });
  });

  function updateTopButtonVisibility() {
    topButton.classList.toggle('is-visible', window.scrollY > 420);
  }

  updateTopButtonVisibility();
  window.addEventListener('scroll', updateTopButtonVisibility, { passive: true });

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      const visibleEntry = entries
        .filter((entry) => entry.isIntersecting)
        .sort((firstEntry, secondEntry) => secondEntry.intersectionRatio - firstEntry.intersectionRatio)[0];

      if (!visibleEntry) {
        return;
      }

      routeItems.forEach((item) => {
        item.classList.toggle('is-bdo-route-active', item.id === visibleEntry.target.id);
      });

      routeLinksByTarget.forEach((link, targetId) => {
        link.classList.toggle('is-active', targetId === visibleEntry.target.id);
      });
    }, {
      rootMargin: '-28% 0px -58% 0px',
      threshold: [0.12, 0.25, 0.45]
    });

    routeItems.forEach((item) => observer.observe(item));
  }

  floatingActions.append(routePanel, routeButton, topButton);
  document.body.append(floatingActions);

  if (window.location.hash) {
    const initialTarget = document.getElementById(window.location.hash.slice(1));

    if (initialTarget?.matches('[data-bdo-route-group]')) {
      window.setTimeout(() => highlightTarget(initialTarget), 250);
    }
  }
}

startMiniClock();
initializeSearchEngineSwitch();
initializeBdoCouponsWidget();
initializeTodayPrototype();
initializeBdoInterfaceGuide();
initializeLearningNavigation();
initializeBdoLandingHeader();
initializeBdoLandingNavigation();
updatePrototypeWeather();
