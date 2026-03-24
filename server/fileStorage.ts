import fs from "fs";
import path from "path";
import { logger } from "./logger";

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || "./uploads");

const ALLOWED_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);

// Resolve a file path safely within UPLOAD_DIR, preventing path traversal
function safePath(relativePath: string): string {
  const resolved = path.resolve(UPLOAD_DIR, relativePath);
  if (!resolved.startsWith(UPLOAD_DIR + path.sep) && resolved !== UPLOAD_DIR) {
    throw new Error("Path traversal detected");
  }
  return resolved;
}

// Ensure upload directories exist
function ensureDirectories() {
  const dirs = [
    UPLOAD_DIR,
    path.join(UPLOAD_DIR, "images"),
    path.join(UPLOAD_DIR, "qr-codes"),
    path.join(UPLOAD_DIR, "pdfs"),
  ];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

ensureDirectories();

export async function saveFile(
  subDir: string,
  fileName: string,
  data: Buffer
): Promise<string> {
  const dirPath = safePath(subDir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  const filePath = safePath(path.join(subDir, fileName));
  await fs.promises.writeFile(filePath, data);
  // Return URL path for serving
  return `/uploads/${subDir}/${fileName}`;
}

export async function readFile(filePath: string): Promise<Buffer> {
  const fullPath = safePath(filePath);
  return fs.promises.readFile(fullPath);
}

export async function fileExists(filePath: string): Promise<boolean> {
  const fullPath = safePath(filePath);
  try {
    await fs.promises.access(fullPath);
    return true;
  } catch {
    return false;
  }
}

export async function deleteFile(filePath: string): Promise<void> {
  const fullPath = safePath(filePath);
  try {
    await fs.promises.unlink(fullPath);
  } catch (error) {
    logger.warn({ err: error, filePath }, "Failed to delete file");
  }
}

export function getUploadDir(): string {
  return UPLOAD_DIR;
}

export async function saveQRCode(productId: string, buffer: Buffer): Promise<string> {
  return saveFile("qr-codes", `${productId}.png`, buffer);
}

export async function saveProductImage(productId: string, buffer: Buffer, extension: string = "png", index?: number): Promise<string> {
  const ext = extension.toLowerCase().replace(/^\./, "");
  if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
    throw new Error(`File extension not allowed: ${extension}. Allowed: ${Array.from(ALLOWED_IMAGE_EXTENSIONS).join(", ")}`);
  }
  const fileName = index != null ? `${productId}_${index}.${ext}` : `${productId}.${ext}`;
  return saveFile("images", fileName, buffer);
}
