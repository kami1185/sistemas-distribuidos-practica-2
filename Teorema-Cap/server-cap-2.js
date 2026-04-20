const express = require("express");
const axios = require("axios");
const app = express();
app.use(express.json());

let data = [];
let isPartitioned = false;
const OTHER_NODE_URL = "http://localhost:3000"; // URL del otro nodo

// app.post("/data", async (req, res) => {
//   const newData = req.body.data;
//   data.push(newData);
//   if (!isPartitioned) {
//     try {
//       await axios.post(`${OTHER_NODE_URL}/data`, { data: newData });
//     } catch (err) {
//       console.log("[Node2] Error replicando datos:", err.message);
//     }
//   }
//   res.json({ message: "Datos agregados en Node2", data: newData });
// });

app.post("/data", async (req, res) => {
  const newData = req.body.data;
  
  // REVISAR SI EL DATO VIENE DE UNA REPLICACIÓN
  const isReplicatedPacket = req.headers['x-is-replication'] === 'true';

  // 1. Guardar el dato localmente
  data.push(newData);
  console.log(`[Node2] Guardado: ${newData} (Replicación: ${isReplicatedPacket})`);

  // 2. Lógica de replicación (Evitar bucle)
  // Solo replicamos si NO hay partición Y si el dato NO viene ya de una replicación
  if (!isPartitioned && !isReplicatedPacket) {
    try {
      await axios.post(`${OTHER_NODE_URL}/data`, 
        { data: newData }, 
        { headers: { 'x-is-replication': 'true' } } // Marcamos que esto ES una replicación
      );
    } catch (err) {
      console.log("[Node2] Error al replicar:", err.message);
    }
  }

  res.json({ message: "Procesado en Node2", data: newData });
  
});

app.get("/data", (req, res) => {
  res.json({ data });
});

app.post("/toggle-partition", (req, res) => {
  isPartitioned = !isPartitioned;
  res.json({ message: `Partición: ${isPartitioned ? "ACTIVA" : "INACTIVA"}` });
});

app.listen(3001, () => {
  console.log("Node2 escuchando en puerto 3001");
});