const EventEmitter = require('events');

class RaftNode extends EventEmitter {
    constructor(id, peers) {
        super();
        this.id = id;
        this.peers = peers; // Array de IDs de otros nodos
        this.state = 'follower'; // 'leader', 'follower', 'candidate'
        this.currentTerm = 0;
        this.votedFor = null;
        this.log ='';
        this.commitIndex = -1;
        this.lastApplied = -1;

        this.nextIndex = {}; // Para líderes: índice de la próxima entrada a enviar a cada seguidor
        this.matchIndex = {}; // Para líderes: índice de la entrada más alta conocida replicada en cada seguidor

        this.electionTimeout = this.getRandomElectionTimeout();
        this.heartbeatInterval = 150; // Milisegundos

        this.electionTimer = null;
        this.heartbeatTimer = null;

        this.startElectionTimer();
    }

    getRandomElectionTimeout() {
        return Math.floor(Math.random() * 150) + 150; // Entre 150 y 300 ms
    }

    startElectionTimer() {
        clearTimeout(this.electionTimer);
        this.electionTimer = setTimeout(() => {
            if (this.state !== 'leader') {
                this.startElection();
            }
        }, this.electionTimeout);
    }

    stopElectionTimer() {
        clearTimeout(this.electionTimer);
    }

    startHeartbeatTimer() {
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = setInterval(() => {
            if (this.state === 'leader') {
                this.sendAppendEntries();
            }
        }, this.heartbeatInterval);
    }

    becomeFollower(term, leaderId = null) {
        this.state = 'follower';
        this.currentTerm = term;
        this.votedFor = leaderId;
        this.stopHeartbeatTimer();
        this.startElectionTimer();
        console.log(`Node ${this.id}: Became follower in term ${term}, voted for ${leaderId}`);
    }

    becomeCandidate() {
        this.state = 'candidate';
        this.currentTerm++;
        this.votedFor = this.id;
        this.votesReceived = 1;
        this.stopHeartbeatTimer();
        this.startElectionTimer(); // Reiniciar el timer de elección
        console.log(`Node ${this.id}: Became candidate in term ${this.currentTerm}`);

        this.peers.forEach(peerId => {
            this.sendRequestVote(peerId, this.currentTerm, this.id, this.log.length - 1, this.log.length > 0 ? this.log[this.log.length - 1].term : 0);
        });
    }

    becomeLeader() {
        this.state = 'leader';
        this.stopElectionTimer();
        this.startHeartbeatTimer();
        console.log(`Node ${this.id}: Became leader in term ${this.currentTerm}`);

        this.nextIndex = {};
        this.matchIndex = {};
        this.peers.forEach(peerId => {
            this.nextIndex[peerId] = this.log.length;
            this.matchIndex[peerId] = -1;
        });

        this.sendAppendEntries(); // Enviar el primer heartbeat
    }

    sendRequestVote(peerId, term, candidateId, lastLogIndex, lastLogTerm) {
        this.emit('send', peerId, {
            type: 'requestVote',
            term,
            candidateId,
            lastLogIndex,
            lastLogTerm,
        });
    }

    handleRequestVote(term, candidateId, lastLogIndex, lastLogTerm) {
        if (term < this.currentTerm) {
            this.emit('reply', candidateId, { type: 'voteResponse', term: this.currentTerm, voteGranted: false });
            return;
        }

        if (term > this.currentTerm) {
            this.becomeFollower(term);
        }

        const logOk = lastLogIndex >= this.log.length - 1 && (this.log.length === 0 || lastLogTerm >= this.log[this.log.length - 1].term);

        if ((this.votedFor === null || this.votedFor === candidateId) && logOk) {
            this.votedFor = candidateId;
            this.emit('reply', candidateId, { type: 'voteResponse', term: this.currentTerm, voteGranted: true });
            this.stopElectionTimer();
            this.startElectionTimer(); // Reiniciar timer al votar
        } else {
            this.emit('reply', candidateId, { type: 'voteResponse', term: this.currentTerm, voteGranted: false });
        }
    }

    sendAppendEntries(peerId) {
        const prevLogIndex = this.nextIndex[peerId] - 1;
        const prevLogTerm = prevLogIndex >= 0 ? this.log[prevLogIndex].term : 0;
        const entries = this.log.slice(this.nextIndex[peerId]);

        this.emit('send', peerId, {
            type: 'appendEntries',
            term: this.currentTerm,
            leaderId: this.id,
            prevLogIndex,
            prevLogTerm,
            entries,
            leaderCommit: this.commitIndex,
        });
    }

    handleAppendEntries(term, leaderId, prevLogIndex, prevLogTerm, entries, leaderCommit) {
        if (term < this.currentTerm) {
            this.emit('reply', leaderId, { type: 'appendResponse', term: this.currentTerm, success: false });
            return;
        }

        if (term > this.currentTerm) {
            this.becomeFollower(term, leaderId);
        } else if (this.state === 'candidate') {
            this.becomeFollower(term, leaderId);
        }

        this.stopElectionTimer();
        this.startElectionTimer(); // Reiniciar timer al recibir heartbeat

        if (prevLogIndex > this.log.length - 1 || (prevLogIndex >= 0 && this.log[prevLogIndex].term !== prevLogTerm)) {
            this.emit('reply', leaderId, { type: 'appendResponse', term: this.currentTerm, success: false, conflictIndex: this.log.length, conflictTerm: prevLogTerm });
            return;
        }

        for (let i = 0; i < entries.length; i++) {
            const index = prevLogIndex + 1 + i;
            if (index >= this.log.length || this.log[index].term !== entries[i].term) {
                this.log = this.log.slice(0, index).concat(entries.slice(i));
                break;
            }
        }

        if (leaderCommit > this.commitIndex) {
            this.commitIndex = Math.min(leaderCommit, this.log.length - 1);
            while (this.lastApplied < this.commitIndex) {
                this.lastApplied++;
                this.emit('commit', this.log[this.lastApplied]);
            }
        }

        this.emit('reply', leaderId, { type: 'appendResponse', term: this.currentTerm, success: true, lastLogIndex: this.log.length - 1 });
    }

    handleRequestVoteResponse(term, voteGranted, peerId) {
        if (term === this.currentTerm && this.state === 'candidate' && voteGranted) {
            this.votesReceived++;
            if (this.votesReceived > this.peers.length / 2) {
                this.becomeLeader();
            }
        } else if (term > this.currentTerm) {
            this.becomeFollower(term);
        }
    }

    handleAppendEntriesResponse(term, success, peerId, lastLogIndex, conflictIndex, conflictTerm) {
        if (term === this.currentTerm && this.state === 'leader') {
            if (success) {
                this.nextIndex[peerId] = Math.max(this.nextIndex[peerId], lastLogIndex + 1);
                this.matchIndex[peerId] = Math.max(this.matchIndex[peerId], lastLogIndex);
                this.updateCommitIndex();
            } else {
                if (conflictTerm !== undefined) {
                    let firstIndexWithTerm = -1;
                    for (let i = 0; i < this.log.length; i++) {
                        if (this.log[i].term === conflictTerm) {
                            firstIndexWithTerm = i;
                            break;
                        }
                    }
                    this.nextIndex[peerId] = firstIndexWithTerm !== -1 ? firstIndexWithTerm : conflictIndex;
                } else {
                    this.nextIndex[peerId] = Math.max(1, this.nextIndex[peerId] - 1);
                }
                this.sendAppendEntries(peerId);
            }
        } else if (term > this.currentTerm) {
            this.becomeFollower(term);
        }
    }

    updateCommitIndex() {
        const sortedMatchIndex = Object.values(this.matchIndex).sort((a, b) => b - a);
        const newCommitIndex = sortedMatchIndex[Math.floor(this.peers.length / 2)];
        if (newCommitIndex > this.commitIndex && (this.log[newCommitIndex] ? this.log[newCommitIndex].term === this.currentTerm : false)) {
            this.commitIndex = newCommitIndex;
            while (this.lastApplied < this.commitIndex) {
                this.lastApplied++;
                this.emit('commit', this.log[this.lastApplied]);
            }
        }
    }

    startElection() {
        this.becomeCandidate();
    }

    appendLogEntry(command) {
        if (this.state === 'leader') {
            const newEntry = { term: this.currentTerm, command };
            this.log.push(newEntry);
            this.nextIndex[this.id] = this.log.length;
            this.matchIndex[this.id] = this.log.length - 1;
            this.sendAppendEntries(); // Replicar la entrada inmediatamente
        }
    }
}

// Simulación de la red
const nodes = {};
const peerIds = ['B', 'C'];
nodes['A'] = new RaftNode('A', peerIds);
nodes['B'] = new RaftNode('B', ['A', 'C']);
nodes['C'] = new RaftNode('C', ['A', 'B']);

// Función para simular el envío de mensajes
function sendMessage(senderId, receiverId, message) {
    console.log(`${senderId} -> ${receiverId}: ${JSON.stringify(message)}`);
    if (nodes[receiverId]) {
        if (message.type === 'requestVote') {
            nodes[receiverId].handleRequestVote(message.term, message.candidateId, message.lastLogIndex, message.lastLogTerm);
        } else if (message.type === 'voteResponse') {
            nodes[senderId].handleRequestVoteResponse(message.term, message.voteGranted, receiverId);
        } else if (message.type === 'appendEntries') {
            nodes[receiverId].handleAppendEntries(message.term, message.leaderId, message.prevLogIndex, message.prevLogTerm, message.entries, message.leaderCommit);
        } else if (message.type === 'appendResponse') {
            nodes[senderId].handleAppendEntriesResponse(message.term, message.success, receiverId, message.lastLogIndex, message.conflictIndex, message.conflictTerm);
        }
    }
}

// Configurar los listeners para la comunicación
for (const nodeId in nodes) {
    nodes[nodeId].on('send', (receiverId, message) => {
        sendMessage(nodeId, receiverId, message);
    });
    nodes[nodeId].on('reply', (receiverId, message) => {
        sendMessage(nodeId, receiverId, message);
    });
    nodes[nodeId].on('commit', (logEntry) => {
        console.log(`Node ${nodeId}: Committed command - ${JSON.stringify(logEntry.command)}`);
    });
}

// Iniciar la simulación (los nodos intentarán elegir un líder)
console.log("Starting Raft simulation...");
setTimeout(() => {
    nodes['A'].startElection(); // Inicialmente forzar una elección desde el nodo A
}, 100);

// Ejemplo de cómo un cliente podría intentar añadir una entrada al log (solo al líder)
setTimeout(() => {
    if (nodes['A'].state === 'leader') {
        nodes['A'].appendLogEntry({ action: 'setValue', key: 'x', value: 10 });
    } else if (nodes['B'].state === 'leader') {
        nodes['B'].appendLogEntry({ action: 'setValue', key: 'y', value: 20 });
    } else if (nodes['C'].state === 'leader') {
        nodes['C'].appendLogEntry({ action: 'setValue', key: 'z', value: 30 });
    }
}, 5000);