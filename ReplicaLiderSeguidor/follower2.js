const express = require("express");
const app = express();
app.use(express.json());

let data = {};

// Endpoint para recibir réplicas del líder
app.post("/replicate", (req, res) => {
  const { key, value } = req.body;
  data[key] = value;
  res.json({ message: "Réplica exitosa" });
});

// Endpoint de lectura
app.get("/read/:key", (req, res) => {
  const value = data[req.params.key];
  res.json({ value });
});

app.listen(3002, () => console.log("Seguidor 2 en puerto 3002"));