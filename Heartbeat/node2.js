const express = require('express');
const axios = require('axios');
const cron = require('cron');
const app = express();

const NODE_ID = process.argv[2] || 'node-2';
const COORDINATOR_URL = 'http://localhost:3000';

// Creando un cron job y enviando un heartbeat cada 3 segundos
const job = new cron.CronJob('*/3 * * * * *', async () => {
  try {
    await axios.post(`${COORDINATOR_URL}/heartbeat`, { nodeId: NODE_ID });
    console.log(`Heartbeat enviado por ${NODE_ID}`);
  } catch (err) {
    console.error(`Error en heartbeat (${NODE_ID}): ${err.message}`);
  }
});

job.start();

// Simular un servicio en el nodo
app.get('/data', (req, res) => {
  res.send(`Datos desde ${NODE_ID}`);
});

const PORT = process.argv[3] || 4001;
app.listen(PORT, () => console.log(`Nodo ${NODE_ID} en puerto ${PORT}`));