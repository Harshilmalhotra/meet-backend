const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
const PORT = 4000;

// Middleware
app.use(cors()); // Allow all origins, can be customized for specific origins
app.use(bodyParser.json()); // Parse incoming JSON data

// Webhook endpoint to receive real-time transcription data
app.post("/transcripts", (req, res) => {
  const payload = req.body;

  // Log the transcription data received
  console.log("📥 Transcript received:\n", JSON.stringify(payload, null, 2));

  // Here you can process the data, store it, or send it to the frontend

  // Send a response back to Meetstream to acknowledge the receipt
  res.status(200).json({ status: "received" });
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 MeetSight backend running at http://localhost:${PORT}`);
});
