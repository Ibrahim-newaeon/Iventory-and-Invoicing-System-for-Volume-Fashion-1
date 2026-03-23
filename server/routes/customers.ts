import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { isAuthenticated } from "../customAuth";
import { requireRole } from "../rbac";
import { insertCustomerSchema } from "@shared/schema";
import { logger } from "../logger";

const router = Router();

// Activity logging helper
const logActivity = async (req: any, action: string, module: string, targetId?: string, targetName?: string, details?: any) => {
  try {
    const userId = req.user?.id;
    await storage.createActivityLog({
      userId,
      action,
      module,
      targetId,
      targetName,
      details,
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to log activity");
  }
};

// GET /api/customers
router.get("/api/customers", isAuthenticated, async (_req, res) => {
  try {
    const customers = await storage.getAllCustomers();
    res.json(customers);
  } catch (error) {
    logger.error({ err: error }, "Error fetching customers");
    res.status(500).json({ message: "Failed to fetch customers" });
  }
});

// GET /api/customers/search
router.get("/api/customers/search", isAuthenticated, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== "string") {
      return res.json([]);
    }
    const customers = await storage.searchCustomers(q);
    res.json(customers);
  } catch (error) {
    logger.error({ err: error }, "Error searching customers");
    res.status(500).json({ message: "Failed to search customers" });
  }
});

// GET /api/customers/:id
router.get("/api/customers/:id", isAuthenticated, async (req, res) => {
  try {
    const customer = await storage.getCustomer(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }
    res.json(customer);
  } catch (error) {
    logger.error({ err: error }, "Error fetching customer");
    res.status(500).json({ message: "Failed to fetch customer" });
  }
});

// POST /api/customers
router.post("/api/customers", isAuthenticated, requireRole("Admin", "Manager", "Staff"), async (req: any, res) => {
  try {
    const validated = insertCustomerSchema.parse(req.body);
    const customer = await storage.createCustomer(validated);

    await logActivity(req, `Created customer "${customer.name}"`, "Customers", customer.id, customer.name);

    res.status(201).json(customer);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid customer data", errors: error.errors });
    }
    logger.error({ err: error }, "Error creating customer");
    res.status(500).json({ message: "Failed to create customer" });
  }
});

// PUT /api/customers/:id
router.put("/api/customers/:id", isAuthenticated, requireRole("Admin", "Manager", "Staff"), async (req: any, res) => {
  try {
    const updates = insertCustomerSchema.partial().parse(req.body);
    const customer = await storage.updateCustomer(req.params.id, updates);

    await logActivity(req, `Updated customer "${customer.name}"`, "Customers", customer.id, customer.name);

    res.json(customer);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid customer data", errors: error.errors });
    }
    logger.error({ err: error }, "Error updating customer");
    res.status(500).json({ message: "Failed to update customer" });
  }
});

export default router;
