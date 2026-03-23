import type { Express } from "express";
import authRoutes from "./auth";
import productRoutes from "./products";
import invoiceRoutes from "./invoices";
import userRoutes from "./users";
import dashboardRoutes from "./dashboard";
import activityLogRoutes from "./activityLogs";
import customerRoutes from "./customers";
import healthRoutes from "./health";

export function registerAllRoutes(app: Express) {
  app.use(healthRoutes);
  app.use(authRoutes);
  app.use(productRoutes);
  app.use(invoiceRoutes);
  app.use(userRoutes);
  app.use(dashboardRoutes);
  app.use(activityLogRoutes);
  app.use(customerRoutes);
}
