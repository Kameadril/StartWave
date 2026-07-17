const timeElement = document.getElementById('miniTime');
const dateElement = document.getElementById('miniDate');
const cardTimeElement = document.getElementById('cardTime');
const cardDateElement = document.getElementById('cardDate');

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
