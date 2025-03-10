const express = require("express");
const axios = require("axios");
const app = express();
app.use(express.json());

// Propósito:
// Cada nodo (node1.js y node2.js) es un servidor independiente con su propio almacenamiento en memoria (data).
// isPartitioned simula si hay una partición de red (comunicación interrumpida entre nodos).

let data = [];
let isPartitioned = false; // Simula una partición de red
const OTHER_NODE_URL = "http://localhost:3001"; // URL del otro nodo


// Flujo y Relación con CAP:

// Escritura Local:
// El dato se guarda inmediatamente en el nodo actual (data.push(newData)).
// Disponibilidad (A): El nodo responde rápidamente sin esperar confirmación del otro nodo.


// Endpoint para agregar datos
app.post("/data", async (req, res) => {
  const newData = req.body.data;
  data.push(newData);
  
    // Replica al otro nodo si no hay partición
    // Si isPartitioned = false, intenta replicar el dato al otro nodo.
    // Consistencia (C): En condiciones normales, ambos nodos se sincronizan para mantener los mismos datos.

    // Si isPartitioned = true, omite la replicación.
    // Tolerancia a Particiones (P): El sistema sigue funcionando incluso cuando los nodos no pueden comunicarse.
    // Sacrificio de Consistencia: Los datos divergen entre nodos durante la partición.

    if (!isPartitioned) {
        try {
        await axios.post(`${OTHER_NODE_URL}/data`, { data: newData });
        } catch (err) {
        console.log("[Node1] Error replicando datos:", err.message);
        }
    }
    res.json({ message: "Datos agregados en Node1", data: newData });
});

// Endpoint para obtener datos
// Comportamiento:
// Siempre devuelve los datos almacenados localmente, incluso si están desactualizados.
// Disponibilidad (A): El nodo responde inmediatamente, aunque los datos puedan ser inconsistentes con el otro nodo.
app.get("/data", (req, res) => {
  res.json({ data });
});

// Endpoint para simular partición
// Propósito:
// Permite simular una falla de red entre nodos para observar cómo se comporta el sistema bajo el Teorema CAP.
app.post("/toggle-partition", (req, res) => {
  isPartitioned = !isPartitioned;
  res.json({ message: `Partición: ${isPartitioned ? "ACTIVA" : "INACTIVA"}` });
});

app.listen(3000, () => {
  console.log("Node1 escuchando en puerto 3000");
});


// Escenarios del Teorema CAP
// *************** Escenario 1: Sin Partición (isPartitioned = false)
// Comportamiento:
//  1.Un cliente escribe en el Nodo 1: POST {"data": "A"} → Nodo1.

//  2.Nodo1 replica el dato a Nodo2.

//  3.Ambos nodos tienen ["A"].

// CAP Cumplido:

// Consistencia (C): Los datos son idénticos en ambos nodos.
// Disponibilidad (A): Ambos nodos responden inmediatamente.
// Tolerancia a Particiones (P): No aplica (no hay partición).

// **************  Escenario 2: Con Partición (isPartitioned = true)
// Comportamiento:

// 1.Cliente escribe {"data": "B"} en Nodo1:

//    Nodo1 almacena ["A", "B"].
//    No replica a Nodo2 (por la partición).
// 2.Cliente escribe {"data": "C"} en Nodo2:
//    Nodo2 almacena ["A", "C"].
//    No replica a Nodo1.

// ********************CAP Cumplido:

// Disponibilidad (A): Ambos nodos responden exitosamente.
// Tolerancia a Particiones (P): El sistema funciona a pesar de la partición.
// Consistencia (C): Sacrificada (Nodo1 tiene ["A", "B"], Nodo2 tiene ["A", "C"]).

