# Quick Reference Guide

## 🚀 Start Application

```bash
npm run start:dev          # Development mode with watch
npm run build             # Build for production
npm run start             # Production mode
```

**URL:** `http://localhost:3000`
**API Docs:** `http://localhost:3000/api/docs`

---

## 🔍 Search API (Ready to Use)

### Hybrid Search (Recommended)
```bash
curl "http://localhost:3000/api/v1/search?q=tax%20revenue&limit=5"
```

### Full-Text Search
```bash
curl "http://localhost:3000/api/v1/search/full-text?q=appellant&limit=5"
```

### Semantic Search
```bash
curl "http://localhost:3000/api/v1/search/semantic?q=what%20is%20limitation%20period&limit=5"
```

---

## 📄 OCR API (Ready to Use)

### Process All Pending Documents
```bash
curl -X POST "http://localhost:3000/api/v1/ocr/process/pending"
```

### Get Document Statistics
```bash
curl "http://localhost:3000/api/v1/ocr/documents/stats"
```

### Get Queue Statistics
```bash
curl "http://localhost:3000/api/v1/ocr/queue/stats"
```

### Check Document Status
```bash
curl "http://localhost:3000/api/v1/ocr/status/{documentId}"
```

---

## 🗄️ Database Commands

### Connect to Database
```bash
PGPASSWORD=amtz psql -U amtz -d trab_case -h localhost
```

### Common Queries
```sql
-- Check processed documents
SELECT file_name, page_count, ocr_status
FROM case_documents;

-- Check search content
SELECT document_id, page_number, word_count
FROM case_content
ORDER BY document_id, page_number;

-- Check cases
SELECT case_number, case_type, appellant, chairperson
FROM cases;

-- Count total pages
SELECT COUNT(*) as total_pages FROM case_content;
```

### Create pgvector Extension
```bash
PGPASSWORD=amtz psql -U amtz -d trab_case -h localhost -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

---

## 📦 Useful NPM Commands

```bash
npm install                  # Install dependencies
npm run build               # Build project
npm run start:dev           # Development mode
npm run start:prod          # Production mode
npm run typeorm migration:create -- -n MigrationName
npm run typeorm migration:run
npm run typeorm migration:revert
```

---

## 🔧 Environment Variables

**File:** `.env`

Key variables:
```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=amtz
DB_PASSWORD=amtz
DB_NAME=trab_case
DB_SYNCHRONIZE=true

JWT_SECRET=your-super-secret-jwt-key-min-32-chars-change-this
JWT_EXPIRES_IN=15m

TRAIS_BASE_URL=https://trais.mof.go.tz:8443
```

---

## 📊 Check System Status

### Application Health
```bash
curl "http://localhost:3000/api/v1/ocr/documents/stats"
```

### Database Connection
```bash
PGPASSWORD=amtz psql -U amtz -d trab_case -h localhost -c "SELECT version();"
```

### Check pgvector
```bash
PGPASSWORD=amtz psql -U amtz -d trab_case -h localhost -c "SELECT * FROM pg_extension WHERE extname='vector';"
```

---

## 🧪 Test Endpoints

### Search Test
```bash
# Should return results about tax revenue
curl "http://localhost:3000/api/v1/search?q=tax%20revenue&limit=2" | jq .
```

### OCR Test
```bash
# Get current stats
curl "http://localhost:3000/api/v1/ocr/documents/stats" | jq .

# Queue all pending
curl -X POST "http://localhost:3000/api/v1/ocr/process/pending" | jq .
```

### Sync Test
```bash
# Sync specific appeal from TRAIS
curl -X POST "http://localhost:3000/api/v1/sync/appeal/46575"
```

---

## 📁 Important Files

### Documentation
- `API_DOCUMENTATION.md` - Full API reference
- `FRONTEND_QUICK_START.md` - Frontend integration guide
- `USER_MANAGEMENT_PLAN.md` - Auth implementation plan
- `SESSION_SUMMARY.md` - What's completed
- `QUICK_REFERENCE.md` - This file

### Configuration
- `.env` - Environment variables
- `src/config/configuration.ts` - Config loader
- `src/app.module.ts` - Main app module

### Entities
- `src/modules/users/entities/user.entity.ts`
- `src/modules/cases/entities/case.entity.ts`
- `src/modules/cases/entities/case-document.entity.ts`
- `src/modules/cases/entities/case-content.entity.ts`

### Services
- `src/modules/search/search.service.ts` - Search logic
- `src/modules/ocr/ocr.service.ts` - OCR processing
- `src/modules/embeddings/embeddings.service.ts` - Embeddings

---

## 🐛 Troubleshooting

### Port Already in Use
```bash
lsof -ti:3000 | xargs kill -9
```

### Reset Database
```bash
PGPASSWORD=amtz psql -U amtz -d trab_case -h localhost -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
npm run start:dev  # Recreates tables
```

### Clear OCR Queue
```bash
# Queue is in-memory, just restart the app
npm run start:dev
```

### Check Application Logs
```bash
# Watch logs in development
npm run start:dev

# Check for errors
grep ERROR dist/*.js
```

---

## 📈 Performance Monitoring

### Check Search Performance
```bash
# Returns executionTimeMs in response
curl "http://localhost:3000/api/v1/search?q=test" | jq .executionTimeMs
```

### Check Database Performance
```sql
-- Slow query log
SELECT * FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;

-- Index usage
SELECT * FROM pg_stat_user_indexes;
```

---

## 🔐 Security Checklist

- [ ] Change JWT_SECRET in production
- [ ] Change JWT_REFRESH_SECRET in production
- [ ] Set DB_SYNCHRONIZE=false in production
- [ ] Configure proper CORS_ORIGINS
- [ ] Enable HTTPS
- [ ] Set up rate limiting
- [ ] Configure firewall rules
- [ ] Set up monitoring/logging

---

## 📞 Quick API Examples

### Search with jq Formatting
```bash
curl -s "http://localhost:3000/api/v1/search?q=customs&limit=2" | jq '.results[] | {case: .caseMetadata.caseNumber, page: .pageNumber, score}'
```

### Count Documents by Status
```bash
curl -s "http://localhost:3000/api/v1/ocr/documents/stats" | jq '{total, completed, failed, pending}'
```

### Get Recent Jobs
```bash
curl -s "http://localhost:3000/api/v1/ocr/queue/jobs" | jq '.jobs[] | {fileName, status, progress}'
```

---

## ⚡ Quick Wins

### Process Documents
```bash
# 1. Check stats
curl "http://localhost:3000/api/v1/ocr/documents/stats"

# 2. Process all pending
curl -X POST "http://localhost:3000/api/v1/ocr/process/pending"

# 3. Wait 2 minutes, check again
sleep 120 && curl "http://localhost:3000/api/v1/ocr/documents/stats"
```

### Test All Search Types
```bash
# Full-text
curl "http://localhost:3000/api/v1/search/full-text?q=tax" | jq '.executionTimeMs'

# Semantic
curl "http://localhost:3000/api/v1/search/semantic?q=tax" | jq '.executionTimeMs'

# Hybrid
curl "http://localhost:3000/api/v1/search?q=tax" | jq '.executionTimeMs'
```

---

## 🎓 Learning Resources

### NestJS
- Official Docs: https://docs.nestjs.com
- Authentication: https://docs.nestjs.com/security/authentication

### PostgreSQL
- pgvector: https://github.com/pgvector/pgvector
- Full-text search: https://www.postgresql.org/docs/current/textsearch.html

### Embeddings
- Transformers.js: https://huggingface.co/docs/transformers.js

---

**Last Updated:** January 21, 2026
