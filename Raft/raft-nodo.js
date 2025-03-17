// como ejecutar en 3 terminales:
// node raft-nodo.js node-1 3001
// node raft-nodo.js node-2 3002
// node raft-nodo.js node-3 3003

const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const NODE_ID = process.argv[2]; // Ej: 'node-1'
const PORT = process.argv[3]; // Ej: 3001
const NODES = {
  'node-1': 'http://localhost:3001',
  'node-2': 'http://localhost:3002',
  'node-3': 'http://localhost:3003'
};

// Estado Raft
let state = {
  currentTerm: 0,
  votedFor: null,
  log: [],
  state: 'follower', // 'leader', 'candidate', 'follower'
  leaderId: null,
  electionTimeout: null
};

// Iniciar timeout de elección
function resetElectionTimeout() {
  if (state.electionTimeout) clearTimeout(state.electionTimeout);
  state.electionTimeout = setTimeout(startElection, Math.random() * 150 + 150); // 150-300 ms
}

// Endpoint para heartbeats (AppendEntries RPC)
app.post('/append-entries', (req, res) => {
  if (req.body.term >= state.currentTerm) {
    state.currentTerm = req.body.term;
    state.leaderId = req.body.leaderId;
    state.state = 'follower';
    resetElectionTimeout();
    res.send({ term: state.currentTerm, success: true });
  } else {
    res.send({ term: state.currentTerm, success: false });
  }
});

// Endpoint para solicitar votos (RequestVote RPC)
app.post('/request-vote', (req, res) => {
  const { candidateId, term } = req.body;
  if (term > state.currentTerm && state.votedFor === null) {
    state.currentTerm = term;
    state.votedFor = candidateId;
    resetElectionTimeout();
    res.send({ term: state.currentTerm, voteGranted: true });
  } else {
    res.send({ term: state.currentTerm, voteGranted: false });
  }
});

// Iniciar elección
function startElection() {
  state.state = 'candidate';
  state.currentTerm++;
  state.votedFor = NODE_ID;
  let votes = 1;

  const otherNodes = Object.keys(NODES).filter(id => id !== NODE_ID);
  otherNodes.forEach(async nodeId => {
    try {
      const response = await axios.post(`${NODES[nodeId]}/request-vote`, {
        term: state.currentTerm,
        candidateId: NODE_ID
      });
      if (response.data.voteGranted) votes++;
      if (votes > otherNodes.length / 2) becomeLeader();
    } catch (err) {}
  });
}

// Convertirse en líder
function becomeLeader() {
  state.state = 'leader';
  state.leaderId = NODE_ID;
  console.log(`¡${NODE_ID} es el nuevo líder!`);
  // Enviar heartbeats periódicos
  setInterval(() => {
    Object.keys(NODES).forEach(async nodeId => {
      if (nodeId !== NODE_ID) {
        await axios.post(`${NODES[nodeId]}/append-entries`, {
          term: state.currentTerm,
          leaderId: NODE_ID
        });
      }
    });
  }, 50); // Heartbeat cada 50 ms
}

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Nodo ${NODE_ID} escuchando en puerto ${PORT}`);
  resetElectionTimeout();
});