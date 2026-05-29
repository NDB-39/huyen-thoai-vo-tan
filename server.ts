import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.post("/api/chat", async (req, res) => {
    try {
      const { history, prompt, difficulty } = req.body;

      // Add a system instruction depending on difficulty
      let systemInstruction = "You are a text-based adventure game and interactive storyteller. Respond in the language of the prompt (assume Vietnamese by default). The user is the main character. If the user doesn't interact or types '/next', advance the story smoothly. Drive the plot forward clearly and end with a prompt or situation that the user can react to. Describe scenes vividly.";
      
      if (difficulty === "easy") {
        systemInstruction += " The challenges should be fairly easy and forgiving.";
      } else if (difficulty === "hard") {
        systemInstruction += " The challenges should be quite difficult and punishing. The user's choices have severe consequences.";
      }

      // Convert history objects to GenAI format if needed, but since it's a one-shot simulation we'll just format the prompt. We will simulate chat by just sending the whole text history.
      const conversationContext = history
        .map((entry: any) => `${entry.role === 'user' ? 'Main Character' : 'Storyteller'}: ${entry.text}`)
        .join("\n");

      const fullPrompt = `${conversationContext}\nMain Character: ${prompt}\nStoryteller:`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: fullPrompt,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });

      res.json({ text: response.text });
    } catch (e: any) {
      console.error("Chat generation error:", e);
      res.status(500).json({ error: e.message || "Failed to generate story." });
    }
  });

  app.post("/api/image", async (req, res) => {
    try {
      const { prompt } = req.body;
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: {
          parts: [{ text: prompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: "16:9",
            imageSize: "1K",
          },
        },
      });

      let foundImage = false;
      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData) {
          const base64EncodeString = part.inlineData.data;
          const imageUrl = `data:image/jpeg;base64,${base64EncodeString}`;
          return res.json({ imageUrl });
        }
      }

      if (!foundImage) {
        res.status(500).json({ error: "Failed to generate image." });
      }
    } catch (e: any) {
      console.error("Image generation error:", e);
      res.status(500).json({ error: e.message || "Failed to generate image." });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
