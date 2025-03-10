const express = require("express");
const axios = require("axios");
const app = express();
app.use(express.json());

const followers = ["http://localhost:3001", "http://localhost:3002"]; // URLs de seguidores
let data = {};

// Endpoint de escritura (solo líder)
app.post("/write", async (req, res) => {
  const { key, value } = req.body;
  data[key] = value;

  // Réplica asincrónica a seguidores
  followers.forEach(async (follower) => {
    try {
      await axios.post(`${follower}/replicate`, { key, value });
    } catch (err) {
      console.log(`Error replicando a ${follower}: ${err.message}`);
    }
  });

  res.json({ message: "Escritura exitosa en líder", data: { key, value } });
});

// Endpoint de lectura
app.get("/read/:key", (req, res) => {
  const value = data[req.params.key];
  res.json({ value });
});

app.listen(3000, () => console.log("Líder escuchando en puerto 3000"));
