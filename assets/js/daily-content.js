(function () {
  'use strict';

  const DAILY_RESET_HOUR = 0;
  const DAILY_RESET_MINUTE = 1;
  const PROFILE_STORAGE_KEY = 'startwave.profile.v1';
  const ZODIAC_SYMBOLS = Object.freeze({
    'Овен': '♈', 'Телец': '♉', 'Близнецы': '♊', 'Рак': '♋',
    'Лев': '♌', 'Дева': '♍', 'Весы': '♎', 'Скорпион': '♏',
    'Стрелец': '♐', 'Козерог': '♑', 'Водолей': '♒', 'Рыбы': '♓'
  });

  function getEffectiveDailyDate(date = new Date()) {
    const effectiveDate = new Date(date.getTime());

    if (
      effectiveDate.getHours() === DAILY_RESET_HOUR
      && effectiveDate.getMinutes() < DAILY_RESET_MINUTE
    ) {
      effectiveDate.setDate(effectiveDate.getDate() - 1);
    }

    return effectiveDate;
  }

  function getDailyKey(date = new Date()) {
    const effectiveDate = getEffectiveDailyDate(date);
    const year = effectiveDate.getFullYear();
    const month = String(effectiveDate.getMonth() + 1).padStart(2, '0');
    const day = String(effectiveDate.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  function hash(value) {
    let result = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      result ^= value.charCodeAt(index);
      result = Math.imul(result, 16777619);
    }
    result += result << 13;
    result ^= result >>> 7;
    result += result << 3;
    result ^= result >>> 17;
    result += result << 5;
    return result >>> 0;
  }

  function normalizeProfile(value) {
    if (!value || typeof value !== 'object') return Object.freeze({
      name: '', gender: 'neutral', zodiacSign: '', interests: Object.freeze([]), waveStyle: 'calm'
    });

    const allowedInterests = ['games', 'movies', 'music', 'books', 'sport', 'travel', 'technology', 'creativity'];
    const interests = Array.isArray(value.interests)
      ? value.interests.filter((interest) => allowedInterests.includes(interest)).slice(0, 8)
      : [];
    const waveStyle = ['humor', 'calm', 'motivating'].includes(value.waveStyle) ? value.waveStyle : 'calm';
    const gender = ['male', 'female', 'neutral'].includes(value.gender) ? value.gender : 'neutral';

    return Object.freeze({
      name: typeof value.name === 'string' ? value.name.trim().slice(0, 50) : '',
      gender,
      zodiacSign: ZODIAC_SYMBOLS[value.zodiacSign] ? value.zodiacSign : '',
      interests: Object.freeze(interests),
      waveStyle
    });
  }

  function readProfile() {
    try {
      return normalizeProfile(JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY)));
    } catch {
      return normalizeProfile(null);
    }
  }

  function select(entries, dailyKey, salt, profile, useStyle = true) {
    const styled = useStyle ? entries.filter((entry) => entry.style === profile.waveStyle) : entries;
    const pool = styled.length ? styled : entries;
    const matching = profile.interests.length
      ? pool.filter((entry) => entry.tags && entry.tags.some((tag) => profile.interests.includes(tag)))
      : [];
    const interestedPool = matching.length ? pool.concat(matching, matching) : pool;
    return interestedPool[hash(`${dailyKey}|${salt}`) % interestedPool.length];
  }

  function buildDailyPackage({ dailyKey = getDailyKey(), data, profile = readProfile(), card = null } = {}) {
    const safeProfile = normalizeProfile(profile);
    if (!data) return null;

    const zodiac = safeProfile.zodiacSign;
    return Object.freeze({
      dailyKey,
      heading: zodiac ? `Волна дня — ${zodiac} ${ZODIAC_SYMBOLS[zodiac]}` : 'Волна дня',
      greeting: safeProfile.name ? `${safeProfile.name}, сегодня без лишнего шума — только то, что может пригодиться.` : '',
      theme: select(data.themes, dailyKey, 'wave:theme', safeProfile, false),
      business: select(data.business, dailyKey, 'wave:business', safeProfile),
      money: select(data.money, dailyKey, 'wave:money', safeProfile),
      relationships: select(data.relationships, dailyKey, 'wave:relationships', safeProfile),
      selfCare: select(data.selfCare, dailyKey, 'wave:self-care', safeProfile),
      phrase: select(data.phrases, dailyKey, 'wave:phrase', safeProfile),
      card,
      profile: safeProfile
    });
  }

  window.STARTWAVE_DAILY_CONTENT = Object.freeze({
    resetTime: '00:01',
    getEffectiveDailyDate,
    getDailyKey,
    hash,
    normalizeProfile,
    readProfile,
    buildDailyPackage
  });
}());
