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
  const engineSelect = form.querySelector('.search-engine-select');
  const searchInput = form.querySelector('input[type="search"]');

  form.action = engineSettings.action;

  if (engineSelect) {
    engineSelect.value = selectedEngine;
  }

  if (searchInput) {
    searchInput.name = engineSettings.queryParameter;
  }
}

function initializeSearchEngineSwitch() {
  const savedEngine = getSavedSearchEngine();

  searchForms.forEach((form) => {
    const engineSelect = form.querySelector('.search-engine-select');

    applySearchEngine(form, savedEngine);

    if (engineSelect) {
      engineSelect.addEventListener('change', () => {
        applySearchEngine(form, engineSelect.value);
        saveSearchEngine(engineSelect.value);
      });
    }
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
