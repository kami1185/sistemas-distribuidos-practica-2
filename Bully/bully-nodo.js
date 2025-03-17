// como ejecutar:
// node bully-nodo.js 1 3001
// node bully-nodo.js 2 3002
// node bully-nodo.js 3 3003

const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const NODE_ID = parseInt(process.argv[2]); // ID único (ej.: 3)
const PORT = process.argv[3]; // Puerto (ej.: 3003)
const NODES = { // Configuración de todos los nodos (ID: puerto)
  1: 'http://localhost:3001',
  2: 'http://localhost:3002',
  3: 'http://localhost:3003'
};

let leaderId = null;
let electionInProgress = false;

// Endpoint para recibir mensajes de elección
app.post('/election', async (req, res) => {
  if (req.body.senderId < NODE_ID) {
    console.log(`Enviando Alive a nodo ${req.body.senderId}`);
    await axios.post(`${NODES[req.body.senderId]}/alive`, { senderId: NODE_ID });
    if (!electionInProgress) startElection();
  }
  res.sendStatus(200);
});

// Endpoint para recibir Alive
app.post('/alive', (req, res) => {
  electionInProgress = false; // Otro nodo responde, cancela elección
  res.sendStatus(200);
});

// Endpoint para recibir Coordinator
app.post('/coordinator', (req, res) => {
  leaderId = req.body.leaderId;
  console.log(`Nuevo líder elegido: ${leaderId}`);
  electionInProgress = false;
  res.sendStatus(200);
});

// Iniciar elección
function startElection() {
  electionInProgress = true;
  const higherNodes = Object.keys(NODES)
    .filter(id => id > NODE_ID)
    .map(id => NODES[id]);

  if (higherNodes.length === 0) {
    declareAsLeader();
  } else {
    higherNodes.forEach(async (nodeUrl) => {
      try {
        await axios.post(`${nodeUrl}/election`, { senderId: NODE_ID });
      } catch (err) {
        // Si el nodo no responde, continúa
      }
    });
    setTimeout(() => {
      if (electionInProgress) declareAsLeader();
    }, 5000); // Timeout de 5 segundos
  }
}

// Proclamarse líder
function declareAsLeader() {
  leaderId = NODE_ID;
  console.log(`Soy el nuevo líder (ID: ${NODE_ID})`);
  Object.values(NODES).forEach(async (nodeUrl) => {
    if (nodeUrl !== NODES[NODE_ID]) {
      await axios.post(`${nodeUrl}/coordinator`, { leaderId: NODE_ID });
    }
  });
}

// Simular detección de fallo del líder
setInterval(() => {
  if (leaderId !== null && leaderId !== NODE_ID) {
    axios.get(`${NODES[leaderId]}/health`)
      .catch(() => {
        console.log(`Líder ${leaderId} caído. Iniciando elección...`);
        startElection();
      });
  }
}, 3000); // Verificar cada 10 segundos

app.get('/health', (req, res) => res.sendStatus(200));
app.listen(PORT, () => console.log(`Nodo ${NODE_ID} en puerto ${PORT}`));