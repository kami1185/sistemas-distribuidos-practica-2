const express = require("express");
const axios = require("axios");
const app = express();
app.use(express.json());

let data = [];
let isPartitioned = false; // Simula partición de red
let partitionMode = "availability"; // Opciones: "availability" o "consistency"
const OTHER_NODE_URL = "http://localhost:3000";

// Endpoint para agregar datos (PACELC)
app.post("/data", async (req, res) => {
  const newData = req.body.data;
  const consistency = req.query.consistency || "low"; // "high" o "low"

  // Escenario de Partición (P)
  if (isPartitioned) {
    if (partitionMode === "consistency") {
      return res.status(503).json({ error: "Sistema inconsistente por partición" });
    } else {
      data.push(newData); // Disponibilidad (A)
      return res.json({ message: "Dato aceptado (Disponibilidad)", data: newData });
    }
  }

  // Escenario sin Partición (E)
  data.push(newData);
  if (consistency === "high") {
    try {
      await axios.post(`${OTHER_NODE_URL}/data`, { data: newData }); // Consistencia (C)
      res.json({ message: "Dato replicado (Consistencia)", data: newData });
    } catch (err) {
      res.status(500).json({ error: "Error en replicación" });
    }
  } else {
    // Baja latencia (L), replicación asíncrona
    axios.post(`${OTHER_NODE_URL}/data`, { data: newData }).catch(() => {});
    res.json({ message: "Dato aceptado (Baja latencia)", data: newData });
  }
});

// Endpoint para configurar modo de partición
app.post("/set-partition-mode", (req, res) => {
  partitionMode = req.body.mode;
  res.json({ message: `Modo partición: ${partitionMode}` });
});

// Resto del código (similar al ejemplo anterior)
app.get("/data", (req, res) => res.json({ data }));
app.post("/toggle-partition", (req, res) => {
  isPartitioned = !isPartitioned;
  res.json({ message: `Partición: ${isPartitioned ? "ACTIVA" : "INACTIVA"}` });
});

app.listen(3001, () => console.log("Node1 en puerto 3001"));