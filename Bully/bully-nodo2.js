const EventEmitter = require('events');

class Node extends EventEmitter {
    constructor(id, nodes) {
        super();
        this.id = id;
        this.nodes = nodes; // Objeto que mapea IDs a nodos
        this.isLeader = false;
        this.leaderId = null;
        this.electionTimeout = 200; // Tiempo de espera para respuestas
        this.electionInProgress = false;
    }

    send(receiverId, messageType, data = {}) {
        if (this.nodes[receiverId]) {
            this.nodes[receiverId].receive({ senderId: this.id, type: messageType, data });
        } else {
            console.log(`Nodo ${this.id}: No se encontró el nodo con ID ${receiverId}`);
        }
    }

    receive(message) {
        console.log(`Nodo ${this.id}: Recibió mensaje de ${message.senderId} de tipo ${message.type}`, message.data);
        switch (message.type) {
            case 'ELECTION':
                this.handleElection(message.senderId);
                break;
            case 'OK':
                this.handleOk(message.senderId);
                break;
            case 'LEADER':
                this.handleLeader(message.senderId, message.data.leaderId);
                break;
        }
    }

    startElection() {
        if (this.electionInProgress) {
            return;
        }
        this.electionInProgress = true;
        this.isLeader = false;
        this.leaderId = null;
        console.log(`Nodo ${this.id}: Iniciando elección.`);
        let higherNodesResponded = false;

        for (const nodeId in this.nodes) {
            if (parseInt(nodeId) > this.id) {
                this.send(parseInt(nodeId), 'ELECTION');
            }
        }

        setTimeout(() => {
            if (!higherNodesResponded) {
                console.log(`Nodo ${this.id}: No hubo respuesta de nodos superiores. Soy el nuevo líder.`);
                this.isLeader = true;
                this.leaderId = this.id;
                this.electionInProgress = false;
                for (const nodeId in this.nodes) {
                    if (parseInt(nodeId) !== this.id) {
                        this.send(parseInt(nodeId), 'LEADER', { leaderId: this.id });
                    }
                }
                this.emit('leaderElected', this.id);
            } else {
                this.electionInProgress = false;
            }
        }, this.electionTimeout);

        this.once('receivedOk', () => {
            higherNodesResponded = true;
        });
    }

    handleElection(senderId) {
        if (senderId < this.id) {
            console.log(`Nodo ${this.id}: Recibió mensaje de elección de nodo inferior ${senderId}. Respondiendo con OK.`);
            this.send(senderId, 'OK');
            if (!this.electionInProgress) {
                this.startElection();
            }
        } else {
            console.log(`Nodo ${this.id}: Recibió mensaje de elección de nodo superior o igual ${senderId}.`);
            if (!this.electionInProgress) {
                this.startElection();
            }
        }
    }

    handleOk(senderId) {
        console.log(`Nodo ${this.id}: Recibió OK de ${senderId}.`);
        this.emit('receivedOk');
    }

    handleLeader(senderId, leaderId) {
        console.log(`Nodo ${this.id}: Recibió mensaje de líder de ${senderId}. El líder es ${leaderId}.`);
        this.isLeader = false;
        this.leaderId = leaderId;
        this.electionInProgress = false;
        this.emit('leaderElected', leaderId);
    }

    detectLeaderFailure() {
        // Simulación de detección de fallo del líder (por ejemplo, mediante heartbeat)
        console.log(`Nodo ${this.id}: Detectó que el líder (si había uno) falló. Iniciando elección.`);
        this.startElection();
    }
}

// Simulación del sistema distribuido
const nodes = {};
for (let i = 1; i <= 5; i++) {
    nodes[i] = new Node(i, nodes);
    nodes[i].on('leaderElected', (leaderId) => {
        console.log(`Sistema: Nodo ${leaderId} ha sido elegido como líder.`);
    });
}

// Simular la detección de un fallo de líder en un nodo (por ejemplo, el nodo 3) después de un tiempo
setTimeout(() => {
    console.log("\nSimulando fallo del líder (si era el nodo 3).");
    // En un sistema real, esto se haría mediante la falta de heartbeats
    nodes[3].detectLeaderFailure();
}, 3000);

// Inicialmente, se puede iniciar una elección desde un nodo (por ejemplo, el nodo 1)
setTimeout(() => {
    console.log("\nIniciando la primera elección desde el nodo 1.");
    nodes[1].startElection();
}, 1000);

// Para probar la recuperación de un nodo que era el líder (por ejemplo, el nodo 5)
// Después de que otro líder ha sido elegido, si el nodo 5 vuelve, iniciará otra elección y se convertirá en el líder.
setTimeout(() => {
    console.log("\nSimulando la 'recuperación' del nodo 5.");
    nodes[5].detectLeaderFailure();
}, 7000);


// Explicación del código:

// Node Class:

// id: Identificador único del nodo.
// nodes: Un objeto que contiene referencias a todos los demás nodos en el sistema, indexados por su ID. Esto permite la comunicación directa entre nodos en esta simulación.
// isLeader: Un booleano que indica si este nodo es actualmente el líder.
// leaderId: El ID del nodo que actualmente se considera el líder.
// electionTimeout: El tiempo que un nodo espera por respuestas "OK" durante una elección.
// electionInProgress: Un booleano para evitar que un nodo inicie múltiples elecciones simultáneamente.
// send(receiverId, messageType, data): Envía un mensaje a otro nodo con el tipo especificado y datos opcionales.
// receive(message): Maneja los mensajes recibidos de otros nodos, disparando diferentes acciones según el tipo de mensaje ('ELECTION', 'OK', 'LEADER').
// startElection(): Inicia el proceso de elección. Envía mensajes 'ELECTION' a todos los nodos con un ID mayor. Si no recibe respuestas 'OK' dentro del electionTimeout, se declara como líder y envía mensajes 'LEADER' a todos los demás.
// handleElection(senderId): Se llama cuando se recibe un mensaje 'ELECTION'. Si el remitente tiene un ID menor, el nodo actual responde con 'OK' e inicia su propia elección si aún no está en curso. Si el remitente tiene un ID mayor o igual, el nodo actual inicia su propia elección si aún no está en curso.
// handleOk(senderId): Se llama cuando se recibe un mensaje 'OK' durante una elección iniciada por este nodo. Indica que un nodo superior está activo.
// handleLeader(senderId, leaderId): Se llama cuando se recibe un mensaje 'LEADER'. El nodo actual reconoce al nuevo líder y actualiza su estado.
// detectLeaderFailure(): Simula la detección de un fallo del líder e inicia una elección. En un sistema real, esto se basaría en la falta de heartbeats.
// Simulación del sistema:

// Se crea un objeto nodes para contener las instancias de la clase Node.
// Se crean 5 nodos con IDs del 1 al 5.
// Se adjunta un listener al evento leaderElected de cada nodo para registrar cuándo se elige un nuevo líder.
// Simulación de eventos:

// Se inicia una elección desde el nodo 1 después de un breve retraso.
// Se simula el fallo del líder (asumiendo que era el nodo 3) después de 3 segundos, lo que debería desencadenar una nueva elección.
// Se simula la "recuperación" del nodo 5 después de 7 segundos. Como el nodo 5 tiene el ID más alto, debería ganar la elección y convertirse en el nuevo líder.
// Cómo ejecutar el código:

// Guarda el código como bully.js.
// Ejecuta el script en Node.js: node bully.js