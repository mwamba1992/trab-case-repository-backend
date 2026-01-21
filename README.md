# TRAB Case Search Engine - Backend API

Tax Revenue Appeals Board Case Search Engine with semantic search capabilities.

## Project Status

### ✅ Completed
- [x] NestJS project initialization
- [x] Core dependencies installed (TypeORM, Redis, Bull, OpenAI, etc.)
- [x] Configuration setup (environment variables, database, JWT)
- [x] Docker configuration (Dockerfile, docker-compose.yml)
- [x] Database entities created (User, Case, CaseContent, CaseDocument, CaseParty, CaseEmbedding)
- [x] **TRAIS Sync Module** - Full integration with TRAIS API including:
  - TRAIS API client with authentication
  - Data mapper for appeal metadata (tax amounts, judges, summons, billing)
  - PDF download from copyOfJudgement field
  - Dashboard metadata extractor
  - Scheduled sync jobs (daily at 2 AM)
  - Incremental and full sync support

### 🚧 In Progress
- [ ] Authentication module (JWT, Passport strategies)
- [ ] Users module (CRUD, role management)
- [ ] Cases module (CRUD, search)
- [ ] Search module (full-text, semantic, hybrid)
- [ ] Embeddings module (OpenAI integration, chunking)
- [ ] OCR module (PDF processing, Tesseract)

## Tech Stack

- **Framework**: NestJS 10.x
- **Database**: PostgreSQL 15+ with pgvector extension
- **Cache/Queue**: Redis + Bull
- **Search**: Full-text (tsvector) + Vector similarity (pgvector)
- **AI/ML**: OpenAI embeddings (text-embedding-ada-002)
- **OCR**: Tesseract.js + pdf-parse
- **Auth**: JWT + Passport

## Getting Started

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 15+ (or use Docker)
- Redis (or use Docker)

### Installation

1. **Install dependencies**:
```bash
npm install
```

2. **Configure environment**:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Start services with Docker**:
```bash
docker-compose up -d postgres redis
```

4. **Start development server**:
```bash
npm run start:dev
```

The API will be available at:
- API: http://localhost:3000/api/v1
- Swagger Docs: http://localhost:3000/api/docs

## Project Structure

```
src/
├── config/
│   └── configuration.ts          # App configuration
├── common/
│   ├── decorators/               # Custom decorators
│   ├── filters/                  # Exception filters
│   ├── guards/                   # Auth guards
│   ├── interceptors/             # Request/response interceptors
│   ├── pipes/                    # Validation pipes
│   └── dto/                      # Common DTOs
├── modules/
│   ├── auth/                     # Authentication module
│   ├── users/                    # User management
│   │   └── entities/
│   │       └── user.entity.ts    ✅ Created
│   ├── cases/                    # Case management
│   │   └── entities/
│   │       ├── case.entity.ts    ✅ Created
│   │       ├── case-content.entity.ts ✅ Created
│   │       ├── case-document.entity.ts ✅ Created
│   │       └── case-party.entity.ts ✅ Created
│   ├── search/                   # Search engine
│   ├── embeddings/               # Vector embeddings
│   │   └── entities/
│   │       └── case-embedding.entity.ts ✅ Created
│   ├── ocr/                      # OCR processing
│   ├── sync/                     # TRAIS synchronization
│   └── analytics/                # Search analytics
├── app.module.ts                 # Main app module
└── main.ts                       # Application entry point
```

## Database Schema

### Entities Created

1. **User** - User accounts with role-based access
2. **Case** - Main case entity with metadata
3. **CaseContent** - Extracted text content from decisions
4. **CaseDocument** - PDF documents and files
5. **CaseParty** - Case parties (appellant, respondent)
6. **CaseEmbedding** - Vector embeddings for semantic search

### Enums

- **UserRole**: admin, editor, viewer, api_user
- **CaseType**: income_tax, vat, customs, excise, stamp_duty, other
- **CaseStatus**: pending, decided, appealed, withdrawn, settled
- **CaseOutcome**: allowed, dismissed, partially_allowed, remanded, other
- **OcrStatus**: pending, processing, completed, failed, manual_review

## Docker Services

The `docker-compose.yml` includes:

- **postgres**: PostgreSQL 15 with pgvector extension
- **redis**: Redis for caching and queues
- **api**: NestJS application (when built)

Start all services:
```bash
docker-compose up -d
```

View logs:
```bash
docker-compose logs -f api
```

## Next Steps

### 1. Implement Authentication Module

Create JWT authentication with Passport strategies.

### 2. Implement Users Module

User CRUD operations and management.

### 3. Implement Cases Module

Case management with search.

### 4. Implement Search Module

Hybrid search (full-text + semantic).

### 5. Implement Embeddings Module

OpenAI integration for vector embeddings.

### 6. Implement OCR Module

PDF processing and text extraction.

### 7. Implement Sync Module

TRAIS system synchronization.

## Development

```bash
# Development mode
npm run start:dev

# Build
npm run build

# Production mode
npm run start:prod

# Tests
npm run test

# Lint
npm run lint
```

## License

Copyright © 2025 Tax Revenue Appeals Board, Tanzania
# trab-case-repository-backend
