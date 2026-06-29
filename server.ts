import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());
const PORT = 3000;

// Helper to get Gemini AI Client dynamically (allows client-supplied API key)
function getAIClient(req: express.Request): GoogleGenAI {
  const customKey = req.headers['x-gemini-api-key'];
  const key = (typeof customKey === 'string' && customKey.trim()) ? customKey.trim() : process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("No Gemini API key found. Please configure the GEMINI_API_KEY in the workspace Settings, or enter your personal key in the dashboard API Key panel.");
  }
  return new GoogleGenAI({ 
    apiKey: key,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
  });
}

// ---------------------------------------------------------------------------
// 1. Orchestrator + Decomposer Agent (Task Breakdown)
// ---------------------------------------------------------------------------
app.post("/api/agents/decompose", async (req, res) => {
  const { title, description, deadline, preferences } = req.body;
  
  try {
    const aiInstance = getAIClient(req);
    const prompt = `Break down this task into 3-7 actionable subtasks with time estimates.
Task: ${title}
Description: ${description || 'N/A'}
Deadline: ${deadline}
User Context: ${JSON.stringify(preferences || {})}`;

    const response = await aiInstance.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are the NEXUS Decomposer Agent. Break tasks into practical, time-boxed subtasks. Also compute priority scores based on urgency (0-10), impact (0-10), effort (0-10). Provide the output in JSON.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            subtasks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  estimatedMinutes: { type: Type.NUMBER }
                },
                required: ["title", "estimatedMinutes"]
              }
            },
            urgency: { type: Type.NUMBER },
            impact: { type: Type.NUMBER },
            effort: { type: Type.NUMBER }
          },
          required: ["subtasks", "urgency", "impact", "effort"]
        }
      }
    });

    res.json(JSON.parse(response.text || '{}'));
  } catch (error: any) {
    console.error("Decomposer error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------------------------------------
// 2. Scheduler Agent (Focus Blocks)
// ---------------------------------------------------------------------------
app.post("/api/agents/schedule", async (req, res) => {
  const { task, subtasks, preferences, existingEvents } = req.body;
  
  try {
    const aiInstance = getAIClient(req);
    const prompt = `Propose Focus Blocks (calendar slots) to complete these subtasks before the deadline.
Deadline: ${task.deadline}
Subtasks: ${JSON.stringify(subtasks)}
User Preferences (Peak hours, DND): ${JSON.stringify(preferences)}
Existing Events: ${JSON.stringify(existingEvents || [])}`;

    const response = await aiInstance.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are the NEXUS Scheduler Agent. Propose calendar blocks avoiding existing events and respecting user preferences. Output JSON.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              subtaskId: { type: Type.STRING, description: "Match the subtask index/title if id missing" },
              start: { type: Type.STRING, description: "ISO 8601 string" },
              end: { type: Type.STRING, description: "ISO 8601 string" }
            },
            required: ["start", "end"]
          }
        }
      }
    });

    res.json(JSON.parse(response.text || '[]'));
  } catch (error: any) {
    console.error("Scheduler error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------------------------------------
// 3. Voice Parsing (NEXUS Voice Agent)
// ---------------------------------------------------------------------------
app.post("/api/agents/voice", async (req, res) => {
  const { transcript } = req.body;
  
  try {
    const aiInstance = getAIClient(req);
    const response = await aiInstance.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Parse this voice command into a task: "${transcript}"\nCurrent Time: ${new Date().toISOString()}`,
      config: {
        systemInstruction: "You extract task name, deadline, and priority from natural language voice commands. Output JSON.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            deadline: { type: Type.STRING, description: "ISO 8601 date, inferred if possible" },
            priorityScore: { type: Type.NUMBER }
          }
        }
      }
    });
    res.json(JSON.parse(response.text || '{}'));
  } catch (error: any) {
    console.error("Voice parsing error:", error);
    res.status(500).json({ error: error.message });
  }
});


// ---------------------------------------------------------------------------
// 4. Nudge Agent (Context-Aware Notifications)
// ---------------------------------------------------------------------------
app.post("/api/agents/nudge", async (req, res) => {
  const { task, userState } = req.body;
  try {
    const aiInstance = getAIClient(req);
    const response = await aiInstance.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Task: ${JSON.stringify(task)}\nUser State: ${JSON.stringify(userState)}`,
      config: {
        systemInstruction: "You are the NEXUS Nudge Agent. Generate a context-aware nudge message (max 2 sentences) and a suggested micro-action.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            message: { type: Type.STRING },
            suggestedAction: { type: Type.STRING }
          }
        }
      }
    });
    res.json(JSON.parse(response.text || '{}'));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------------------------------------
// 5. Execution Agent (Calendar/Email Automations)
// ---------------------------------------------------------------------------
app.post("/api/agents/execute", async (req, res) => {
  const { actionType, details } = req.body;
  try {
    const aiInstance = getAIClient(req);
    const response = await aiInstance.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Action: ${actionType}\nDetails: ${JSON.stringify(details)}`,
      config: {
        systemInstruction: "You are the NEXUS Execution Agent. Draft an email or calendar event description based on the request.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            status: { type: Type.STRING },
            generatedContent: { type: Type.STRING }
          }
        }
      }
    });
    res.json(JSON.parse(response.text || '{}'));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------------------------------------
// 6. Reflection Agent (Insights & Analytics)
// ---------------------------------------------------------------------------
app.post("/api/agents/reflect", async (req, res) => {
  const { completedTasks } = req.body;
  try {
    const aiInstance = getAIClient(req);
    const response = await aiInstance.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Completed Tasks: ${JSON.stringify(completedTasks)}`,
      config: {
        systemInstruction: "You are the NEXUS Reflection Agent. Analyze the completed tasks and provide 3 actionable insights on the user's productivity patterns.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            insights: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          }
        }
      }
    });
    res.json(JSON.parse(response.text || '{}'));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------------------------------------
// 7. Auto-Orchestrator (Global Re-Prioritization & Planning)
// ---------------------------------------------------------------------------
app.post("/api/agents/reprioritize", async (req, res) => {
  const { tasks } = req.body;
  if (!tasks || !Array.isArray(tasks)) {
    return res.status(400).json({ error: "Invalid tasks array provided." });
  }

  try {
    const aiInstance = getAIClient(req);
    const response = await aiInstance.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Current tasks: ${JSON.stringify(tasks)}\nCurrent Time: ${new Date().toISOString()}`,
      config: {
        systemInstruction: "You are the NEXUS Orchestrator Agent. You analyze the list of tasks. For each task, calculate/re-evaluate its priority score (1.0 to 10.0 scale, where 10 is highest), urgency, impact, and effort. If a task has no subtasks (is empty or length is 0) and is pending/in-progress, generate 3 to 5 clear, sequential, and highly actionable subtasks (each with a unique id, title, estimatedMinutes, and completed: false). Provide a short overall focus plan under globalPlanInsight.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tasks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  priorityScore: { type: Type.NUMBER },
                  urgency: { type: Type.NUMBER },
                  impact: { type: Type.NUMBER },
                  effort: { type: Type.NUMBER },
                  subtasks: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        title: { type: Type.STRING },
                        estimatedMinutes: { type: Type.NUMBER },
                        completed: { type: Type.BOOLEAN }
                      }
                    }
                  }
                },
                required: ["id", "priorityScore", "urgency", "impact", "effort"]
              }
            },
            globalPlanInsight: { type: Type.STRING }
          },
          required: ["tasks", "globalPlanInsight"]
        }
      }
    });

    res.json(JSON.parse(response.text || '{}'));
  } catch (error: any) {
    console.error("Reprioritization API error:", error);
    const msg = error.message || String(error);
    const isPermissionError = msg.includes("denied access") || msg.includes("403") || msg.includes("PERMISSION_DENIED");
    res.status(isPermissionError ? 403 : 500).json({ 
      error: isPermissionError ? "PERMISSION_DENIED" : "API_ERROR", 
      message: error.message || "Failed to reprioritize tasks." 
    });
  }
});

// ---------------------------------------------------------------------------
// Vite Middleware
// ---------------------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
