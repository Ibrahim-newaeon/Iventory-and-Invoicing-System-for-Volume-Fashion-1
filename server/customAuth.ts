import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import bcrypt from "bcrypt";
import type { Express, RequestHandler } from "express";
import { storage } from "./storage";
import type { User } from "@shared/schema";
import { logger } from "./logger";

const scryptAsync = promisify(scrypt);

// Hash password using bcrypt (preferred for new passwords)
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

// Compare passwords using scrypt or bcrypt
export async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  try {
    // Check if it's a bcrypt hash (starts with $2b$ or $2a$)
    if (stored.startsWith('$2b$') || stored.startsWith('$2a$')) {
      return await bcrypt.compare(supplied, stored);
    }

    // Handle legacy scrypt format
    const parts = stored.split(".");
    if (parts.length !== 2) {
      return false;
    }

    const [hashed, salt] = parts;
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    logger.error({ err: error }, "Password comparison error");
    return false;
  }
}

export function getSession() {
  if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET environment variable is required");
  }

  const sessionTtlSeconds = 7 * 24 * 60 * 60; // 1 week in seconds
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: sessionTtlSeconds, // connect-pg-simple expects seconds
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.APP_URL?.startsWith("https://") || false,
      sameSite: "lax",
      maxAge: sessionTtlSeconds * 1000, // express-session cookie expects milliseconds
    },
  });
}

export async function setupCustomAuth(app: Express) {
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  // Configure passport local strategy
  passport.use(
    new LocalStrategy(
      {
        usernameField: "username",
        passwordField: "password",
      },
      async (username, password, done) => {
        try {
          const user = await storage.getUserByUsername(username);
          if (!user) {
            return done(null, false, { message: "Invalid username or password" });
          }

          if (!user.isActive) {
            return done(null, false, { message: "Account is disabled" });
          }

          const isValidPassword = await comparePasswords(password, user.password);
          if (!isValidPassword) {
            return done(null, false, { message: "Invalid username or password" });
          }

          // Update last login time
          await storage.updateUserLastLogin(user.id);

          return done(null, user);
        } catch (error) {
          logger.error({ err: error }, "Authentication error");
          return done(error);
        }
      }
    )
  );

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        return done(null, false);
      }
      if (!user.isActive) {
        return done(null, false);
      }
      done(null, user);
    } catch (error) {
      logger.error({ err: error }, "User deserialization error");
      done(null, false);
    }
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};
