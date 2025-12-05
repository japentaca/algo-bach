const express = require('express');
const path = require('path');
const app = express();
const port = 3000;
const generator = require('../src/main');

app.use(express.json());

// API routes BEFORE static middleware
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

// Static files after API routes
app.use(express.static(path.join(__dirname, '../public')));

app.listen(port, () => {
  console.log(`Bach Generator listening at http://localhost:${port}`);
  console.log(`Open http://localhost:${port} in your browser`);
  console.log(`API: http://localhost:${port}/api/generate?form=Chorale&mode=major&key=C&duration=2`);
});
