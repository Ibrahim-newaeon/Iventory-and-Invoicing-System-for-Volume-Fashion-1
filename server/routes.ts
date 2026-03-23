import type { Express } from "express";
import { createServer, type Server } from "http";
import express from "express";
import path from "path";
import { setupCustomAuth } from "./customAuth";
import { registerAllRoutes } from "./routes/index";
import { getUploadDir } from "./fileStorage";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupCustomAuth(app);

  // Serve uploaded files with path traversal protection
  app.use("/uploads", (req, res, next) => {
    // Reject path traversal attempts
    if (req.path.includes("..")) {
      return res.status(400).json({ message: "Invalid path" });
    }
    next();
  }, express.static(getUploadDir()));

  // Serve public assets (QR codes, etc.) with path traversal protection
  app.get("/public-objects/:filePath(*)", (req, res) => {
    const filePath = req.params.filePath;

    // Path traversal protection
    if (filePath.includes("..")) {
      return res.status(400).json({ message: "Invalid path" });
    }

    const fullPath = path.join(getUploadDir(), filePath);
    res.sendFile(fullPath, (err) => {
      if (err) {
        res.status(404).json({ error: "File not found" });
      }
    });
  });

  // Register all route modules
  registerAllRoutes(app);

  const httpServer = createServer(app);
  return httpServer;
}
