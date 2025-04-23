require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const WebSocket = require("ws");
const axios = require("axios");

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

async function analyzeTranscript(text) {
  const prompt = `
From the following meeting transcript, extract any task assignment.

Return only a valid JSON object with these fields:
{
  "assignee": "Name or 'unspecified'",
  "task": "Task description",
  "due": "Due date or 'unspecified'"
}

If no task exists, respond with: null

Transcript: "${text}"
  `.trim();

  try {
    const response = await axios.post(
      "https://api.cohere.ai/v1/generate",
      {
        model: "command-r-plus",
        prompt: prompt,
        max_tokens: 100,
        temperature: 0.2,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.COHERE_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const output = response.data.generations[0].text.trim();
    console.log("🧠 Raw Cohere Response:", output);

    const parsed = JSON.parse(output);
    return parsed;
  } catch (error) {
    console.error("❌ Cohere API error:", error.response?.data || error.message);
    return null;
  }
}

async function createJiraTicket(taskInfo) {
  try {
    const { assignee, task, due } = taskInfo;

    const issueData = {
      fields: {
        project: { key: process.env.JIRA_PROJECT_KEY },
        summary: `📋 ${task}`,
        description: {
          type: "doc",
          version: 1,
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: `Assigned to: ${assignee}\nDue: ${due}`
                }
              ]
            }
          ]
        },
        issuetype: { name: "Task" },
      }
    };

    const response = await axios.post(
      `${process.env.JIRA_DOMAIN}/rest/api/3/issue`,
      issueData,
      {
        auth: {
          username: process.env.JIRA_EMAIL,
          password: process.env.JIRA_API_TOKEN
        },
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        }
      }
    );

    console.log("✅ Jira ticket created:", response.data.key);
  } catch (error) {
    console.error("❌ Jira error:", error.response?.data || error.message);
  }
}


app.post("/transcripts", async (req, res) => {
  const payload = req.body;
  const speaker = payload?.speaker || "Unknown";
  const text = payload?.transcript || payload?.text || "No text";

  const transcriptMessage = JSON.stringify({
    type: "transcript",
    data: { speaker, text }
  });

  // ✅ Broadcast live transcript
  connectedClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(transcriptMessage);
    }
  });

  console.log("📢 Sent transcript:", transcriptMessage);

  // 🧠 Analyze the transcript with Cohere
  const taskInfo = await analyzeTranscript(text);

  if (taskInfo) {
    console.log("📋 Detected Task:", taskInfo);

    // Broadcast task
    const taskMessage = JSON.stringify({ type: "task", data: taskInfo });
    connectedClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(taskMessage);
      }
    });

    // Create Jira Ticket
    await createJiraTicket(taskInfo);
  }

  res.status(200).json({ status: "received" });
});
