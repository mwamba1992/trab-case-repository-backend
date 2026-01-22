# TRAB Case Repository Backend - Technical Reference

**Version:** 1.0.0
**Last Updated:** January 22, 2026
**Framework:** NestJS 11.x
**Database:** PostgreSQL 15+ with pgvector extension

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Technology Stack](#technology-stack)
4. [Project Structure](#project-structure)
5. [Core Modules](#core-modules)
6. [Database Schema](#database-schema)
7. [API Endpoints](#api-endpoints)
8. [Configuration](#configuration)
9. [Development Workflow](#development-workflow)
10. [Deployment](#deployment)
11. [Troubleshooting](#troubleshooting)

---

## System Overview

The TRAB Case Repository Backend is a comprehensive legal document management and search system built for the Tax Revenue Appeals Board of Tanzania. It provides:

- **Hybrid Search**: Combines full-text search (PostgreSQL) with semantic vector search (pgvector)
- **OCR Processing**: Extracts text from scanned PDF documents using Tesseract.js
- **Case Management**: Stores and manages tax appeal case metadata
- **TRAIS Integration**: Syncs data from the TRAIS (Tax Revenue Appeals Information System)
- **Authentication**: JWT-based authentication with role-based access control
- **RESTful API**: Well-documented API with Swagger/OpenAPI

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Applications                     │
│              (Web Frontend, Mobile Apps, etc.)               │
└──────────────────────────┬──────────────────────────────────┘
                           │ REST API (HTTP/HTTPS)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    NestJS Backend Server                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  API Layer (Controllers + Guards + Middleware)       │   │
│  └──────────────────────────┬───────────────────────────┘   │
│                             ▼                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Business Logic Layer (Services)              │   │
│  │  - Auth     - Search    - OCR     - Embeddings      │   │
│  │  - Cases    - Sync      - Users                     │   │
│  └──────────────────────────┬───────────────────────────┘   │
│                             ▼                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Data Access Layer (TypeORM Repositories)     │   │
│  └──────────────────────────┬───────────────────────────┘   │
└────────────────────────────┼────────────────────────────────┘
                             ▼
         ┌───────────────────────────────────────┐
         │      PostgreSQL Database              │
         │  - Tables (TypeORM Entities)         │
         │  - Full-text search (tsvector)       │
         │  - Vector search (pgvector)          │
         └───────────────────────────────────────┘
```

### Key Design Patterns

1. **Module-based Architecture**: Each feature is a self-contained NestJS module
2. **Repository Pattern**: TypeORM repositories for data access
3. **Service Layer**: Business logic separated from controllers
4. **Dependency Injection**: NestJS IoC container manages dependencies
5. **DTOs & Validation**: Class-validator for request validation
6. **Guard Pattern**: JWT guards for authentication & authorization

---

## Technology Stack

### Core Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| **NestJS** | 11.0.1 | Backend framework |
| **TypeScript** | 5.7.3 | Programming language |
| **PostgreSQL** | 15+ | Primary database |
| **TypeORM** | 0.3.28 | ORM for database access |
| **Node.js** | 22+ | Runtime environment |

### Key Dependencies

| Package | Purpose |
|---------|---------|
| `@nestjs/jwt` | JWT authentication |
| `@nestjs/passport` | Authentication strategies |
| `@nestjs/config` | Environment configuration |
| `@nestjs/swagger` | API documentation |
| `@nestjs/throttler` | Rate limiting |
| `@nestjs/schedule` | Cron jobs & scheduling |
| `@xenova/transformers` | Local embeddings (Transformers.js) |
| `tesseract.js` | OCR processing |
| `pdf-parse` | PDF text extraction |
| `bcrypt` | Password hashing |
| `bull` | Queue management |
| `redis` | Caching & queues |
| `helmet` | Security headers |
| `compression` | Response compression |

### Database Extensions

- **pgvector**: Vector similarity search (cosine distance)
- **pg_trgm**: Trigram-based fuzzy search (optional)

---

## Project Structure

```
case-repository-backend/
├── src/
│   ├── main.ts                    # Application entry point
│   ├── app.module.ts              # Root module
│   ├── app.controller.ts          # Health check endpoint
│   ├── app.service.ts             # Basic app service
│   │
│   ├── config/
│   │   └── configuration.ts       # Environment config schema
│   │
│   ├── common/                    # Shared utilities
│   │   ├── decorators/
│   │   ├── filters/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   └── pipes/
│   │
│   └── modules/
│       ├── auth/                  # Authentication & authorization
│       │   ├── auth.module.ts
│       │   ├── auth.service.ts
│       │   ├── auth.controller.ts
│       │   ├── strategies/
│       │   │   └── jwt.strategy.ts
│       │   ├── guards/
│       │   │   ├── jwt-auth.guard.ts
│       │   │   └── roles.guard.ts
│       │   ├── decorators/
│       │   │   ├── roles.decorator.ts
│       │   │   └── current-user.decorator.ts
│       │   └── dto/
│       │       ├── login.dto.ts
│       │       ├── register.dto.ts
│       │       └── change-password.dto.ts
│       │
│       ├── users/                 # User management
│       │   └── entities/
│       │       └── user.entity.ts
│       │
│       ├── cases/                 # Case management
│       │   ├── cases.module.ts
│       │   ├── cases.service.ts
│       │   ├── cases.controller.ts
│       │   └── entities/
│       │       ├── case.entity.ts
│       │       ├── case-content.entity.ts
│       │       ├── case-document.entity.ts
│       │       └── case-party.entity.ts
│       │
│       ├── search/                # Search functionality
│       │   ├── search.module.ts
│       │   ├── search.service.ts   # Full-text, semantic, hybrid search
│       │   └── search.controller.ts
│       │
│       ├── embeddings/            # Vector embeddings
│       │   ├── embeddings.module.ts
│       │   ├── embeddings.service.ts  # Transformers.js integration
│       │   └── entities/
│       │       └── case-embedding.entity.ts
│       │
│       ├── ocr/                   # OCR processing
│       │   ├── ocr.module.ts
│       │   ├── ocr.service.ts      # Tesseract.js integration
│       │   ├── ocr.processor.ts    # Bull queue processor
│       │   ├── ocr.controller.ts
│       │   └── simple-queue.service.ts  # In-memory queue
│       │
│       ├── sync/                  # TRAIS synchronization
│       │   ├── sync.module.ts
│       │   ├── sync.service.ts
│       │   ├── sync.controller.ts
│       │   ├── services/
│       │   │   ├── trais-client.service.ts
│       │   │   ├── trais-mapper.service.ts
│       │   │   ├── metadata-extractor.service.ts
│       │   │   └── local-file-processor.service.ts
│       │   └── dto/
│       │       └── trais-appeal.dto.ts
│       │
│       └── analytics/             # Analytics & statistics
│           └── (future implementation)
│
├── test/                          # E2E tests
├── dist/                          # Compiled output
├── uploads/                       # File uploads
├── node_modules/
│
├── .env                           # Environment variables (gitignored)
├── .env.example                   # Environment template
├── package.json
├── tsconfig.json
├── nest-cli.json
├── docker-compose.yml
├── Dockerfile
├── init.sql                       # Database initialization
├── README.md
├── API_DOCUMENTATION.md
└── REFERENCE.md                   # This file
```

---

## Core Modules

### 1. Authentication Module (`src/modules/auth/`)

**Purpose**: JWT-based authentication and authorization

**Key Files**:
- `auth.service.ts:38` - Login, registration, password management
- `jwt.strategy.ts:10` - JWT validation strategy
- `jwt-auth.guard.ts` - Protect routes
- `roles.guard.ts` - Role-based access control

**Features**:
- User registration with email/password
- JWT token generation (15-minute expiry)
- Refresh tokens (7-day expiry)
- Password hashing with bcrypt
- Role-based authorization (Admin, Lawyer, Public)
- Account locking after failed login attempts

**DTOs**:
```typescript
// LoginDto
{ email: string, password: string }

// RegisterDto
{ firstName: string, lastName: string, email: string, password: string }

// ChangePasswordDto
{ currentPassword: string, newPassword: string }
```

---

### 2. Cases Module (`src/modules/cases/`)

**Purpose**: Manage tax appeal cases and related entities

**Key Entities**:

1. **Case** (`case.entity.ts:39`)
   - Case metadata (number, type, dates, parties)
   - Tax amounts disputed/awarded
   - Judges, chairperson, board members
   - Outcome and status
   - Relations to documents, content, parties

2. **CaseDocument** (`case-document.entity.ts`)
   - PDF files linked to cases
   - OCR status tracking
   - Page count and file metadata

3. **CaseContent** (`case-content.entity.ts`)
   - Page-by-page text content
   - Embeddings for semantic search
   - Full-text search vectors (tsvector)

4. **CaseParty** (`case-party.entity.ts`)
   - Appellants, respondents, representatives
   - Contact information

**Enums**:
```typescript
// Case Types
enum CaseType {
  INCOME_TAX, VAT, CUSTOMS, EXCISE, STAMP_DUTY, OTHER
}

// Case Status
enum CaseStatus {
  PENDING, DECIDED, APPEALED, WITHDRAWN, SETTLED
}

// Case Outcome
enum CaseOutcome {
  ALLOWED, DISMISSED, PARTIALLY_ALLOWED, REMANDED, OTHER
}
```

---

### 3. Search Module (`src/modules/search/`)

**Purpose**: Hybrid search combining full-text and semantic search

**Search Types**:

1. **Full-Text Search** (`search.service.ts:55`)
   - PostgreSQL `tsvector` and `plainto_tsquery`
   - Fast keyword matching
   - Performance: ~30-50ms

2. **Semantic Search** (`search.service.ts:135`)
   - Vector similarity using pgvector
   - Cosine distance (`<=>` operator)
   - Local embeddings (Transformers.js)
   - Performance: ~80-120ms

3. **Hybrid Search** (`search.service.ts:223`)
   - Combines both approaches with weighted scoring
   - Default weights: 50% full-text, 50% semantic
   - Configurable via query parameters

**Search Result Format**:
```typescript
interface SearchResult {
  documentId: string;
  documentName: string;
  caseId: string;
  pageNumber: number;         // Exact page where match found
  content: string;            // Truncated snippet with context
  score: number;              // Relevance score
  matchType: 'full-text' | 'semantic' | 'hybrid';
  caseMetadata: {
    caseNumber: string;
    caseType: string;
    appellant: string;
    // ... (full case metadata)
  };
}
```

---

### 4. Embeddings Module (`src/modules/embeddings/`)

**Purpose**: Generate vector embeddings for semantic search

**Model**: `Xenova/all-MiniLM-L6-v2` (via Transformers.js)
- 384-dimensional embeddings
- Runs locally (no API costs)
- First run downloads ~25MB model from Hugging Face

**Key Methods** (`embeddings.service.ts`):

```typescript
// Generate single embedding
async generateEmbedding(text: string): Promise<number[]>

// Batch generation (more efficient)
async generateEmbeddingsBatch(texts: string[]): Promise<number[][]>

// Calculate similarity
cosineSimilarity(emb1: number[], emb2: number[]): number

// Text chunking for long documents
chunkText(text: string, maxChunkSize?: number, overlap?: number): string[]
```

**Usage**:
- Embeddings generated during OCR processing
- Query embeddings generated on-the-fly during search
- Stored in `case_content.embedding` column (vector type)

---

### 5. OCR Module (`src/modules/ocr/`)

**Purpose**: Extract text from PDF documents

**Architecture**:
- In-memory queue system (`simple-queue.service.ts`)
- OCR processor (`ocr.processor.ts`)
- Progress tracking and error handling

**Processing Flow** (`ocr.service.ts:43`):

```
1. Detect if PDF has embedded text or is scanned
   ├─ Has text → Extract directly (fast)
   └─ Scanned → Use Tesseract OCR (slower)

2. Process page by page
   ├─ Extract/OCR text
   ├─ Clean and normalize text
   ├─ Generate embedding
   ├─ Update full-text search index
   └─ Save to case_content table

3. Update document status
   ├─ All success → completed
   ├─ All failed → failed
   └─ Partial → manual_review
```

**OCR Statuses**:
```typescript
enum OcrStatus {
  PENDING,        // Not yet processed
  PROCESSING,     // Currently processing
  COMPLETED,      // Successfully completed
  FAILED,         // Processing failed
  MANUAL_REVIEW   // Partial success, needs review
}
```

---

### 6. Sync Module (`src/modules/sync/`)

**Purpose**: Synchronize case data from TRAIS API

**Services**:

1. **TraisClientService** (`trais-client.service.ts`)
   - HTTP client for TRAIS API
   - Authentication handling
   - PDF download

2. **TraisMapperService** (`trais-mapper.service.ts`)
   - Maps TRAIS DTOs to Case entities
   - Data transformation and validation

3. **LocalFileProcessorService** (`local-file-processor.service.ts`)
   - Process PDF files from local directory
   - Create CaseDocument records
   - Queue for OCR processing

**Sync Methods** (`sync.service.ts`):

```typescript
// Full sync from TRAIS
async syncAll(options?: { maxPages?: number }): Promise<SyncResult>

// Incremental sync (updates only)
async syncIncremental(): Promise<SyncResult>

// Sync single appeal by ID
async syncAppealById(appealId: number): Promise<{created, updated}>

// Scheduled daily sync (2 AM)
@Cron(CronExpression.EVERY_DAY_AT_2AM)
async handleScheduledSync()
```

---

### 7. Users Module (`src/modules/users/`)

**User Entity** (`user.entity.ts:23`):

```typescript
interface User {
  id: string;                    // UUID
  firstName: string;
  lastName: string;
  email: string;                 // Unique
  password: string;              // Hashed with bcrypt
  role: UserRole;                // admin | lawyer | public
  status: UserStatus;            // active | inactive | suspended

  // Optional fields
  phoneNumber?: string;
  organization?: string;
  tinNumber?: string;            // Tax ID
  licenseNumber?: string;        // Lawyer license

  // Email verification
  emailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;

  // Password reset
  passwordResetToken?: string;
  passwordResetExpires?: Date;

  // Security
  lastLoginAt?: Date;
  loginAttempts: number;
  lockedUntil?: Date;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Database Schema

### Core Tables

#### `cases`
Primary table for tax appeal cases

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `case_number` | VARCHAR | Unique case identifier (e.g., "DSM.211/2024") |
| `trais_id` | VARCHAR | TRAIS system ID |
| `title` | TEXT | Case title |
| `filing_date` | DATE | Date case was filed |
| `hearing_date` | DATE | Hearing date |
| `decision_date` | DATE | Decision date |
| `case_type` | ENUM | income_tax, vat, customs, excise, etc. |
| `status` | ENUM | pending, decided, appealed, withdrawn, settled |
| `outcome` | ENUM | allowed, dismissed, partially_allowed, etc. |
| `appellant` | VARCHAR | Appellant name |
| `appellant_tin` | VARCHAR | Appellant TIN |
| `respondent` | VARCHAR | Respondent (usually "Commissioner General, TRA") |
| `chairperson` | VARCHAR | Judge/chairperson name |
| `board_members` | TEXT[] | Array of board member names |
| `tax_amount_disputed` | DECIMAL(18,2) | Amount in dispute |
| `tax_amount_awarded` | DECIMAL(18,2) | Amount awarded |
| `summary` | TEXT | Case summary |
| `key_issues` | TEXT[] | Key legal issues |
| `legal_principles` | TEXT[] | Legal principles applied |
| `statutes_cited` | TEXT[] | Statutes referenced |
| `cases_cited` | TEXT[] | Precedent cases |
| `pdf_url` | VARCHAR | PDF file path |
| `pdf_hash` | VARCHAR | SHA-256 hash |
| `search_vector` | TSVECTOR | Full-text search index |
| `created_at` | TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP | Last update |
| `synced_at` | TIMESTAMP | Last TRAIS sync |

**Indexes**:
- `idx_cases_case_number` on `case_number`
- `idx_cases_decision_date` on `decision_date`
- `idx_cases_case_type` on `case_type`

---

#### `case_documents`
PDF documents linked to cases

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `case_id` | UUID | Foreign key to cases |
| `file_name` | VARCHAR | Original filename |
| `file_path` | VARCHAR | Storage path |
| `file_size` | BIGINT | Size in bytes |
| `mime_type` | VARCHAR | MIME type |
| `page_count` | INTEGER | Total pages |
| `ocr_status` | ENUM | pending, processing, completed, failed, manual_review |
| `ocr_error` | TEXT | Error message if failed |
| `processed_at` | TIMESTAMP | OCR completion time |
| `created_at` | TIMESTAMP | Upload time |

---

#### `case_content`
Page-by-page document content with embeddings

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `case_id` | UUID | Foreign key to cases |
| `document_id` | UUID | Foreign key to case_documents |
| `page_number` | INTEGER | Page number (1-indexed) |
| `raw_text` | TEXT | Original extracted text |
| `cleaned_text` | TEXT | Cleaned/normalized text |
| `word_count` | INTEGER | Word count |
| `language` | VARCHAR | Language code (e.g., 'en') |
| `embedding` | VECTOR(384) | Semantic embedding vector |
| `tsvector_content` | TSVECTOR | Full-text search vector |
| `ocr_engine` | VARCHAR | OCR engine used |
| `ocr_confidence` | DECIMAL | OCR confidence (0-1) |
| `processed_at` | TIMESTAMP | Processing time |

**Indexes**:
- `idx_content_document_page` on `(document_id, page_number)`
- `idx_content_tsvector` (GIN) on `tsvector_content`
- `idx_content_embedding` (HNSW) on `embedding` using COSINE distance

---

#### `users`
User accounts

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `first_name` | VARCHAR(100) | First name |
| `last_name` | VARCHAR(100) | Last name |
| `email` | VARCHAR(255) | Email (unique) |
| `password` | VARCHAR(255) | Bcrypt hash |
| `role` | ENUM | admin, lawyer, public |
| `status` | ENUM | active, inactive, suspended |
| `phone_number` | VARCHAR(20) | Phone number |
| `organization` | VARCHAR(255) | Organization name |
| `tin_number` | VARCHAR(50) | Tax ID |
| `license_number` | VARCHAR(100) | Lawyer license |
| `email_verified` | BOOLEAN | Email verification status |
| `last_login_at` | TIMESTAMP | Last login time |
| `login_attempts` | INTEGER | Failed login count |
| `locked_until` | TIMESTAMP | Account lock expiry |
| `created_at` | TIMESTAMP | Registration time |
| `updated_at` | TIMESTAMP | Last update |

**Indexes**:
- `idx_users_email` on `email`
- `idx_users_status` on `status`

---

### Vector Search Setup

```sql
-- Install pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create HNSW index for fast similarity search
CREATE INDEX idx_content_embedding ON case_content
USING hnsw (embedding vector_cosine_ops);

-- Query example (cosine similarity)
SELECT *, (1 - (embedding <=> $1::vector)) as similarity
FROM case_content
WHERE embedding IS NOT NULL
ORDER BY embedding <=> $1::vector
LIMIT 10;
```

---

## API Endpoints

### Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/v1/auth/register` | Register new user | No |
| POST | `/api/v1/auth/login` | Login user | No |
| POST | `/api/v1/auth/refresh` | Refresh JWT token | Yes |
| POST | `/api/v1/auth/logout` | Logout user | Yes |
| POST | `/api/v1/auth/change-password` | Change password | Yes |
| GET | `/api/v1/auth/profile` | Get user profile | Yes |

### Search Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/v1/search` | Hybrid search (default) | No |
| GET | `/api/v1/search/hybrid` | Hybrid search | No |
| GET | `/api/v1/search/full-text` | Full-text search only | No |
| GET | `/api/v1/search/semantic` | Semantic search only | No |

**Query Parameters**:
- `q` (required): Search query
- `limit` (optional): Max results (default: 10, max: 100)
- `ftWeight` (optional): Full-text weight (0-1, default: 0.5)
- `semWeight` (optional): Semantic weight (0-1, default: 0.5)

### OCR Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/v1/ocr/process/pending` | Queue all pending docs | Yes (Admin) |
| POST | `/api/v1/ocr/process/:documentId` | Process specific doc | Yes (Admin) |
| POST | `/api/v1/ocr/reprocess/:documentId` | Reprocess failed doc | Yes (Admin) |
| GET | `/api/v1/ocr/status/:documentId` | Get OCR status | No |
| GET | `/api/v1/ocr/queue/stats` | Get queue statistics | Yes (Admin) |
| GET | `/api/v1/ocr/queue/jobs` | Get recent jobs | Yes (Admin) |
| GET | `/api/v1/ocr/queue/job/:jobId` | Get job status | Yes (Admin) |
| GET | `/api/v1/ocr/documents/stats` | Get document stats | Yes (Admin) |

### Sync Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/v1/sync/appeal/:appealId` | Sync specific appeal | Yes (Admin) |
| POST | `/api/v1/sync/full` | Full sync from TRAIS | Yes (Admin) |
| POST | `/api/v1/sync/incremental` | Incremental sync | Yes (Admin) |
| GET | `/api/v1/sync/status` | Get sync status | Yes (Admin) |
| POST | `/api/v1/sync/test` | Test TRAIS connection | Yes (Admin) |

### Cases Endpoints (Future)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/v1/cases` | List cases | No |
| GET | `/api/v1/cases/:id` | Get case details | No |
| POST | `/api/v1/cases` | Create case | Yes (Admin) |
| PATCH | `/api/v1/cases/:id` | Update case | Yes (Admin) |
| DELETE | `/api/v1/cases/:id` | Delete case | Yes (Admin) |

---

## Configuration

### Environment Variables

Create `.env` file in project root:

```bash
# Application
NODE_ENV=development
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_NAME=trab_search
DB_SYNCHRONIZE=true    # Auto-sync schema (dev only!)
DB_LOGGING=false       # Log SQL queries

# Redis (for queues)
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_REFRESH_EXPIRES_IN=7d

# TRAIS API
TRAIS_BASE_URL=https://trais.mof.go.tz
TRAIS_API_KEY=your_trais_api_key
TRAIS_USERNAME=your_username
TRAIS_PASSWORD=your_password

# Storage
STORAGE_TYPE=local                # local | s3
STORAGE_LOCAL_PATH=./uploads
# S3_BUCKET=
# S3_REGION=

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# OpenAI (optional - currently using local embeddings)
# OPENAI_API_KEY=
# OPENAI_EMBEDDING_MODEL=text-embedding-ada-002
```

### Configuration Schema (`src/config/configuration.ts`)

All environment variables are loaded and validated through the configuration module.

---

## Development Workflow

### Setup

```bash
# 1. Clone repository
git clone <repository-url>
cd case-repository-backend

# 2. Install dependencies
npm install

# 3. Setup PostgreSQL with pgvector
docker-compose up -d postgres  # OR install locally

# 4. Create .env file
cp .env.example .env
# Edit .env with your credentials

# 5. Run database migrations (TypeORM auto-sync in dev)
npm run start:dev

# 6. Access Swagger docs
open http://localhost:3000/api/docs
```

### NPM Scripts

```bash
# Development
npm run start:dev          # Start with hot-reload
npm run start:debug        # Start with debugger

# Production
npm run build              # Compile TypeScript
npm run start:prod         # Run production build

# Testing
npm run test               # Run unit tests
npm run test:watch         # Watch mode
npm run test:cov           # Coverage report
npm run test:e2e           # End-to-end tests

# Linting & Formatting
npm run lint               # ESLint
npm run format             # Prettier
```

### Development Tips

1. **Hot Reload**: Changes auto-reload in dev mode
2. **Debugging**: Use VS Code debugger or `npm run start:debug`
3. **Database Schema**: TypeORM auto-syncs in dev (set `DB_SYNCHRONIZE=true`)
4. **API Testing**: Use Swagger UI at `/api/docs`
5. **Logs**: Check console for detailed logs in dev mode

---

## Deployment

### Docker Deployment

```bash
# 1. Build image
docker build -t trab-backend .

# 2. Run with docker-compose
docker-compose up -d

# 3. View logs
docker-compose logs -f app
```

### `docker-compose.yml` Overview

```yaml
services:
  postgres:     # PostgreSQL 15 with pgvector
  redis:        # Redis for queues
  app:          # NestJS application
```

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Set `DB_SYNCHRONIZE=false` (use migrations)
- [ ] Use strong JWT secrets
- [ ] Configure CORS for production domains
- [ ] Enable HTTPS/SSL
- [ ] Set up reverse proxy (Nginx/Caddy)
- [ ] Configure rate limiting
- [ ] Set up monitoring (PM2, Prometheus, etc.)
- [ ] Enable database backups
- [ ] Configure log rotation
- [ ] Use secrets management (e.g., AWS Secrets Manager)

---

## Troubleshooting

### Common Issues

#### 1. pgvector Extension Not Found

```bash
# Error: extension "vector" does not exist

# Solution: Install pgvector
docker exec -it <postgres-container> psql -U postgres -d trab_search
CREATE EXTENSION vector;
```

#### 2. OCR Processing Fails

```bash
# Error: Tesseract not initialized

# Solution: Ensure eng.traineddata is in project root
# Download from: https://github.com/tesseract-ocr/tessdata
```

#### 3. Embedding Model Download Fails

```bash
# Error: Failed to load embedding model

# Solution: Check internet connection
# Model auto-downloads on first run (~25MB)
# Cached in: ~/.cache/huggingface/
```

#### 4. Database Connection Issues

```bash
# Error: ECONNREFUSED localhost:5432

# Solution: Verify PostgreSQL is running
docker-compose ps
docker-compose up -d postgres
```

#### 5. Port Already in Use

```bash
# Error: Port 3000 is already in use

# Solution: Change PORT in .env or kill process
lsof -ti:3000 | xargs kill -9
```

---

## Performance Optimization

### Database Optimization

1. **Indexes**: All critical columns are indexed
2. **HNSW Index**: Fast vector similarity search
3. **Connection Pooling**: TypeORM connection pool (default: 10)
4. **Query Optimization**: Use raw SQL for complex queries

### Application Optimization

1. **Caching**: Redis for frequent queries (future)
2. **Compression**: Gzip enabled for API responses
3. **Rate Limiting**: 100 requests/minute per IP
4. **Batch Processing**: Batch embeddings generation
5. **Async Processing**: OCR runs in background queue

### Search Performance

| Search Type | Avg Time | Use Case |
|-------------|----------|----------|
| Full-text | 30-50ms | Exact keywords |
| Semantic | 80-120ms | Conceptual search |
| Hybrid | 25-40ms | Best overall results |

---

## Security Considerations

1. **Authentication**: JWT with short expiry (15 min)
2. **Password Hashing**: bcrypt with salt
3. **Input Validation**: class-validator on all DTOs
4. **SQL Injection**: TypeORM parameterized queries
5. **XSS Protection**: Helmet security headers
6. **CORS**: Configured for specific origins
7. **Rate Limiting**: Throttler guards
8. **Account Locking**: After 5 failed login attempts

---

## Future Enhancements

### Planned Features

1. **Advanced Filters**: Date ranges, case types, outcomes
2. **Export Functionality**: PDF, CSV, Excel
3. **Analytics Dashboard**: Case statistics and trends
4. **Email Notifications**: Case updates, alerts
5. **Bulk Upload**: Upload multiple PDFs at once
6. **Case Citations**: Link related cases
7. **Advanced NLP**: Named entity recognition, summarization
8. **Multi-language Support**: Swahili language support
9. **Audit Logs**: Track all user actions
10. **Webhooks**: Real-time notifications

---

## API Documentation

Full interactive API documentation available at:

**Swagger UI**: `http://localhost:3000/api/docs`

Also see: `API_DOCUMENTATION.md` for detailed endpoint documentation

---

## Contributing

### Code Style

- Follow TypeScript best practices
- Use ESLint and Prettier configurations
- Write descriptive commit messages
- Add JSDoc comments for public methods

### Testing

- Write unit tests for services
- E2E tests for API endpoints
- Maintain >80% code coverage

---

## Support & Resources

### Documentation Files

- `README.md` - Project overview and quick start
- `API_DOCUMENTATION.md` - Complete API reference
- `REFERENCE.md` - This technical reference
- `QUICK_REFERENCE.md` - Quick command reference
- `USER_MANAGEMENT_PLAN.md` - User management roadmap
- `FRONTEND_QUICK_START.md` - Frontend integration guide

### External Resources

- [NestJS Documentation](https://docs.nestjs.com/)
- [TypeORM Documentation](https://typeorm.io/)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [Transformers.js](https://huggingface.co/docs/transformers.js)
- [Tesseract.js](https://tesseract.projectnaptha.com/)

---

## License

UNLICENSED - Private/Proprietary

---

**Last Updated**: January 22, 2026
**Maintained By**: TRAB Development Team
