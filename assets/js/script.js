const timeElement = document.getElementById('miniTime');
const dateElement = document.getElementById('miniDate');

function updateMiniClock() {
  const now = new Date();

  if (timeElement) {
    timeElement.textContent = now.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  if (dateElement) {
    dateElement.textContent = now.toLocaleDateString('ru-RU', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
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