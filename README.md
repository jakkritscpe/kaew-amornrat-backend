# kaew-amornrat-backend

Backend สำหรับระบบบันทึกเวลาทำงาน (Attendance System) ของ หจก.แก้วอมรรัตน์
สร้างด้วย **Hono + Bun** รันบน **PostgreSQL** จัดการ Schema ด้วย **Drizzle ORM**

---

## Tech Stack

| เทคโนโลยี | หน้าที่ |
|---|---|
| [Bun](https://bun.sh) | JavaScript Runtime (เร็วกว่า Node.js ~3x) |
| [Hono](https://hono.dev) | Web Framework (เบา, เร็ว, TypeScript-first) |
| [Drizzle ORM](https://orm.drizzle.team) | จัดการ Database Schema + Query |
| [PostgreSQL](https://postgresql.org) | Database หลัก |
| [Zod](https://zod.dev) | Validate request body/query |
| [Docker](https://docker.com) | รัน PostgreSQL บน local |

---

## โครงสร้างโปรเจ็ค

```
backend/
├── src/
│   ├── index.ts                  # Entry point
│   ├── app.ts                    # Hono app + mount routes ทั้งหมด
│   ├── db/
│   │   ├── schema.ts             # นิยาม Table ทั้งหมด (Drizzle)
│   │   ├── index.ts              # เชื่อมต่อ Database
│   │   ├── migrate.ts            # รัน Migration
│   │   └── seed.ts               # ใส่ข้อมูลตั้งต้น
│   ├── shared/
│   │   ├── middleware/
│   │   │   ├── auth.ts           # JWT Middleware + Role Guard
│   │   │   └── error-handler.ts  # จัดการ Error ทุกประเภท
│   │   ├── utils/
│   │   │   ├── geo.ts            # คำนวณระยะห่าง GPS (Haversine)
│   │   │   ├── time.ts           # คำนวณชั่วโมงทำงาน, OT
│   │   │   └── response.ts       # Standard API Response format
│   │   └── types/
│   │       └── index.ts          # TypeScript types ที่ใช้ร่วมกัน
│   └── modules/                  # แยก Feature เป็น Module
│       ├── auth/                 # Login, QR Login, JWT
│       ├── employees/            # CRUD พนักงาน + QR Token
│       ├── locations/            # CRUD สถานที่ทำงาน (Geofence)
│       ├── attendance/           # Check-in, Check-out, Logs
│       ├── ot-requests/          # ยื่นขอ OT, อนุมัติ OT
│       ├── settings/             # ตั้งค่าบริษัท (อัตรา OT)
│       └── qr-checkin/           # QR Check-in แบบ Public
├── drizzle/
│   └── migrations/               # SQL Migration files (auto-generated)
├── drizzle.config.ts
├── package.json
└── .env.example
```

---

## เริ่มต้นใช้งาน

### 1. ติดตั้ง Dependencies

```bash
# แนะนำ Bun
bun install

# หรือ npm (ถ้าไม่มี Bun หรือมีปัญหา SSL cert)
npm install
```

### 2. ตั้งค่า Environment

```bash
cp .env.example .env
```

แก้ไขค่าใน `.env`:

```env
DATABASE_URL=postgresql://repairhub:repairhub_secret@localhost:5432/repair_hub
JWT_SECRET=เปลี่ยนเป็น-secret-ที่ปลอดภัย-ก่อน-production
PORT=3000
FRONTEND_URL=http://localhost:5173
```

### 3. รัน PostgreSQL ด้วย Docker

```bash
# ที่ root ของ project (ไม่ใช่ใน backend/)
docker compose up -d

# ตรวจสอบว่า PostgreSQL พร้อม
docker compose ps
```

### 4. รัน Migration และ Seed ข้อมูล

```bash
# สร้าง Tables จาก Schema
npm run db:migrate

# ใส่ข้อมูลตั้งต้น (locations, employees, settings)
npm run db:seed
```

### 5. รัน Server

```bash
# Development (auto-reload)
npm run dev

# Production
npm run start
```

Server จะรันที่ `http://localhost:3000`

---

## API Endpoints

### Authentication

| Method | Path | Guard | คำอธิบาย |
|---|---|---|---|
| POST | `/api/auth/login` | Public | Login ด้วย email + password |
| GET | `/api/auth/me` | Auth | ดูข้อมูลตัวเอง |
| POST | `/api/auth/qr-login` | Public | Login ผ่าน QR code |

**ตัวอย่าง Login:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@repair-hub.local","password":"admin1234"}'
```

**ตัวอย่าง QR Login:**
```bash
curl -X POST http://localhost:3000/api/auth/qr-login \
  -H "Content-Type: application/json" \
  -d '{"token":"xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"}'
```

---

### Employees

| Method | Path | Guard | คำอธิบาย |
|---|---|---|---|
| GET | `/api/employees` | admin, manager | ดูรายชื่อพนักงานทั้งหมด |
| GET | `/api/employees/:id` | admin, manager | ดูข้อมูลพนักงาน |
| POST | `/api/employees` | admin | เพิ่มพนักงานใหม่ |
| PUT | `/api/employees/:id` | admin | แก้ไขข้อมูลพนักงาน |
| DELETE | `/api/employees/:id` | admin | ลบพนักงาน |
| GET | `/api/employees/:id/qr-token` | admin, manager | ดึง QR URL สำหรับพิมพ์ |
| POST | `/api/employees/:id/regenerate-qr` | admin | ออก QR ใหม่ (revoke เก่า) |

---

### Attendance (บันทึกเวลา)

| Method | Path | Guard | คำอธิบาย |
|---|---|---|---|
| POST | `/api/attendance/check-in` | Auth | บันทึกเข้างาน (พร้อม Geofence) |
| POST | `/api/attendance/check-out` | Auth | บันทึกออกงาน |
| GET | `/api/attendance/logs/today` | Auth | ดู log วันนี้ของตัวเอง |
| GET | `/api/attendance/logs` | admin, manager | ดู log ทั้งหมด |
| GET | `/api/attendance/logs/:employeeId` | admin, manager | ดู log ของพนักงาน |
| PATCH | `/api/attendance/logs/:id` | admin | แก้ไข log |

**ตัวอย่าง Check-in:**
```bash
curl -X POST http://localhost:3000/api/attendance/check-in \
  -H "Authorization: Bearer {JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"lat":13.7563,"lng":100.5018}'
```

---

### Locations (สถานที่ทำงาน)

| Method | Path | Guard | คำอธิบาย |
|---|---|---|---|
| GET | `/api/locations` | Auth | ดูสถานที่ทั้งหมด |
| POST | `/api/locations` | admin | เพิ่มสถานที่ใหม่ |
| PUT | `/api/locations/:id` | admin | แก้ไขสถานที่ |
| DELETE | `/api/locations/:id` | admin | ลบสถานที่ |

---

### OT Requests (คำขอทำงานล่วงเวลา)

| Method | Path | Guard | คำอธิบาย |
|---|---|---|---|
| GET | `/api/ot-requests` | admin, manager | ดูคำขอทั้งหมด |
| GET | `/api/ot-requests/my` | Auth | ดูคำขอของตัวเอง |
| POST | `/api/ot-requests` | Auth | ยื่นขอ OT |
| PATCH | `/api/ot-requests/:id/status` | admin, manager | อนุมัติ/ปฏิเสธ |

---

### Settings

| Method | Path | Guard | คำอธิบาย |
|---|---|---|---|
| GET | `/api/settings` | Auth | ดูการตั้งค่าบริษัท |
| PUT | `/api/settings` | admin | แก้ไขอัตรา OT |

---

### QR Check-in (Public)

| Method | Path | Guard | คำอธิบาย |
|---|---|---|---|
| GET | `/api/qr-checkin/:employeeId` | Public | ดูข้อมูลพนักงาน |
| POST | `/api/qr-checkin/:employeeId` | Public | Check-in ผ่าน QR |

---

## ระบบ Authentication

### JWT Token
- Login สำเร็จ → ได้ JWT Token
- ใส่ใน Header ทุก request: `Authorization: Bearer {token}`
- Token ปกติอายุ **7 วัน**, QR Login อายุ **30 วัน**
- ลงชื่อด้วย HMAC-SHA256 ผ่าน Web Crypto API (ไม่ใช้ library ภายนอก)

### Role และสิทธิ์

| Role | สิทธิ์ |
|---|---|
| `admin` | ทุกอย่าง รวมถึงจัดการพนักงาน, สถานที่, อนุมัติ OT |
| `manager` | ดู logs, อนุมัติ OT, ดูข้อมูลพนักงาน |
| `employee` | check-in/out, ดูข้อมูลตัวเอง, ยื่นขอ OT |

---

## ระบบ QR Login

พนักงานแต่ละคนมี **QR Token** (UUID) เก็บในฐานข้อมูล ใช้สำหรับ login โดยไม่ต้องกรอกรหัสผ่าน

```
1. Admin ดึง QR URL → GET /api/employees/:id/qr-token
2. พิมพ์ QR code ติดบัตรพนักงาน
   URL ที่อยู่ใน QR: http://your-domain/employee/qr-login/{uuid}
3. พนักงานสแกน QR → Frontend เรียก POST /api/auth/qr-login
4. Backend ตรวจ UUID → ออก JWT 30 วัน
5. พนักงาน login สำเร็จ ไม่ต้องกรอกรหัสผ่าน
```

**Revoke QR เมื่อพนักงานลาออก:**
```bash
curl -X POST http://localhost:3000/api/employees/{id}/regenerate-qr \
  -H "Authorization: Bearer {ADMIN_TOKEN}"
```
UUID เก่าใช้ไม่ได้ทันที พนักงานต้องขอ QR ใหม่

---

## ระบบ Geofence (ตรวจสอบพื้นที่)

เมื่อพนักงาน check-in ระบบจะตรวจสอบตำแหน่ง GPS อัตโนมัติ:

```
1. รับพิกัด GPS (lat, lng) จาก Mobile Browser
2. ดึงข้อมูล Work Location ที่ผูกกับพนักงาน
3. คำนวณระยะห่างด้วย Haversine Formula
4. ระยะ ≤ รัศมีที่กำหนด → อนุญาต check-in
5. ระยะ > รัศมี → ปฏิเสธ พร้อมแจ้งระยะห่างเป็นเมตร
```

**คำนวณสถานะการมาทำงาน:**
- มาก่อนหรือภายใน **15 นาที** หลัง shift → `present` (มาทำงาน)
- มาหลัง 15 นาที → `late` (มาสาย)

---

## Database Commands

```bash
# ดู Schema และข้อมูลผ่าน GUI (Drizzle Studio)
npm run db:studio

# สร้าง migration ใหม่หลังแก้ไข schema.ts
npm run db:generate

# รัน migration ที่ยังไม่ได้รัน
npm run db:migrate

# ใส่ข้อมูลตั้งต้น
npm run db:seed
```

---

## Test Accounts (หลัง Seed)

| Email | Password | Role |
|---|---|---|
| admin@repair-hub.local | admin1234 | admin |
| manager@repair-hub.local | admin1234 | manager |
| somchai@repair-hub.local | emp1234 | employee |
| wisawa@repair-hub.local | emp1234 | employee |

---

## Standard Response Format

ทุก API ตอบกลับในรูปแบบเดียวกัน:

```json
// สำเร็จ
{
  "success": true,
  "data": { },
  "message": "optional message"
}

// ผิดพลาด
{
  "success": false,
  "error": "คำอธิบาย error"
}
```

**HTTP Status Codes:**

| Code | ความหมาย |
|---|---|
| 200 | สำเร็จ |
| 201 | สร้างข้อมูลใหม่สำเร็จ |
| 400 | ข้อมูลไม่ถูกต้อง (validation error) |
| 401 | ไม่ได้ login หรือ token หมดอายุ |
| 403 | ไม่มีสิทธิ์เข้าถึง |
| 404 | ไม่พบข้อมูล |
| 500 | Server error |
