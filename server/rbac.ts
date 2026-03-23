import type { RequestHandler } from "express";

type Role = "Admin" | "Manager" | "Staff" | "Viewer";

/**
 * RBAC middleware factory. Returns middleware that checks if the
 * authenticated user has one of the allowed roles.
 */
export function requireRole(...allowedRoles: Role[]): RequestHandler {
  return (req: any, res, next) => {
    const userRole = req.user?.role as Role | undefined;
    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    next();
  };
}
