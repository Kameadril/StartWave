const timeElement = document.getElementById('miniTime');
const dateElement = document.getElementById('miniDate');
const cardTimeElement = document.getElementById('cardTime');
const cardDateElement = document.getElementById('cardDate');
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

function getSavedSearchEngine() {
  try {
    const savedEngine = localStorage.getItem(searchEngineStorageKey);
    return searchEngines[savedEngine] ? savedEngine : 'yandex';
  } catch {
    return 'yandex';
  }
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

startMiniClock();
initializeSearchEngineSwitch();
