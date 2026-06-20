# 💊 StockEasy – Cloud-Native Pharmacy Management & POS System

> A full-stack, multi-tenant SaaS platform built to modernize pharmacy operations through intelligent inventory management, real-time analytics, secure role-based access control, and a smart Point of Sale (POS) system powered by FEFO (First-Expire-First-Out) inventory optimization.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js\&logoColor=white)
![React](https://img.shields.io/badge/React-18-blue?logo=react\&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript\&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL_&_Auth-3ECF8E?logo=supabase\&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?logo=tailwind-css\&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-yellow)

---

## 🚀 Summary
**StockEasy** is a production-ready SaaS application designed to solve complex inventory and billing workflows in the medical retail sector. Engineered with a multi-tenant PostgreSQL architecture, it features **Row Level Security (RLS)** for strict data isolation, an algorithmic **FEFO recommendation engine** to minimize financial losses from expired inventory, and **Optimistic UI** updates for zero-latency user experiences.

---

## 🌐 Live Demo
* **Live Application:** [https://stockeasy.vercel.app](https://stockeasy.vercel.app) *(Replace with your actual link)*
* **Demo Video / Walkthrough:** [YouTube Link Here] *(Optional)*
  
---

## 📌Highlights

* Developed a full-stack SaaS Pharmacy Management System using Next.js, TypeScript, Supabase, and PostgreSQL.
* Designed and implemented a multi-tenant architecture with secure tenant isolation using PostgreSQL Row Level Security (RLS).
* Built an intelligent FEFO (First-Expire-First-Out) inventory recommendation engine to reduce medicine expiry losses.
* Developed a real-time analytics dashboard using Supabase Realtime subscriptions.
* Implemented secure role-based access control supporting Superadmin, Owner, and Staff workflows.
* Built a dynamic POS system with automated billing, invoice generation, and inventory synchronization.
* Deployed a cloud-native architecture optimized for Vercel and Supabase.

---

## 📑 Table of Contents

* Overview
* Why This Project?
* Business Problem
* Solution Approach
* Key Features
* Technical Highlights
* System Architecture
* Tech Stack
* Database Schema
* Project Structure
* Security & Compliance
* Performance Optimizations
* Installation
* Environment Variables
* Usage Guide
* Deployment
* API Documentation
* Screenshots
* Engineering Challenges
* Product Roadmap
* Future Enhancements
* Contributing
* License
* Author

---

# 📖 Overview

StockEasy is a modern Pharmacy Management Platform designed to replace traditional desktop-based pharmacy software with a scalable cloud-native solution.

The application enables pharmacy owners and staff to manage inventory, track medicine batches, monitor expiry dates, process customer purchases, generate invoices, and analyze business performance through real-time dashboards.

The platform also includes a dedicated Superadmin environment for platform administration, tenant support management, and operational oversight.

---

## 🎓 Why This Project?
The medical retail sector is plagued by fragmented, offline legacy software that fails to prevent one of the industry's biggest profit drains: **medicine expiration**. 

I built StockEasy to solve this exact problem by bringing pharmacy operations to the cloud. I wanted to engineer a system that didn't just *record* data, but actively helped users make smarter decisions. Building this project allowed me to tackle complex engineering challenges like multi-tenant database architecture, secure authentication flows (PKCE), algorithmic sorting, and real-time state synchronization.

## 📈 Project Outcomes
* **Reduced Expiry Waste:** The FEFO engine proactively identifies aging batches, significantly reducing dead-stock financial losses.
* **Faster Checkout Speeds:** Sub-second cart calculations (subtotals, percentage discounts, rounding) combined with brand/generic composition search speeds up POS throughput.
* **Zero-Latency Administration:** Implemented Optimistic UI for support ticketing, eliminating 10-15 second API wait times for Superadmins.
* **Centralized Security:** Successfully implemented a 3-tier Role-Based Access Control (RBAC) system securing distinct workflows for Superadmins, Owners, and Staff.

---

# 💼 Business Problem

Pharmacies commonly face operational challenges such as:

* Medicine expiry losses due to poor stock rotation.
* Lack of visibility into batch-level inventory.
* Manual billing errors.
* Limited reporting and analytics.
* Legacy desktop software with no cloud synchronization.
* Difficulty managing multiple staff roles securely.

These issues directly affect profitability, inventory utilization, and operational efficiency.

---

# 🎯 Solution Approach

StockEasy solves these problems through:

* Intelligent FEFO inventory recommendations.
* Cloud-based inventory synchronization.
* Real-time dashboard analytics.
* Automated billing and invoice generation.
* Secure role-based access control.
* Multi-tenant SaaS architecture.
* Integrated support helpdesk.

Each pharmacy operates as an isolated tenant while sharing the same platform infrastructure.

```text
Organization
      │
      ▼
 Pharmacy (Tenant)
      │
 ┌────┼────┐
 ▼    ▼    ▼
Owner Staff Inventory
```

---

# ✨ Key Features

## 🛒 Smart Point of Sale (POS)

* Search medicines by brand name or generic composition.
* FEFO-powered stock recommendations.
* Real-time subtotal and discount calculations.
* Automatic round-off handling.
* Professional invoice generation.
* Original and duplicate cash memo printing.

---

## 📦 Inventory Management

* Batch-wise inventory tracking.
* Expiry date management.
* MRP and purchase cost tracking.
* Quantity adjustments.
* Low-stock monitoring.
* Inventory valuation calculations.

---

## ⏳ FEFO Inventory Optimization

StockEasy implements a First-Expire-First-Out inventory strategy.

Benefits:

* Reduces medicine wastage.
* Minimizes expiry losses.
* Improves stock turnover.
* Encourages efficient inventory utilization.

The system automatically identifies and prioritizes medicines with the nearest expiration date.

---

## 📊 Real-Time Analytics Dashboard

Monitor business health using:

* Today's Sales
* Total Revenue
* Inventory Value
* Low Stock Count
* Near Expiry Medicines
* Expired Medicines
* Weekly Sales Trends

Realtime synchronization ensures dashboards remain updated without manual refreshes.

---

## 🧾 Billing & Invoice Management

* Printable cash memos.
* Duplicate invoice generation.
* Historical bill lookup.
* Transaction audit trail.
* CSV export functionality.

---

## 🔐 Authentication & RBAC

Supported roles:

### Superadmin

* Tenant management
* Support ticket management
* Platform oversight

### Owner

* Inventory management
* Staff management
* Financial reporting
* Business configuration

### Staff

* Point of Sale operations
* Inventory search
* Limited operational access

---

## 🎫 Integrated Support Helpdesk

* Ticket creation
* Ticket tracking
* Admin replies
* Resolution workflows
* Automated communication management

---

# 🚀 Technical Highlights

StockEasy was designed as a production-oriented SaaS application rather than a simple CRUD project.

### Engineering Highlights

* Multi-Tenant SaaS Architecture
* PostgreSQL Row Level Security (RLS)
* FEFO Inventory Recommendation Engine
* Realtime Dashboard Synchronization
* Secure PKCE Authentication Flow
* Optimistic UI Updates
* Dynamic Invoice Generation
* Role-Based Access Control
* Cloud-Native Deployment Architecture
* Responsive Mobile-First Design

---

# 🏗️ System Architecture

```text
Client (Browser)
│
├── Next.js Frontend
│     ├── React Components
│     ├── Server Components
│     └── Tailwind UI
│
└── Supabase Browser Client
      │
      ▼
Next.js App Router
│
├── Server Actions
├── Route Handlers
├── Middleware
└── Authentication Layer
      │
      ▼
Supabase Platform
│
├── PostgreSQL Database
├── Authentication
├── Realtime Engine
└── Storage
```

---

# 🛠️ Tech Stack

## Frontend

* Next.js 16 (App Router)
* React
* TypeScript
* Tailwind CSS
* Lucide React

## Backend

* Next.js Server Actions
* Next.js Route Handlers

## Database

* PostgreSQL
* Supabase

## Authentication

* Supabase Auth
* PKCE Authentication Flow

## Realtime Services

* Supabase Realtime
* WebSocket Subscriptions

## Deployment

* Vercel
* Supabase Cloud

---

# 🗄️ Database Schema

## Core Tables

### users

Stores user profile information.

```text
id
full_name
role
shop_id
email
```

### shops

Stores tenant details.

```text
id
shop_name
license_number
gstin
address
```

### inventory

Stores medicine stock records.

```text
id
medicine_name
generic_name
batch_number
expiry_date
mrp
purchase_price
quantity
shop_id
```

### bills

Stores transaction summaries.

### bill_items

Stores individual invoice line items.

### support_tickets

Stores helpdesk communication records.

---

# 🏢 Multi-Tenant Architecture

StockEasy follows a shared-database, tenant-isolated architecture.

Every major business table contains:

```sql
shop_id UUID
```

Examples:

```text
inventory
bills
bill_items
users
support_tickets
```

Tenant isolation is enforced using PostgreSQL Row Level Security policies.

Benefits:

* Secure data separation.
* Reduced infrastructure costs.
* Centralized maintenance.
* Simplified deployment.

---

# 🔒 Security & Compliance

### Authentication

* Secure Email/Password Login
* PKCE Authentication Flow
* Password Recovery
* Session Cookies

### Authorization

* Role-Based Access Control
* Protected Routes
* Permission Validation

### Database Security

* PostgreSQL Row Level Security
* Tenant Isolation
* Access Policies

### Environment Security

Sensitive credentials are stored using:

```text
.env.local
Vercel Environment Variables
```

No private credentials are committed to source control.

---

# ⚡ Performance Optimizations

### Frontend

* Route-Based Code Splitting
* Server Components
* Lazy Loading
* Optimized Rendering

### Backend

* Indexed PostgreSQL Queries
* Server Actions
* Reduced API Round Trips

### Realtime

Supabase Realtime channels automatically synchronize dashboard metrics and inventory updates.

---

## 📂 Project Structure

```text
stockeasy/
│
├── public/                           # Static assets, images, logos
│
├── src/
│   │
│   ├── app/                          # Next.js App Router
│   │   │
│   │   ├── admin/                    # Superadmin portal
│   │   │   ├── support management
│   │   │   ├── ticket resolution
│   │   │   └── platform administration
│   │   │
│   │   ├── api/                      # Route Handlers / Server APIs
│   │   │
│   │   ├── auth/                     # Authentication utilities
│   │   ├── login/                    # Login page
│   │   ├── register/                 # User registration
│   │   ├── forgot-password/          # Password recovery flow
│   │   ├── set-password/             # Initial password setup
│   │   ├── update-password/          # Password reset page
│   │   ├── verify-invite/            # Invitation verification
│   │   │
│   │   ├── dashboard/                # Main pharmacy workspace
│   │   │   ├── POS
│   │   │   ├── Inventory
│   │   │   ├── Analytics
│   │   │   └── Billing
│   │   │
│   │   ├── support/                  # Tenant support portal
│   │   ├── privacy/                  # Privacy policy page
│   │   ├── terms/                    # Terms and conditions
│   │   │
│   │   ├── favicon.ico
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx                  # Landing page
│   │
│   ├── components/
│   │   │
│   │   ├── landing/                  # Landing page UI sections
│   │   ├── ui/                       # Shared UI components
│   │   │
│   │   ├── header.tsx
│   │   ├── hero-section.tsx
│   │   ├── features-section.tsx
│   │   ├── how-it-works.tsx
│   │   ├── pricing-section.tsx
│   │   ├── faq-section.tsx
│   │   ├── footer.tsx
│   │   │
│   │   ├── Sidebar.tsx              # Dashboard navigation
│   │   ├── DashboardHeader.tsx      # Dashboard header
│   │   │
│   │   ├── RealtimeAuthGuard.tsx    # Session validation
│   │   ├── ShopGatekeeper.tsx       # Shop-level authorization
│   │   │
│   │   ├── theme-provider.tsx
│   │   ├── theme-toggle.tsx
│   │   └── video-modal.tsx
│   │
│   ├── lib/
│   │   └── supabase.ts              # Supabase client configuration
│   │
│   └── proxy.ts                     # Middleware / request handling
│
├── .env.local                       # Environment variables
├── AGENTS.md                        # AI agent instructions
├── CLAUDE.md                        # Claude project context
│
├── package.json
├── package-lock.json
│
├── next.config.ts
├── tailwind.config.js
├── postcss.config.mjs
├── tsconfig.json
├── eslint.config.mjs
├── vercel.json
│
└── README.md
```
### Architectural Organization

The codebase follows a feature-oriented architecture:

- `app/` contains route definitions and page-level logic.
- `components/` contains reusable UI and business components.
- `lib/` contains shared services and integrations.
- `admin/` and `dashboard/` are separated to isolate platform administration from tenant operations.
- Authentication workflows are organized into dedicated route groups for maintainability and security.
---

# 🚀 Installation

## Prerequisites

* Node.js 18+
* npm
* Git
* Supabase Account

### Clone Repository

```bash
git clone https://github.com/Kusal76/StockEasy.git
cd StockEasy
```

### Install Dependencies

```bash
npm install
```

### Configure Environment Variables

## Environment Variables

## ⚙️ Environment Variables

| Variable | Description | Required |
|-----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | ✅ Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public anonymous key | ✅ Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin bypass key (Server-side only) | ✅ Yes |
| `RESEND_API_KEY` | API key for transactional emails | ✅ Yes |
| `RAZORPAY_KEY_SECRET` | Secret key for subscription payments | ⚪ Optional |
| `GEMINI_API_KEY` | API key for AI-powered search and LLM integrations | ⚪ Optional |
| `CRON_SECRET` | Secret key used to secure scheduled jobs and automated reporting endpoints | ⚪ Optional |

Create a `.env.local` file in the project root:

```env
### Example `.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

RESEND_API_KEY=your_resend_api_key

RAZORPAY_KEY_SECRET=your_razorpay_secret

GEMINI_API_KEY=your_gemini_api_key

CRON_SECRET=your_cron_secret
```

> ⚠️ Never commit `.env.local` to version control.
> Keep all service role keys, API secrets, and production credentials private.
```

> Never commit `.env.local` to version control.
> Never expose service role keys, API secrets, or production credentials.

### Start Development Server

```bash
npm run dev
```

Application URL:

```text
http://localhost:3000
```

---

# 📘 Usage Guide

### Step 1

Login using Owner or Staff credentials.

### Step 2

Add medicine inventory including:

* Batch Number
* Expiry Date
* Quantity
* Purchase Cost
* MRP

### Step 3

Process customer sales using the POS interface.

### Step 4

Generate and print invoices.

### Step 5

Monitor revenue and inventory through analytics dashboards.

---

# 🌐 Deployment

## Vercel Deployment

1. Import repository into Vercel.
2. Configure environment variables.
3. Deploy application.

### Important Authentication Configuration

Add your production URL inside:

```text
Supabase Dashboard
→ Authentication
→ URL Configuration
→ Redirect URLs
```

Example:

```text
https://stockeasy.vercel.app
```

This is required for password reset and authentication callbacks.

---

# 🔌 API Documentation

## Support Ticket Resolution

### Endpoint

```http
POST /api/admin/tickets/reply
```

### Purpose

* Resolves tenant support tickets.
* Stores admin responses.
* Updates ticket status.
* Triggers notification workflows.

### Example Response

```json
{
  "message": "Reply sent successfully"
}
```

---

# 📸 Screenshots

### Dashboard Analytics

```text
/public/screenshots/dashboard.png
```

### Smart POS

```text
/public/screenshots/pos.png
```

### Inventory Management

```text
/public/screenshots/inventory.png
```

### Bills History

```text
/public/screenshots/bills-history.png
```

---

# 🧠 Engineering Challenges

### Challenge 1: Medicine Expiry Losses

Implemented FEFO recommendation logic to prioritize medicines nearing expiry.

### Challenge 2: Tenant Data Isolation

Implemented PostgreSQL Row Level Security policies based on `shop_id`.

### Challenge 3: Realtime Analytics

Integrated Supabase Realtime subscriptions for live dashboard updates.

---

## 🗺️ Product Roadmap

**Phase 1: Core Platform (MVP) ✅**
- [x] Secure Authentication & Role-Based Access Control (RBAC)
- [x] FEFO-Optimized Inventory Management
- [x] Smart Point of Sale (POS) & Billing Engine
- [x] Real-time Analytics Dashboard & KPI Tracking
- [x] Superadmin Support Helpdesk & Ticketing

**Phase 2: Operational Scaling 🚧**
- [ ] **Hardware Integration:** Native support for ESC/POS thermal printers (58mm/80mm) and USB/Bluetooth barcode scanners.
- [ ] **Vendor & Supply Chain:** Supplier management, automated purchase orders, and stock-inwarding from digital invoices.
- [ ] **Tax & Compliance:** Automated GST calculation, HSN code tracking, and one-click GST return reporting (GSTR-1/GSTR-3B).

**Phase 3: Enterprise & AI 📋**
- [ ] **Multi-Branch Architecture:** Centralized organization control to sync inventory and transfer stock across multiple physical pharmacy locations.
- [ ] **AI Demand Forecasting:** Machine learning models to predict seasonal medicine demand (e.g., automatically suggesting higher stock of anti-allergens before spring).
- [ ] **Mobile Application:** A companion React Native / Expo app for staff to do quick shelf audits and stock checks via smartphone cameras.

---

## 🔮 Future Enhancements

Beyond the core roadmap, StockEasy is continuously exploring new technological integrations to reduce friction in medical retail:

*   **WhatsApp/SMS API Integration:** Instantly send digital Cash Memos and refill reminders directly to customer phone numbers.
*   **LLM-Powered Querying:** Implementing a Generative AI search bar where owners can type natural language queries like *"Which medicines expire next month?"* or *"Show me last week's revenue compared to today."*
*   **Automated Cron Jobs:** Serverless functions to automatically email weekly performance reports and critical low-stock warnings to shop owners every Sunday night.

---

# 🤝 Contributing

1. Fork the repository.
2. Create a feature branch.

```bash
git checkout -b feature/NewFeature
```

3. Commit your changes.

```bash
git commit -m "Implement NewFeature"
```

4. Push to GitHub.

```bash
git push origin feature/NewFeature
```

5. Open a Pull Request.

---

# 📄 License

This project is licensed under the MIT License.

See the `LICENSE` file for complete details.

---

# 👨‍💻 Author

**Kusal Dey**

GitHub: https://github.com/Kusal76

LinkedIn: https://linkedin.com/in/your-linkedin-profile

---

## ⭐ Support

If you found this project useful, consider giving it a star on GitHub.
