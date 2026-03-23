import { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../customAuth";
import { logger } from "../logger";

const router = Router();

// Dashboard metrics
router.get("/api/dashboard/metrics", isAuthenticated, async (_req, res) => {
  try {
    const metrics = await storage.getDashboardMetrics();
    res.json(metrics);
  } catch (error) {
    logger.error({ err: error }, "Error fetching dashboard metrics");
    res.status(500).json({ message: "Failed to fetch dashboard metrics" });
  }
});

export default router;
