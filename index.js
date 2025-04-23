const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// Health check
app.get('/', (req, res) => {
  res.send('MeetSight Backend Running!');
});

// Webhook endpoint for Meetstream
app.post('/webhook/transcript', (req, res) => {
  const transcriptData = req.body;
  console.log('Received transcript:', transcriptData);
  // TODO: Send this data to OpenAI / Gemini / database
  res.status(200).send('Transcript received!');
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
