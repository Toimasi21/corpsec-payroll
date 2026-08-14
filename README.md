# CorpSec HR Payroll Management System
**Company:** CorpSec Investigations & Guarding Services (Kenya)  
**Phase:** Phase 1 — Foundation Architecture  
**Status:** ✅ Complete & Verified

---

## 🛡️ Overview

**CorpSec HR Payroll** is a production-ready HR and Payroll management system engineered specifically for the operational dynamics and statutory framework of Kenyan enterprises and security guarding services.

In accordance with Phase 1 constraints:
- **Zero fake data or pseudo-calculations**: Foundation metrics accurately reflect database records.
- **Kenyan Defaults**: Currency is **KES (KSh)**, Timezone is **Africa/Nairobi (EAT, UTC+3)**, Country is **Kenya**, and KRA PIN identifier is configured.
- **Future Module Boundaries**: Modules planned for subsequent phases (Employee Onboarding, Attendance, Leave, Payroll Engine, Loans, Payslips, Bank/M-Pesa Disbursements, Reports, Employee Self-Service) are securely placed in the navigation structure with architectural roadmap placeholders.

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js (v18.0.0 or higher)
- npm (v9.0.0 or higher)

### 1. Installation
```bash
npm install
```

### 2. Database Setup & Seeding
```bash
# Push Prisma schema to SQLite database (dev.db)
npm run db:push

# Run development seed script
npm run seed
```

### 3. Start Development Server
```bash
npm run dev
# or for production server:
npm run build && npm run start
```
The application will be accessible at: `http://localhost:3000`

---

## 🔐 Development Seed Accounts

| Role | Email | Password | Access Level |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admin@corpsec.co.ke` | `Admin@CorpSec2026!` | Full, unrestricted access to all modules, settings & user permissions |
| **HR Administrator** | `hr.admin@corpsec.co.ke` | `HrAdmin@CorpSec2026!` | Manages personnel records, organization units, departments & stations |
| **Payroll Officer** | `payroll@corpsec.co.ke` | `Payroll@CorpSec2026!` | Manages payroll preparation, allowances & statutory remittances |
| **HR Manager** | `hr.manager@corpsec.co.ke` | `HrManager@CorpSec2026!` | Reviews & approves HR workflows, leave requests & payroll batches |
| **Finance Approver** | `finance@corpsec.co.ke` | `Finance@CorpSec2026!` | Audits payroll summaries & grants disbursement authorizations |

---

## 🏛️ Database Entities Established (Phase 1)

1. **`users`**: System accounts, salted password hashes (bcrypt), active/deactivation flags, timestamps, soft-delete.
2. **`roles`**: System roles (`super_admin`, `hr_admin`, `payroll_officer`, `hr_manager`, `finance`, `employee`).
3. **`permissions`**: 32 fine-grained system permissions across USERS, ORGANIZATION, SETTINGS, AUDIT, HR, PAYROLL, ATTENDANCE, LEAVE, REPORTS.
4. **`user_roles`**: Many-to-many relationship linking users to roles.
5. **`role_permissions`**: Matrix associating roles with permissions.
6. **`company_settings`**: Kenyan defaults (Kenya, KES, Africa/Nairobi, KRA PIN, Registration No, Addresses, configurable payroll placeholder).
7. **`branches`**: Operational branch hierarchy (Nairobi HQ, Mombasa, Kisumu).
8. **`departments`**: Divisions (Security Operations, HR & Admin, Finance, Logistics).
9. **`stations`**: Guarding deployment sites and work locations (Nairobi Central, Industrial Area Post, Kilindini Port Outpost).
10. **`audit_logs`**: Immutable security audit trail with client IP, user agent, action, and scrubbed payload states.
11. **`system_notifications`**: Foundation for system alerts and user notifications.
12. **`password_resets`**: Token-based password recovery flow architecture.
13. **`document_storage_records`**: Prepared schema foundation for secure employee document storage in Phase 2.

---

## 🧪 Automated Verification

Run the built-in test suites:
```bash
# Automated database, RBAC, and Kenyan settings verification
npx tsx scripts/verify-phase1.ts

# Live HTTP endpoint and authentication tests
npx tsx scripts/test-e2e-http.ts
```
