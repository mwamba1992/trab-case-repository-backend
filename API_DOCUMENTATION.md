# TRAB Case Repository API Documentation

**Base URL:** `http://localhost:3000/api/v1`

**Version:** 1.0.0

**Last Updated:** January 21, 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Search API](#search-api)
4. [OCR Processing API](#ocr-processing-api)
5. [Sync API](#sync-api)
6. [Data Models](#data-models)
7. [Error Handling](#error-handling)

---

## Overview

The TRAB Case Repository API provides access to Tax Revenue Appeals Board case documents with:
- **Hybrid Search** (Full-text + Semantic Vector Search)
- **OCR Processing** (Tesseract.js for scanned PDFs)
- **Page-level Results** (Shows exact page where match was found)
- **Case Metadata** (Case number, parties, judges, tax amounts, etc.)

### Technology Stack
- **Database:** PostgreSQL 15+ with pgvector extension
- **OCR:** Tesseract.js (scanned PDF support)
- **Embeddings:** Transformers.js (local, no API costs)
- **Search:** PostgreSQL Full-Text Search + pgvector cosine similarity

---

## Authentication

🔒 **Status:** Not yet implemented

Authentication will be added in the next phase. Currently, all endpoints are open.

---

## Search API

### Base Endpoint
`GET /search`

### 1. Hybrid Search (Recommended)

Combines full-text and semantic search for best results.

**Endpoint:** `GET /search` or `GET /search/hybrid`

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `q` | string | Yes | - | Search query |
| `limit` | number | No | 10 | Maximum number of results (max: 100) |
| `ftWeight` | number | No | 0.5 | Full-text search weight (0-1) |
| `semWeight` | number | No | 0.5 | Semantic search weight (0-1) |

**Example Request:**
```bash
GET /api/v1/search?q=customs%20excise&limit=5
```

**Example Response:**
```json
{
  "query": "customs excise",
  "results": [
    {
      "documentId": "0e1af860-9a18-418b-a593-9005729559a4",
      "documentName": "Appeal_46577.pdf",
      "caseId": "f579f9dc-4335-4e95-84de-a296096cb37a",
      "pageNumber": 1,
      "content": "IN THE TAX REVENUE APPEALS BOARD CONSOLIDATED CUSTOMS & EXCISE TAX APPEALS NO. 37, 38, 40, 41 OF 2024...",
      "score": 0.169,
      "matchType": "hybrid",
      "caseMetadata": {
        "caseNumber": "DSM.211/2024",
        "caseType": "vat",
        "appellant": "INTERGRITY SECURITY COMPANY LIMITED",
        "respondent": "COMM GENERAL",
        "filingDate": "2024-10-29T21:00:00.000Z",
        "hearingDate": "2024-12-03T21:00:00.000Z",
        "decisionDate": "2025-01-14T21:00:00.000Z",
        "status": "pending",
        "outcome": "allowed",
        "taxAmountDisputed": 88828575,
        "chairperson": "C.J David",
        "boardMembers": [
          "A.T Millanzi",
          "Mr. G. I Mnyitafu",
          "Dr. S.J Suluo"
        ]
      }
    }
  ],
  "totalResults": 1,
  "searchType": "hybrid",
  "executionTimeMs": 25
}
```

---

### 2. Full-Text Search

Best for exact keyword matching.

**Endpoint:** `GET /search/full-text`

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `q` | string | Yes | - | Search query |
| `limit` | number | No | 10 | Maximum number of results |

**Example Request:**
```bash
GET /api/v1/search/full-text?q=tax%20revenue&limit=5
```

**Use Cases:**
- Searching for specific legal terms
- Finding exact case numbers
- Searching for specific statutes or sections

**Performance:** ~30-50ms

---

### 3. Semantic Search

Best for conceptual/meaning-based search.

**Endpoint:** `GET /search/semantic`

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `q` | string | Yes | - | Search query |
| `limit` | number | No | 10 | Maximum number of results |

**Example Request:**
```bash
GET /api/v1/search/semantic?q=what%20is%20the%20limitation%20period&limit=5
```

**Use Cases:**
- Natural language questions
- Finding similar concepts
- Searching by meaning rather than exact words

**Performance:** ~80-120ms (includes embedding generation)

---

## OCR Processing API

### Base Endpoint
`/ocr`

### 1. Process All Pending Documents

Queue all pending documents for OCR processing.

**Endpoint:** `POST /ocr/process/pending`

**Example Request:**
```bash
POST /api/v1/ocr/process/pending
```

**Example Response:**
```json
{
  "queued": 2,
  "documents": [
    "Appeal_46575.pdf",
    "Appeal_46577.pdf"
  ],
  "jobs": [
    {
      "id": "job_1_1769016599408",
      "documentId": "e9f1042a-f4e1-424f-a108-28749904ef10",
      "caseId": "b673bccb-4872-497b-86f6-9f88266b2b82",
      "fileName": "Appeal_46575.pdf",
      "status": "active",
      "progress": 10,
      "createdAt": "2026-01-21T17:29:59.408Z",
      "startedAt": "2026-01-21T17:29:59.411Z"
    }
  ]
}
```

---

### 2. Process Specific Document

Queue a specific document for OCR processing.

**Endpoint:** `POST /ocr/process/:documentId`

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `documentId` | UUID | Yes | Document UUID |

**Example Request:**
```bash
POST /api/v1/ocr/process/e9f1042a-f4e1-424f-a108-28749904ef10
```

**Example Response:**
```json
{
  "jobId": "job_1_1769016061927",
  "fileName": "Appeal_46575.pdf",
  "job": {
    "id": "job_1_1769016061927",
    "documentId": "e9f1042a-f4e1-424f-a108-28749904ef10",
    "caseId": "b673bccb-4872-497b-86f6-9f88266b2b82",
    "fileName": "Appeal_46575.pdf",
    "status": "active",
    "progress": 10,
    "createdAt": "2026-01-21T17:16:35.717Z",
    "startedAt": "2026-01-21T17:16:35.717Z"
  }
}
```

---

### 3. Reprocess Failed Document

Reset and reprocess a failed document.

**Endpoint:** `POST /ocr/reprocess/:documentId`

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `documentId` | UUID | Yes | Document UUID |

**Example Request:**
```bash
POST /api/v1/ocr/reprocess/e9f1042a-f4e1-424f-a108-28749904ef10
```

---

### 4. Get Document OCR Status

Check OCR processing status for a specific document.

**Endpoint:** `GET /ocr/status/:documentId`

**Example Request:**
```bash
GET /api/v1/ocr/status/e9f1042a-f4e1-424f-a108-28749904ef10
```

**Example Response:**
```json
{
  "status": "completed",
  "pageCount": 9,
  "processedPages": 9,
  "error": null
}
```

**OCR Statuses:**
- `pending` - Not yet processed
- `processing` - Currently being processed
- `completed` - Successfully completed
- `failed` - Processing failed
- `manual_review` - Some pages failed, needs review

---

### 5. Get Queue Statistics

Get OCR queue statistics.

**Endpoint:** `GET /ocr/queue/stats`

**Example Response:**
```json
{
  "waiting": 0,
  "active": 1,
  "completed": 10,
  "failed": 0,
  "total": 11
}
```

---

### 6. Get Recent Jobs

Get recent OCR processing jobs.

**Endpoint:** `GET /ocr/queue/jobs`

**Example Response:**
```json
{
  "jobs": [
    {
      "id": "job_1_1769016061927",
      "documentId": "e9f1042a-f4e1-424f-a108-28749904ef10",
      "caseId": "b673bccb-4872-497b-86f6-9f88266b2b82",
      "fileName": "Appeal_46575.pdf",
      "status": "completed",
      "progress": 100,
      "createdAt": "2026-01-21T17:16:35.717Z",
      "startedAt": "2026-01-21T17:16:35.717Z",
      "completedAt": "2026-01-21T17:16:35.743Z",
      "result": {
        "documentId": "e9f1042a-f4e1-424f-a108-28749904ef10",
        "totalPages": 9,
        "processedPages": 9,
        "failedPages": 0,
        "avgConfidence": 0,
        "status": "completed"
      }
    }
  ]
}
```

---

### 7. Get Job Status

Get status of a specific OCR job.

**Endpoint:** `GET /ocr/queue/job/:jobId`

**Example Request:**
```bash
GET /api/v1/ocr/queue/job/job_1_1769016061927
```

---

### 8. Get Document Processing Statistics

Get overall document processing statistics.

**Endpoint:** `GET /ocr/documents/stats`

**Example Response:**
```json
{
  "total": 50,
  "pending": 5,
  "processing": 2,
  "completed": 40,
  "failed": 2,
  "manualReview": 1
}
```

---

## Sync API

### Sync Specific Appeal from TRAIS

Sync a specific appeal from TRAIS API.

**Endpoint:** `POST /sync/appeal/:appealId`

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `appealId` | number | Yes | TRAIS Appeal ID |

**Example Request:**
```bash
POST /api/v1/sync/appeal/46575
```

**Note:** This endpoint syncs case metadata from TRAIS and creates document records. PDF files are processed from local directory `/Users/mwendavano/trab/files/`.

---

## Data Models

### SearchResult

```typescript
interface SearchResult {
  documentId: string;           // Document UUID
  documentName: string;         // e.g., "Appeal_46575.pdf"
  caseId: string;              // Case UUID
  pageNumber: number;          // Page where match was found (1-based)
  content: string;             // Text snippet with context
  score: number;               // Relevance score (0-1)
  matchType: 'full-text' | 'semantic' | 'hybrid';
  caseMetadata: CaseMetadata;
}
```

### CaseMetadata

```typescript
interface CaseMetadata {
  caseNumber: string;          // e.g., "DSM.211/2024"
  caseType: string;            // "income_tax" | "vat" | "customs" | "excise" | "stamp_duty" | "other"
  appellant: string;           // Appellant name
  respondent: string;          // Usually "COMM GENERAL"
  filingDate: string | null;   // ISO 8601 date
  hearingDate: string | null;  // ISO 8601 date
  decisionDate: string | null; // ISO 8601 date
  status: string;              // "pending" | "decided" | "appealed" | "withdrawn" | "settled"
  outcome: string | null;      // "allowed" | "dismissed" | "partially_allowed" | "remanded" | "other"
  taxAmountDisputed: number | null;  // Amount in TZS
  chairperson: string | null;  // Judge/Chairperson name
  boardMembers: string[] | null;     // Array of board member names
}
```

### SearchResponse

```typescript
interface SearchResponse {
  query: string;               // Original search query
  results: SearchResult[];     // Array of search results
  totalResults: number;        // Total number of results returned
  searchType: 'full-text' | 'semantic' | 'hybrid';
  executionTimeMs: number;     // Query execution time in milliseconds
}
```

### OCR Job

```typescript
interface QueueJob {
  id: string;                  // Job ID (e.g., "job_1_1769016061927")
  documentId: string;          // Document UUID
  caseId: string;             // Case UUID
  fileName: string;           // e.g., "Appeal_46575.pdf"
  status: 'waiting' | 'active' | 'completed' | 'failed';
  progress: number;           // 0-100
  createdAt: string;          // ISO 8601 timestamp
  startedAt?: string;         // ISO 8601 timestamp
  completedAt?: string;       // ISO 8601 timestamp
  result?: OcrResult;
  error?: string;
}
```

### OCR Result

```typescript
interface OcrResult {
  documentId: string;
  totalPages: number;          // Total pages in document
  processedPages: number;      // Successfully processed pages
  failedPages: number;         // Failed pages
  avgConfidence: number;       // Average OCR confidence (0-1)
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'manual_review';
  error?: string;
}
```

---

## Error Handling

### Error Response Format

```json
{
  "statusCode": 500,
  "message": "Error description",
  "error": "Internal Server Error"
}
```

### Common HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request successful |
| 202 | Accepted | Request accepted (async operations) |
| 400 | Bad Request | Invalid request parameters |
| 404 | Not Found | Resource not found |
| 500 | Internal Server Error | Server error |

---

## Examples

### Example 1: Search for Cases About Limitation Period

```bash
# Using hybrid search (recommended)
curl "http://localhost:3000/api/v1/search?q=limitation%20period&limit=3"
```

**Response:**
```json
{
  "query": "limitation period",
  "results": [
    {
      "documentName": "Appeal_46575.pdf",
      "pageNumber": 7,
      "score": 0.378,
      "caseMetadata": {
        "caseNumber": "DSM.41/2024",
        "caseType": "customs",
        "appellant": "INTERGRITY SECURITY COMPANY LIMITED",
        "chairperson": "A.T Millanzi",
        "boardMembers": ["Mr. G. I Mnyitafu", "Dr. S.J Suluo"]
      }
    }
  ],
  "totalResults": 1,
  "searchType": "hybrid",
  "executionTimeMs": 35
}
```

---

### Example 2: Process All Pending Documents

```bash
# Queue all pending documents
curl -X POST "http://localhost:3000/api/v1/ocr/process/pending"

# Check queue status
curl "http://localhost:3000/api/v1/ocr/queue/stats"

# Get document statistics
curl "http://localhost:3000/api/v1/ocr/documents/stats"
```

---

### Example 3: Search with Custom Weights

```bash
# Emphasize semantic search (70%) over full-text (30%)
curl "http://localhost:3000/api/v1/search/hybrid?q=tax%20appeals&ftWeight=0.3&semWeight=0.7&limit=5"
```

---

## Performance Benchmarks

| Operation | Average Time | Notes |
|-----------|--------------|-------|
| Hybrid Search | 25-40ms | Depends on result count |
| Full-Text Search | 30-50ms | Fast keyword matching |
| Semantic Search | 80-120ms | Includes embedding generation |
| OCR Processing | 5-10s/page | Depends on image quality |

---

## Swagger/OpenAPI Documentation

Interactive API documentation is available at:

**URL:** `http://localhost:3000/api/docs`

---

## Rate Limits

⚠️ **Current:** 100 requests per minute per IP

Rate limiting will be refined in future versions.

---

## Support & Contact

**Project:** TRAB Case Repository Backend
**Version:** 1.0.0
**Framework:** NestJS 10.x
**Database:** PostgreSQL 15+ with pgvector

---

## Roadmap

### Coming Next:
1. ✅ Search API - **COMPLETED**
2. ✅ OCR Processing - **COMPLETED**
3. 🔄 User Management - **IN PROGRESS**
4. 📋 Authentication & Authorization
5. 📋 Cases CRUD API
6. 📋 Advanced Filters (date range, case type, outcome)
7. 📋 Export functionality (PDF, CSV)
8. 📋 Analytics & Statistics

---

## Changelog

### v1.0.0 (2026-01-21)
- ✅ Hybrid search implementation (Full-text + Semantic)
- ✅ OCR processing with Tesseract.js
- ✅ Page-level search results
- ✅ Case metadata integration
- ✅ Separated chairperson and board members
- ✅ Local embeddings with Transformers.js
- ✅ In-memory queue system

---

**Last Updated:** January 21, 2026
