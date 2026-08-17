const PROFILE_STORAGE_KEY = 'startwave.profile.v1';
const profileForm = document.getElementById('profileForm');
const birthDateInput = document.getElementById('birthDate');
const birthDateError = document.getElementById('birthDateError');
const zodiacResult = document.getElementById('zodiacResult');
const saveStatus = document.getElementById('saveStatus');

const zodiacSigns = [
  { name: 'Водолей', start: 120 },
  { name: 'Рыбы', start: 219 },
  { name: 'Овен', start: 321 },
  { name: 'Телец', start: 420 },
  { name: 'Близнецы', start: 521 },
  { name: 'Рак', start: 621 },
  { name: 'Лев', start: 723 },
  { name: 'Дева', start: 823 },
  { name: 'Весы', start: 923 },
  { name: 'Скорпион', start: 1023 },
  { name: 'Стрелец', start: 1122 },
  { name: 'Козерог', start: 1222 }
];

function parseLocalDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return { year, month, day, date };
}

function getZodiacSign(value) {
  const parsed = parseLocalDate(value);
  if (!parsed) return '';

  const monthDay = parsed.month * 100 + parsed.day;
  let sign = 'Козерог';
  for (const zodiac of zodiacSigns) {
    if (monthDay >= zodiac.start) sign = zodiac.name;
  }
  return sign;
}

function validateBirthDate(showMessage = true) {
  const value = birthDateInput.value;
  let message = '';

  if (value) {
    const parsed = parseLocalDate(value);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (!parsed) message = 'Укажи существующую дату.';
    else if (parsed.date > today) message = 'Дата рождения не может быть в будущем.';
  }

  birthDateInput.setAttribute('aria-invalid', String(Boolean(message)));
  birthDateError.textContent = showMessage ? message : '';
  zodiacResult.textContent = message || !value ? 'Не определён' : getZodiacSign(value);
  return !message;
}

function setRadioValue(name, value, fallback) {
  const option = profileForm.elements[name].value !== undefined
    ? profileForm.querySelector(`input[name="${name}"][value="${value}"]`)
    : null;
  const target = option || profileForm.querySelector(`input[name="${name}"][value="${fallback}"]`);
  if (target) target.checked = true;
}

function restoreProfile() {
  let saved;
  try { saved = JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY)); } catch { return; }
  if (!saved || typeof saved !== 'object') return;

  profileForm.elements.name.value = typeof saved.name === 'string' ? saved.name.slice(0, 50) : '';
  profileForm.elements.birthDate.value = typeof saved.birthDate === 'string' ? saved.birthDate : '';
  setRadioValue('gender', saved.gender, 'neutral');
  setRadioValue('waveStyle', saved.waveStyle, 'calm');

  const savedInterests = Array.isArray(saved.interests) ? saved.interests : [];
  profileForm.querySelectorAll('input[name="interests"]').forEach((input) => {
    input.checked = savedInterests.includes(input.value);
  });
  validateBirthDate(false);
}

const today = new Date();
birthDateInput.max = [
  today.getFullYear(),
  String(today.getMonth() + 1).padStart(2, '0'),
  String(today.getDate()).padStart(2, '0')
].join('-');
birthDateInput.addEventListener('input', () => validateBirthDate(true));

profileForm.addEventListener('submit', (event) => {
  event.preventDefault();
  saveStatus.textContent = '';
  if (!validateBirthDate(true)) { birthDateInput.focus(); return; }

  const profile = {
    version: 1,
    name: profileForm.elements.name.value.trim(),
    gender: profileForm.elements.gender.value || 'neutral',
    birthDate: birthDateInput.value,
    zodiacSign: getZodiacSign(birthDateInput.value),
    interests: Array.from(profileForm.querySelectorAll('input[name="interests"]:checked'), (input) => input.value),
    waveStyle: profileForm.elements.waveStyle.value || 'calm'
  };

  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    saveStatus.textContent = 'Профиль сохранён в этом браузере.';
  } catch {
    saveStatus.textContent = 'Не удалось сохранить: локальное хранилище недоступно.';
  }
});

restoreProfile();
