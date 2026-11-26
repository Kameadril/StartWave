const socket = new WebSocket(process.argv[2]);

socket.addEventListener('open', () => process.send({ type: 'open' }), { once: true });
socket.addEventListener('error', () => process.send({ type: 'error', error: 'browser DevTools WebSocket failed' }), { once: true });
socket.addEventListener('close', () => process.send?.({ type: 'closed' }), { once: true });
socket.addEventListener('message', ({ data }) => {
  try {
    const message = JSON.parse(data);
    if (!message.id) return;
    process.send({
      type: 'response',
      id: message.id,
      result: message.result,
      error: message.error?.message
    });
  } catch (error) {
    process.send({ type: 'error', error: `invalid browser DevTools message: ${error.message}` });
  }
});

process.on('message', (message) => socket.send(JSON.stringify(message)));
