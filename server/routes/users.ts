import { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated, hashPassword } from "../customAuth";
import { logger } from "../logger";

const router = Router();

const VALID_ROLES = ["Admin", "Manager", "Staff", "Viewer"];

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

// GET /api/users
router.get("/api/users", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const currentUser = await storage.getUser(userId);

    if (currentUser?.role !== "Admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    // getAllUsers already excludes password hashes
    const users = await storage.getAllUsers();
    res.json(users);
  } catch (error) {
    logger.error({ err: error }, "Error fetching users");
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

// PUT /api/users/:id/role
router.put("/api/users/:id/role", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const currentUser = await storage.getUser(userId);

    if (currentUser?.role !== "Admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    const { role } = req.body;

    // Validate role value
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ message: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}` });
    }

    const user = await storage.updateUserRole(req.params.id, role);

    await logActivity(req, `Updated user ${user?.email} role to ${role}`, "Users", user?.id || undefined, user?.email || undefined);

    res.json(user);
  } catch (error) {
    logger.error({ err: error }, "Error updating user role");
    res.status(500).json({ message: "Failed to update user role" });
  }
});

// PUT /api/users/:id/status
router.put("/api/users/:id/status", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const currentUser = await storage.getUser(userId);

    if (currentUser?.role !== "Admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    // Prevent admin from deactivating themselves
    if (req.params.id === userId && req.body.isActive === false) {
      return res.status(400).json({ message: "Cannot deactivate your own account" });
    }

    const { isActive } = req.body;
    const user = await storage.updateUserStatus(req.params.id, isActive);

    await logActivity(req, `${isActive ? "Activated" : "Deactivated"} user ${user?.email}`, "Users", user?.id || undefined, user?.email || undefined);

    res.json(user);
  } catch (error) {
    logger.error({ err: error }, "Error updating user status");
    res.status(500).json({ message: "Failed to update user status" });
  }
});

// POST /api/users
router.post("/api/users", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const currentUser = await storage.getUser(userId);

    if (currentUser?.role !== "Admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    const { email, firstName, lastName, role, username, password } = req.body;

    // Validate email format
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    // Validate role
    if (role && !VALID_ROLES.includes(role)) {
      return res.status(400).json({ message: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}` });
    }

    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }

    // Hash password before storing
    const hashedPassword = await hashPassword(password);

    const user = await storage.upsertUser({
      username: username || email,
      password: hashedPassword,
      email,
      firstName,
      lastName,
      role: role || "Viewer",
      isActive: true,
    });

    await logActivity(req, `Created user account for ${email}`, "Users", user.id, email);

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    res.status(201).json(userWithoutPassword);
  } catch (error) {
    logger.error({ err: error }, "Error creating user");
    res.status(500).json({ message: "Failed to create user" });
  }
});

// PUT /api/users/:id (update user details)
router.put("/api/users/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const currentUser = await storage.getUser(userId);

    if (currentUser?.role !== "Admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    const { firstName, lastName, email } = req.body;

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    const updateData: any = {};
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (email !== undefined) updateData.email = email;

    const user = await storage.updateUser(req.params.id, updateData);

    await logActivity(req, `Updated user ${user?.email} details`, "Users", user?.id || undefined, user?.email || undefined);

    if (user) {
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    logger.error({ err: error }, "Error updating user");
    res.status(500).json({ message: "Failed to update user" });
  }
});

// PUT /api/users/:id/password (admin password reset)
router.put("/api/users/:id/password", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const currentUser = await storage.getUser(userId);

    if (currentUser?.role !== "Admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long" });
    }

    const hashedPassword = await hashPassword(password);
    await storage.updateUserPassword(req.params.id, hashedPassword);

    const user = await storage.getUser(req.params.id);
    await logActivity(req, `Reset password for user ${user?.email}`, "Users", req.params.id, user?.email || undefined);

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    logger.error({ err: error }, "Error resetting user password");
    res.status(500).json({ message: "Failed to reset password" });
  }
});

export default router;
