import { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../customAuth";
import { requireRole } from "../rbac";
import { logger } from "../logger";

const router = Router();

// Activity logs
router.get("/api/activity-logs", isAuthenticated, requireRole("Admin", "Manager"), async (req, res) => {
  try {
    const { page = "1", limit = "50", userId, module, startDate, endDate } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const result = await storage.getActivityLogs({
      limit: parseInt(limit as string),
      offset,
      userId: userId as string,
      module: module as string,
      startDate: startDate as string,
      endDate: endDate as string,
    });

    res.json(result);
  } catch (error) {
    logger.error({ err: error }, "Error fetching activity logs");
    res.status(500).json({ message: "Failed to fetch activity logs" });
  }
});

export default router;
