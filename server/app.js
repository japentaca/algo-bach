const express = require('express');
const app = express();
const port = 3000;
const generator = require('../src/main');

app.use(express.static('public'));
app.use(express.json());

app.get('/api/generate', (req, res) => {
  const options = req.query;
  console.log("Received generation request:", options);
  try {
    const piece = generator.generatePiece(options);
    res.json(piece);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Bach Generator listening at http://localhost:${port}`);
});
