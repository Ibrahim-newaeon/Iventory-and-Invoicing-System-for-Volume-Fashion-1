import { Router } from "express";
import passport from "passport";
import { randomBytes, createHash } from "crypto";
import nodemailer from "nodemailer";
import { storage } from "../storage";
import { hashPassword } from "../customAuth";
import { logger } from "../logger";
import { authRateLimit, passwordResetRateLimit } from "../rateLimits";

const router = Router();

// Singleton email transporter
let emailTransporter: nodemailer.Transporter | null = null;

function getEmailTransporter(): nodemailer.Transporter {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error("Email credentials not configured. Set EMAIL_USER and EMAIL_PASS environment variables.");
  }
  if (!emailTransporter) {
    emailTransporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }
  return emailTransporter;
}

router.post("/api/auth/login", authRateLimit, (req, res, next) => {
  passport.authenticate("local", (err: any, user: any, info: any) => {
    if (err) {
      logger.error({ err }, "Login error");
      return res.status(500).json({ message: "Internal server error" });
    }
    if (!user) {
      return res.status(401).json({ message: info?.message || "Invalid username or password" });
    }
    req.logIn(user, (err) => {
      if (err) {
        logger.error({ err }, "Session error");
        return res.status(500).json({ message: "Failed to create session" });
      }
      res.json({
        message: "Login successful",
        user: { id: user.id, username: user.username, role: user.role },
      });
    });
  })(req, res, next);
});

router.post("/api/auth/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      logger.error({ err }, "Logout error");
      return res.status(500).json({ message: "Failed to logout" });
    }
    res.json({ message: "Logout successful" });
  });
});

router.post("/api/auth/password/forgot", passwordResetRateLimit, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Always return success to prevent user enumeration
    const genericMessage = "If an account with that email exists, you will receive a password reset link.";

    const user = await storage.getUserByEmail(email);
    if (user) {
      const token = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(token).digest("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await storage.createPasswordResetToken(user.id, tokenHash, expiresAt);

      try {
        const transporter = getEmailTransporter();
        const appUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
        const resetLink = `${appUrl}/reset-password?token=${token}`;

        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: email,
          subject: "Volume Fashion - Password Reset Request",
          html: `
            <h2>Password Reset Request</h2>
            <p>You requested a password reset for your Volume Fashion account.</p>
            <p>Click the link below to reset your password:</p>
            <p><a href="${resetLink}" style="color: #007bff; text-decoration: none;">Reset Password</a></p>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request this, please ignore this email.</p>
            <p>Best regards,<br>Volume Fashion Team</p>
          `,
        });
      } catch (emailError) {
        logger.error({ err: emailError }, "Failed to send password reset email");
      }
    }

    res.json({ message: genericMessage });
  } catch (error) {
    logger.error({ err: error }, "Password reset request error");
    res.status(500).json({ message: "Failed to process request" });
  }
});

router.post("/api/auth/password/validate", async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: "Token is required" });
    }

    const tokenHash = createHash("sha256").update(token).digest("hex");
    const resetToken = await storage.findValidPasswordResetTokenByHash(tokenHash);

    res.json({ valid: !!resetToken });
  } catch (error) {
    logger.error({ err: error }, "Token validation error");
    res.status(500).json({ message: "Failed to validate token" });
  }
});

router.post("/api/auth/password/reset", async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ message: "Token and new password are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long" });
    }

    const tokenHash = createHash("sha256").update(token).digest("hex");
    const resetToken = await storage.findValidPasswordResetTokenByHash(tokenHash);

    if (!resetToken) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    const hashedPassword = await hashPassword(newPassword);
    await storage.updateUserPassword(resetToken.userId, hashedPassword);
    await storage.markPasswordResetTokenUsed(resetToken.id);

    res.json({ message: "Password reset successful" });
  } catch (error) {
    logger.error({ err: error }, "Password reset error");
    res.status(500).json({ message: "Failed to reset password" });
  }
});

router.get("/api/auth/user", (req: any, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  // Exclude password from response
  const { password, ...userWithoutPassword } = req.user;
  res.json(userWithoutPassword);
});

export { getEmailTransporter };
export default router;
