# Project Report: Inventory & Invoicing System for Volume Fashion

**Date:** March 23, 2026
**Version:** 1.0.0
**Status:** Production-Ready

---

## 1. Executive Summary

The **Volume Fashion Inventory & Invoicing System** is a full-stack web application built to manage product inventory, generate invoices, track customers, and provide business analytics for Volume Fashion. The system has undergone a comprehensive production-readiness overhaul covering security hardening, data integrity improvements, feature completion, and infrastructure modernization.

**Key Metrics:**
| Metric | Value |
|--------|-------|
| Total Source Files | 99 |
| Lines of Code | 15,471 |
| API Endpoints | 40 |
| Frontend Pages | 17 |
| UI Components | 47 (shadcn/ui) |
| Database Tables | 10 |
| Production Dependencies | 55 |

---

## 2. Technology Stack

### Frontend
| Technology | Purpose |
|-----------|---------|
| React 18 | UI framework |
| TypeScript 5.6 | Type safety |
| Vite 5 | Build tool & dev server |
| Tailwind CSS 3 | Styling |
| shadcn/ui (Radix UI) | Component library (47 components) |
| React Query (TanStack) | Server state management |
| React Hook Form + Zod | Form handling & validation |
| Recharts | Charts & data visualization |
| Wouter | Client-side routing |
| Framer Motion | Animations |
| Tesseract.js | OCR for barcode text reading |
| @zxing/library | QR code & barcode scanning |

### Backend
| Technology | Purpose |
|-----------|---------|
| Node.js 20 | Runtime |
| Express 4 | HTTP framework |
| TypeScript | Type safety |
| Drizzle ORM | Database ORM |
| PostgreSQL (Neon) | Database |
| Passport.js | Authentication |
| bcrypt | Password hashing |
| Pino | Structured logging |
| Helmet | Security headers |
| PDFKit | PDF invoice generation |
| Nodemailer | Email delivery |
| Twilio | WhatsApp delivery |
| QRCode | QR code generation |
| csv-parse | CSV bulk upload parsing |

### Infrastructure
| Technology | Purpose |
|-----------|---------|
| Docker | Containerization |
| GitHub Actions | CI/CD pipeline |
| Local filesystem | File storage (S3/GCS optional) |

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────┐
│                   Client (React)                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │  Pages   │ │Components│ │  React Query      │ │
│  │  (17)    │ │  (53)    │ │  (Server State)   │ │
│  └──────────┘ └──────────┘ └──────────────────┘ │
└──────────────────────┬──────────────────────────┘
                       │ HTTP/REST
┌──────────────────────┴──────────────────────────┐
│               Server (Express)                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │  Routes  │ │   Auth   │ │   Middleware      │ │
│  │  (9 mod) │ │(Passport)│ │(Helmet,CORS,Rate)│ │
│  └──────────┘ └──────────┘ └──────────────────┘ │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │ Storage  │ │  Logger  │ │  File Storage    │ │
│  │(Drizzle) │ │  (Pino)  │ │  (Local/S3/GCS)  │ │
│  └──────────┘ └──────────┘ └──────────────────┘ │
└──────────────────────┬──────────────────────────┘
                       │ SQL
┌──────────────────────┴──────────────────────────┐
│            PostgreSQL (Neon Serverless)           │
│         10 tables with indexes & relations        │
└──────────────────────────────────────────────────┘
```

---

## 4. Database Schema

| Table | Description | Key Fields |
|-------|-------------|------------|
| `users` | System users | email, password, role, firstName, lastName, isActive |
| `sessions` | User sessions | sid, sess, expire |
| `password_reset_tokens` | Password reset flow | userId, tokenHash, expiresAt |
| `customers` | Customer records | name, email, phone, address |
| `products` | Product inventory | productId, productName, size, color, price, quantity, category, manufacturer |
| `invoices` | Sales invoices | invoiceNumber, customerName, subtotal, taxAmount, discountAmount, total, currency, status |
| `invoice_items` | Invoice line items | invoiceId, productId, quantity, unitPrice, totalPrice |
| `activity_logs` | Audit trail | userId, action, module, targetId, ipAddress |
| `stock_adjustments` | Stock in/out records | productId, quantity, type, reason, adjustedBy |
| `product_changes` | Product edit history | productId, field, oldValue, newValue, changedBy |

**Indexed columns:** productId, category, isActive, status, customerName, createdAt, module, userId, tokenHash

---

## 5. API Endpoints (40 Total)

### Authentication (6 endpoints)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | User login (rate limited: 5/15min) |
| POST | `/api/auth/logout` | User logout |
| GET | `/api/auth/user` | Get current user (excludes password) |
| POST | `/api/auth/password/forgot` | Request password reset (rate limited: 3/hr) |
| POST | `/api/auth/password/validate` | Validate reset token |
| POST | `/api/auth/password/reset` | Reset password with token |

### Products (11 endpoints)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/products` | List products (paginated, filterable) |
| GET | `/api/products/:id` | Get product by ID |
| GET | `/api/products/by-product-id/:productId` | Get product by product ID |
| POST | `/api/products` | Create product |
| POST | `/api/products/bulk` | Bulk create products |
| POST | `/api/products/bulk-upload` | CSV bulk upload |
| PUT | `/api/products/:id` | Update product |
| PUT | `/api/products/:id/image` | Update product image |
| DELETE | `/api/products/:id` | Delete product (soft) |
| POST | `/api/products/:id/adjust-stock` | Adjust stock level |
| GET | `/api/products/:id/adjustments` | Get stock adjustment history |
| GET | `/api/products/:id/changes` | Get product change history |

### Invoices (9 endpoints)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/invoices` | List invoices (paginated, filterable) |
| GET | `/api/invoices/:id` | Get invoice with items |
| POST | `/api/invoices` | Create invoice (validates stock) |
| PUT | `/api/invoices/:id/status` | Update invoice status (deducts stock) |
| PUT | `/api/invoices/:id/cancel` | Cancel invoice (restores stock) |
| PUT | `/api/invoices/:id/discount` | Update invoice discount |
| POST | `/api/invoices/:id/pdf` | Generate PDF |
| POST | `/api/invoices/:id/email` | Send invoice via email |
| POST | `/api/invoices/:id/whatsapp` | Send invoice via WhatsApp |
| GET | `/api/currencies` | List supported currencies |

### Customers (5 endpoints)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/customers` | List all customers |
| GET | `/api/customers/search` | Search customers |
| GET | `/api/customers/:id` | Get customer by ID |
| POST | `/api/customers` | Create customer |
| PUT | `/api/customers/:id` | Update customer |

### Users (4 endpoints)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users` | List users (excludes passwords) |
| POST | `/api/users` | Create user (hashed password) |
| PUT | `/api/users/:id/role` | Update user role |
| PUT | `/api/users/:id/status` | Toggle user active/inactive |

### Other (3 endpoints)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/metrics` | Dashboard analytics |
| GET | `/api/activity-logs` | Activity log listing |
| GET | `/api/health` | Health check with DB status |

---

## 6. Frontend Pages

| Page | Route | Access | Description |
|------|-------|--------|-------------|
| Dashboard | `/` | All roles | KPIs, charts, recent activity |
| Products | `/products` | All roles | Product list with search, filter, edit, delete |
| Product Detail | `/products/:id` | All roles | Full product details with QR code |
| Add Product | `/add-product` | Admin, Manager, Staff | Product creation form |
| Bulk Upload | `/bulk-upload` | Admin, Manager | CSV bulk product upload |
| Invoices | `/invoices` | All roles | Invoice list with status filters |
| Invoice Detail | `/invoices/:id` | All roles | Full invoice with items, discount editing, PDF/email/WhatsApp |
| Create Invoice | `/create-invoice` | Admin, Manager, Staff | Invoice form with product picker, barcode scanner, currency selector |
| Customers | `/customers` | Admin, Manager, Staff | Customer CRUD management |
| Reports | `/reports` | Admin, Manager | Revenue charts, low stock, top products, CSV export |
| User Management | `/users` | Admin only | User creation, role management, status toggle |
| Activity Logs | `/activity-logs` | Admin, Manager | Audit trail timeline with CSV export |
| Login | `/login` | Public | Authentication |
| Forgot Password | `/forgot-password` | Public | Password reset request |
| Reset Password | `/reset-password` | Public | Password reset with token |

---

## 7. Security Features

### Authentication & Authorization
- **Passport.js** local strategy with bcrypt password hashing (cost factor 12)
- **Role-Based Access Control (RBAC):** Admin, Manager, Staff, Viewer
- **Session-based auth** with PostgreSQL session store
- **Secure cookies:** `httpOnly`, `secure` in production, `sameSite: lax`
- **Session secret** required (no fallback) - throws at startup if missing
- **Password reset** flow with hashed tokens and expiry

### API Security
- **Helmet** security headers (X-Frame-Options, HSTS, XSS protection)
- **CORS** with configurable allowed origins
- **Rate limiting:** Global (100 req/min), login (5/15min), password reset (3/hr)
- **Request body limit:** 1MB max payload
- **Path traversal protection** on file serving routes
- **Input validation** with Zod schemas on all endpoints
- **Password hashes excluded** from all API responses
- **Admin self-deactivation prevention**
- **CSV injection prevention** (strips `=`, `+`, `-`, `@` prefixes)

### Data Integrity
- **Database transactions** for invoice processing (stock deduction is atomic)
- **Optimistic locking** on stock deduction (validates quantity >= deduction)
- **Stock validation** before invoice creation (rejects insufficient stock)
- **Stock reversal** on invoice cancellation

---

## 8. Multi-Currency Support

Supported currencies:

| Code | Symbol | Name |
|------|--------|------|
| USD | $ | US Dollar |
| EUR | € | Euro |
| GBP | £ | British Pound |
| AED | AED | UAE Dirham |
| SAR | SAR | Saudi Riyal |
| EGP | EGP | Egyptian Pound |
| CNY | ¥ | Chinese Yuan |
| JOD | JOD | Jordanian Dinar |

Currency is selectable per invoice and persisted in the database. PDF generation, email, and WhatsApp templates all use the invoice's currency.

---

## 9. Key Features

### Inventory Management
- Product CRUD with image upload
- CSV bulk upload with validation and error reporting
- QR code generation per product
- Barcode/QR scanning to add products to invoices
- OCR fallback for text-based barcode reading
- Stock adjustment tracking (in/out with reason)
- Product change history (field-level diffs)
- Low stock alerts

### Invoice Management
- Invoice creation with product picker
- Multi-currency support
- Tax rate and discount configuration
- Invoice status workflow: Pending → Processed → (optional) Cancelled
- Automatic stock deduction on processing
- Automatic stock restoration on cancellation
- PDF generation (PDFKit)
- Email delivery (Nodemailer/Gmail SMTP)
- WhatsApp delivery (Twilio)
- Invoice printing

### Customer Management
- Customer database (name, email, phone, address)
- Search and filter
- Customer linking to invoices

### Reporting & Analytics
- Revenue by month (bar chart)
- Sales summary (total revenue, invoice count, average value)
- Date range filtering
- Low stock products report
- Top products by stock value
- CSV export for all reports

### User Management
- User creation with role assignment
- Role management (Admin, Manager, Staff, Viewer)
- User activation/deactivation
- Password reset via email

### Audit Trail
- Activity logging for all CRUD operations
- Module-based filtering (Products, Invoices, Users, Inventory)
- Date range filtering
- User attribution with IP address
- CSV export

### UI/UX
- Responsive design (mobile + desktop)
- Dark/Light mode toggle with persistence
- Loading skeletons on all data pages
- Global search (navigates to Products)
- Sidebar navigation with role-based visibility

---

## 10. Infrastructure

### Docker
- Multi-stage Dockerfile (build → production)
- Node 20 Alpine base image
- `.dockerignore` configured

### CI/CD
- GitHub Actions workflow on push/PR to main
- Steps: install → type-check → build

### Logging
- Pino structured logger
- Pretty printing in development
- JSON output in production
- Request-level logging

### Configuration
- `.env.example` with full documentation
- Required: `DATABASE_URL`, `SESSION_SECRET`
- Optional: email, Twilio, storage provider, CORS origins
- Environment validation at startup

---

## 11. File Structure

```
├── .env.example                  # Environment variables template
├── .github/workflows/ci.yml     # CI/CD pipeline
├── .dockerignore                 # Docker ignore rules
├── Dockerfile                    # Multi-stage Docker build
├── package.json                  # Dependencies & scripts
├── drizzle.config.ts             # Database migration config
├── vite.config.ts                # Vite build config
├── tsconfig.json                 # TypeScript config
│
├── shared/
│   └── schema.ts                 # Database schema, types, validation, currency config
│
├── server/
│   ├── index.ts                  # App entry (middleware, env validation)
│   ├── customAuth.ts             # Passport auth, session config
│   ├── storage.ts                # Database operations (Drizzle)
│   ├── fileStorage.ts            # Local file storage operations
│   ├── logger.ts                 # Pino logger setup
│   ├── routes.ts                 # Route registration entry point
│   └── routes/
│       ├── index.ts              # Route module registration
│       ├── auth.ts               # Authentication endpoints
│       ├── products.ts           # Product endpoints
│       ├── invoices.ts           # Invoice endpoints
│       ├── customers.ts          # Customer endpoints
│       ├── users.ts              # User management endpoints
│       ├── dashboard.ts          # Dashboard metrics
│       ├── activityLogs.ts       # Activity log endpoints
│       └── health.ts             # Health check endpoint
│
├── client/
│   └── src/
│       ├── App.tsx               # Router & app shell
│       ├── components/
│       │   ├── Layout.tsx        # Page layout wrapper
│       │   ├── Header.tsx        # Top bar (search, theme, logout)
│       │   ├── Sidebar.tsx       # Navigation sidebar
│       │   ├── Footer.tsx        # Footer
│       │   ├── ProtectedRoute.tsx# Auth guard
│       │   └── ui/              # 47 shadcn/ui components
│       ├── pages/
│       │   ├── Dashboard.tsx
│       │   ├── Products.tsx
│       │   ├── ProductDetail.tsx
│       │   ├── AddProduct.tsx
│       │   ├── BulkUpload.tsx
│       │   ├── Invoices.tsx
│       │   ├── InvoiceDetail.tsx
│       │   ├── CreateInvoice.tsx
│       │   ├── Customers.tsx
│       │   ├── Reports.tsx
│       │   ├── UserManagement.tsx
│       │   ├── ActivityLogs.tsx
│       │   ├── LoginPage.tsx
│       │   ├── ForgotPassword.tsx
│       │   └── ResetPassword.tsx
│       ├── hooks/
│       │   ├── useAuth.ts
│       │   └── use-toast.ts
│       └── lib/
│           ├── queryClient.ts
│           ├── authUtils.ts
│           └── utils.ts
```

---

## 12. Deployment Guide

### Prerequisites
- Node.js 20+
- PostgreSQL database (Neon recommended)

### Quick Start
```bash
# 1. Clone and install
git clone <repo-url>
cd volume-fashion
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL and SESSION_SECRET

# 3. Push database schema
npm run db:push

# 4. Build and start
npm run build
npm start
```

### Docker Deployment
```bash
docker build -t volume-fashion .
docker run -p 5000:5000 --env-file .env volume-fashion
```

### Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SESSION_SECRET` | Yes | Random 64+ character secret |
| `APP_URL` | No | Application URL (default: http://localhost:5000) |
| `PORT` | No | Server port (default: 5000) |
| `EMAIL_USER` | No | Gmail address for email delivery |
| `EMAIL_PASS` | No | Gmail app password |
| `TWILIO_ACCOUNT_SID` | No | Twilio SID for WhatsApp |
| `TWILIO_AUTH_TOKEN` | No | Twilio auth token |
| `CORS_ORIGINS` | No | Allowed CORS origins |

---

## 13. Production Readiness Checklist

| Category | Item | Status |
|----------|------|--------|
| **Security** | Helmet security headers | Done |
| | CORS configuration | Done |
| | Rate limiting (login, global) | Done |
| | Session secret validation | Done |
| | Secure cookies (httpOnly, secure, sameSite) | Done |
| | Password hashing (bcrypt) | Done |
| | Input validation (Zod) | Done |
| | Path traversal protection | Done |
| | CSV injection prevention | Done |
| | Credentials removed from UI | Done |
| | Password excluded from API | Done |
| **Data** | Database transactions | Done |
| | Stock validation before invoice | Done |
| | Optimistic locking on stock | Done |
| | Stock reversal on cancellation | Done |
| | Database indexes | Done |
| | Pagination limits enforced | Done |
| **Infrastructure** | Environment validation at startup | Done |
| | Structured logging (Pino) | Done |
| | Health check endpoint | Done |
| | Dockerfile | Done |
| | CI/CD pipeline | Done |
| | .env.example | Done |
| | .gitignore (secrets excluded) | Done |
| | Replit dependencies removed | Done |
| | Route modularization | Done |
| **Features** | Multi-currency support | Done |
| | Invoice cancellation with stock reversal | Done |
| | Customer management | Done |
| | Reports & analytics with CSV export | Done |
| | Activity log CSV export | Done |
| | Dark/Light mode | Done |
| | Mobile responsive layout | Done |
| | Barcode/QR/OCR scanning | Done |
| **Code Quality** | Console.log statements removed (client) | Done |
| | TypeScript strict mode | Done |
| | Production build succeeds | Done |

---

*Report generated on March 23, 2026*
*Volume Fashion Inventory & Invoicing System v1.0.0*
