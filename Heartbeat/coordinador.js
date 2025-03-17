const express = require('express');
const app = express();
app.use(express.json());

const nodes = new Map(); // Almacena { nodeId: lastHeartbeat }

// Endpoint para recibir heartbeats
app.post('/heartbeat', (req, res) => {
  const { nodeId } = req.body;
  nodes.set(nodeId, Date.now());
  res.send({ status: 'ACK' });
});

// Verificar nodos inactivos (timeout: 10 segundos)
setInterval(() => {
  const now = Date.now();
  nodes.forEach((lastTime, nodeId) => {
    if (now - lastTime > 10000) {
      console.log(`Nodo ${nodeId} caído! ${lastTime}`);
      nodes.delete(nodeId);
    }
  });
}, 5000); // Chequea cada 5 segundos

app.listen(3000, () => console.log('Coordinador en puerto 3000'));
