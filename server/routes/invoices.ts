import { Router } from "express";
import { z } from "zod";
import nodemailer from "nodemailer";
import PDFDocument from "pdfkit";
import { storage } from "../storage";
import { isAuthenticated } from "../customAuth";
import { requireRole } from "../rbac";
import { insertInvoiceSchema, insertInvoiceItemSchema, formatCurrency, SUPPORTED_CURRENCIES } from "@shared/schema";
import { logger } from "../logger";
import { messagingRateLimit } from "../rateLimits";
import { getEmailTransporter } from "./auth";

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

// PDF generation with currency support
const generateInvoicePDF = async (invoice: any, items: any[]): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const buffers: Buffer[] = [];
    const currency = invoice.currency || "USD";

    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => {
      const pdfData = Buffer.concat(buffers);
      resolve(pdfData);
    });

    // Header
    doc.fontSize(20).text("INVOICE", 50, 50);
    doc.fontSize(12).text(`Invoice #: ${invoice.invoiceNumber}`, 50, 80);
    doc.text(`Date: ${new Date(invoice.createdAt).toLocaleDateString()}`, 50, 95);
    doc.text(`Currency: ${currency}`, 50, 110);

    // Customer info
    doc.text("Bill To:", 50, 140);
    doc.text(invoice.customerName, 50, 155);
    doc.text(invoice.customerEmail, 50, 170);
    if (invoice.customerPhone) doc.text(invoice.customerPhone, 50, 185);
    if (invoice.customerAddress) doc.text(invoice.customerAddress, 50, 200);

    // Items table header
    const tableTop = 240;
    doc.text("Product", 50, tableTop);
    doc.text("Size", 200, tableTop);
    doc.text("Qty", 300, tableTop);
    doc.text("Price", 380, tableTop);
    doc.text("Total", 480, tableTop);

    // Items
    let yPosition = tableTop + 20;
    items.forEach((item) => {
      doc.text(item.product.productName, 50, yPosition);
      doc.text(item.product.size, 200, yPosition);
      doc.text(item.quantity.toString(), 300, yPosition);
      doc.text(formatCurrency(item.unitPrice, currency), 380, yPosition);
      doc.text(formatCurrency(item.totalPrice, currency), 480, yPosition);
      yPosition += 20;
    });

    // Totals
    yPosition += 20;
    doc.text(`Subtotal: ${formatCurrency(invoice.subtotal, currency)}`, 380, yPosition);

    if (invoice.discountAmount && parseFloat(invoice.discountAmount) > 0) {
      yPosition += 15;
      doc.text(
        `Discount (${(parseFloat(invoice.discountPercentage) * 100).toFixed(1)}%): -${formatCurrency(invoice.discountAmount, currency)}`,
        380,
        yPosition
      );
    }

    yPosition += 15;
    doc.text(
      `Tax (${(parseFloat(invoice.taxRate) * 100).toFixed(1)}%): ${formatCurrency(invoice.taxAmount, currency)}`,
      380,
      yPosition
    );
    yPosition += 15;
    doc.fontSize(14).text(`Total: ${formatCurrency(invoice.total, currency)}`, 380, yPosition);

    if (invoice.notes) {
      yPosition += 40;
      doc.fontSize(12).text("Notes:", 50, yPosition);
      doc.text(invoice.notes, 50, yPosition + 15);
      yPosition += 50;
    } else {
      yPosition += 40;
    }

    // Company footer
    yPosition += 20;
    doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();
    yPosition += 15;

    doc.fontSize(12).text("Volume Fashion Collection", 50, yPosition, { align: "left" });
    yPosition += 20;

    doc.fontSize(9);
    doc.text("Address:", 50, yPosition);
    doc.text("4006-4008 Room, 5th Floor, Changjiang International Garment Building", 50, yPosition + 12);
    doc.text("No.931, Renmingbei Road, Yuexiu District, Guangzhou, China", 50, yPosition + 24);

    doc.text("Contact:", 300, yPosition);
    doc.text("Tel: +86 132 8868 9165", 300, yPosition + 12);
    doc.text("Email: info@volumefashion.com", 300, yPosition + 24);

    yPosition += 50;
    doc.fontSize(10).text("Thank you for your business!", 50, yPosition, { align: "center", width: 500 });

    doc.end();
  });
};

// WhatsApp integration (using Twilio)
const sendWhatsAppMessage = async (to: string, pdfUrl: string, invoiceNumber: string, total: string, currency: string) => {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    throw new Error("Twilio credentials not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables.");
  }

  const twilioNumber = process.env.TWILIO_WHATSAPP_NUMBER || "whatsapp:+14155238886";

  // Dynamic import for Twilio
  const twilio = await import("twilio");
  const client = twilio.default(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

  await client.messages.create({
    body: `Your invoice ${invoiceNumber} is ready! Total: ${formatCurrency(total, currency)}. Download it here: ${pdfUrl}`,
    from: twilioNumber,
    to: `whatsapp:${to}`,
  });
};

// GET /api/invoices
router.get("/api/invoices", isAuthenticated, async (req, res) => {
  try {
    const { page = "1", limit = "20", status, startDate, endDate, customerName } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const result = await storage.getAllInvoices({
      limit: parseInt(limit as string),
      offset,
      status: status as string,
      startDate: startDate as string,
      endDate: endDate as string,
      customerName: customerName as string,
    });

    res.json(result);
  } catch (error) {
    logger.error({ err: error }, "Error fetching invoices");
    res.status(500).json({ message: "Failed to fetch invoices" });
  }
});

// GET /api/invoices/:id
router.get("/api/invoices/:id", isAuthenticated, async (req, res) => {
  try {
    const invoice = await storage.getInvoiceWithItems(req.params.id);
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }
    res.json(invoice);
  } catch (error) {
    logger.error({ err: error }, "Error fetching invoice");
    res.status(500).json({ message: "Failed to fetch invoice" });
  }
});

// POST /api/invoices
router.post("/api/invoices", isAuthenticated, requireRole("Admin", "Manager", "Staff"), async (req: any, res) => {
  try {
    const { invoice: invoiceData, items: itemsData } = req.body;

    const validatedInvoice = insertInvoiceSchema.parse({
      ...invoiceData,
      createdBy: req.user.id,
    });

    const validatedItems = itemsData.map((item: any) => insertInvoiceItemSchema.parse(item));

    const invoice = await storage.createInvoice(validatedInvoice, validatedItems);

    await logActivity(req, `Created invoice ${invoice.invoiceNumber}`, "Invoices", invoice.id, invoice.invoiceNumber);

    res.status(201).json(invoice);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid invoice data", errors: error.errors });
    }
    logger.error({ err: error }, "Error creating invoice");
    res.status(500).json({ message: error instanceof Error ? error.message : "Failed to create invoice" });
  }
});

// PUT /api/invoices/:id/status
router.put("/api/invoices/:id/status", isAuthenticated, requireRole("Admin", "Manager"), async (req: any, res) => {
  try {
    const { status } = req.body;
    const userId = req.user.id;

    const validStatuses = ["Pending", "Processed"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
    }

    const invoice = await storage.updateInvoiceStatus(req.params.id, status, userId);

    await logActivity(req, `Updated invoice ${invoice.invoiceNumber} status to ${status}`, "Invoices", invoice.id, invoice.invoiceNumber);

    res.json(invoice);
  } catch (error) {
    logger.error({ err: error }, "Error updating invoice status");
    res.status(500).json({ message: error instanceof Error ? error.message : "Failed to update invoice status" });
  }
});

// PUT /api/invoices/:id/cancel
router.put("/api/invoices/:id/cancel", isAuthenticated, requireRole("Admin", "Manager"), async (req: any, res) => {
  try {
    const userId = req.user.id;

    const invoice = await storage.cancelInvoice(req.params.id, userId);

    await logActivity(req, `Cancelled invoice ${invoice.invoiceNumber}`, "Invoices", invoice.id, invoice.invoiceNumber);

    res.json(invoice);
  } catch (error) {
    logger.error({ err: error }, "Error cancelling invoice");
    res.status(500).json({ message: error instanceof Error ? error.message : "Failed to cancel invoice" });
  }
});

// PUT /api/invoices/:id/discount
router.put("/api/invoices/:id/discount", isAuthenticated, requireRole("Admin", "Manager"), async (req: any, res) => {
  try {
    const { discountPercentage } = req.body;

    const discountSchema = z.object({
      discountPercentage: z.number().min(0).max(100),
    });

    const { discountPercentage: validatedDiscount } = discountSchema.parse({ discountPercentage });

    const invoice = await storage.updateInvoiceDiscount(req.params.id, validatedDiscount);

    await logActivity(req, `Updated invoice ${invoice.invoiceNumber} discount to ${validatedDiscount}%`, "Invoices", invoice.id, invoice.invoiceNumber);

    res.json(invoice);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid discount percentage", errors: error.errors });
    }
    logger.error({ err: error }, "Error updating invoice discount");
    res.status(500).json({ message: error instanceof Error ? error.message : "Failed to update invoice discount" });
  }
});

// POST /api/invoices/:id/pdf
router.post("/api/invoices/:id/pdf", isAuthenticated, async (req: any, res) => {
  try {
    const invoice = await storage.getInvoiceWithItems(req.params.id);
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    if (invoice.status !== "Processed") {
      return res.status(400).json({ message: "Can only generate PDF for processed invoices" });
    }

    const pdfBuffer = await generateInvoicePDF(invoice, invoice.items);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`,
      "Content-Length": pdfBuffer.length,
    });

    res.send(pdfBuffer);
  } catch (error) {
    logger.error({ err: error }, "Error generating PDF");
    res.status(500).json({ message: "Failed to generate PDF" });
  }
});

// POST /api/invoices/:id/email
router.post("/api/invoices/:id/email", isAuthenticated, requireRole("Admin", "Manager"), messagingRateLimit, async (req: any, res) => {
  try {
    const invoice = await storage.getInvoiceWithItems(req.params.id);
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    if (invoice.status !== "Processed") {
      return res.status(400).json({ message: "Can only email processed invoices" });
    }

    if (!invoice.customerEmail) {
      return res.status(400).json({ message: "Customer email is required to send invoice" });
    }

    const pdfBuffer = await generateInvoicePDF(invoice, invoice.items);
    const currency = invoice.currency || "USD";
    const transporter = getEmailTransporter();

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: invoice.customerEmail,
      subject: `Invoice ${invoice.invoiceNumber} - Volume Fashion`,
      html: `
        <h2>Your Invoice is Ready</h2>
        <p>Dear ${invoice.customerName},</p>
        <p>Please find your invoice ${invoice.invoiceNumber} attached.</p>
        <p>Total Amount: ${formatCurrency(invoice.total, currency)}</p>
        <p>Thank you for your business!</p>
        <p>Best regards,<br>Volume Fashion Team</p>
      `,
      attachments: [
        {
          filename: `invoice-${invoice.invoiceNumber}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });

    await logActivity(req, `Sent invoice ${invoice.invoiceNumber} via email to ${invoice.customerEmail}`, "Invoices", invoice.id, invoice.invoiceNumber);

    res.json({ message: "Email sent successfully" });
  } catch (error) {
    logger.error({ err: error }, "Error sending email");
    res.status(500).json({ message: error instanceof Error ? error.message : "Failed to send email" });
  }
});

// POST /api/invoices/:id/whatsapp
router.post("/api/invoices/:id/whatsapp", isAuthenticated, requireRole("Admin", "Manager"), messagingRateLimit, async (req: any, res) => {
  try {
    const invoice = await storage.getInvoiceWithItems(req.params.id);
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    if (invoice.status !== "Processed") {
      return res.status(400).json({ message: "Can only send processed invoices via WhatsApp" });
    }

    if (!invoice.customerPhone) {
      return res.status(400).json({ message: "Customer phone number is required for WhatsApp" });
    }

    const appUrl = process.env.APP_URL || "http://localhost:5000";
    const pdfUrl = `${appUrl}/api/invoices/${invoice.id}/pdf`;
    const currency = invoice.currency || "USD";

    await sendWhatsAppMessage(invoice.customerPhone, pdfUrl, invoice.invoiceNumber, invoice.total, currency);

    await logActivity(req, `Sent invoice ${invoice.invoiceNumber} via WhatsApp to ${invoice.customerPhone}`, "Invoices", invoice.id, invoice.invoiceNumber);

    res.json({ message: "WhatsApp message sent successfully" });
  } catch (error) {
    logger.error({ err: error }, "Error sending WhatsApp");
    res.status(500).json({ message: error instanceof Error ? error.message : "Failed to send WhatsApp message" });
  }
});

// GET /api/currencies
router.get("/api/currencies", isAuthenticated, (_req, res) => {
  res.json(SUPPORTED_CURRENCIES);
});

export default router;
