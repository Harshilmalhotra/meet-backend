require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const WebSocket = require("ws");
const axios = require("axios");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const PORT = 4000;

app.use(cors());
app.use(bodyParser.json());

const server = app.listen(PORT, () => {
  console.log(`🚀 MeetSight backend running at http://localhost:${PORT}`);
});

const wss = new WebSocket.Server({ server });
let connectedClients = [];

wss.on("connection", (ws) => {
  console.log("🔌 WebSocket client connected");
  connectedClients.push(ws);
  ws.on("close", () => {
    connectedClients = connectedClients.filter(client => client !== ws);
    console.log("❌ WebSocket client disconnected");
  });
});

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

async function analyzeTranscript(text) {
  const prompt = `
  You are an assistant that listens to meeting transcripts. If a message contains a task assignment, extract:
  - assignee name
  - task description
  - deadline (in natural language)

  Format response as JSON:
  {
    "assignee": "...",
    "task": "...",
    "due": "..."
  }

  If no task, just respond: null

  Transcript: "${text}"
  `;

  try {
    const response = await axios.post(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + process.env.GEMINI_API_KEY,
      {
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
      },
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    const result = response.data;
    const taskInfo = result?.candidates?.[0]?.content;

    if (taskInfo) {
      return {
        assignee: taskInfo.assignee || "Unknown",
        task: taskInfo.task || "No task description",
        due: taskInfo.due || "No deadline",
      };
    }

    return null; // No task found
  } catch (error) {
    console.error("Error in Gemini API:", error.message);
    return null;
  }
}

app.post("/transcripts", async (req, res) => {
  const payload = req.body;
  const speaker = payload?.speaker || "Unknown";
  const text = payload?.transcript || payload?.text || "No text";

  const message = JSON.stringify({ speaker, text });

  // Send live transcription to connected WebSocket clients
  connectedClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });

  // Process transcription with Gemini
  const taskInfo = await analyzeTranscript(text);

  if (taskInfo) {
    console.log("📋 Detected Task:", taskInfo);
    // Send task information to WebSocket clients as well
    connectedClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ taskInfo }));
      }
    });
  }

  res.status(200).json({ status: "received" });
});
