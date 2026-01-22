# Scheduled Tasks Documentation

This document describes the automated scheduled tasks implemented in the TRAB Case Search API.

## Overview

The application uses **@nestjs/schedule** to run automated background tasks that keep the system up-to-date and process documents automatically.

## Configured Scheduled Tasks

### 1. **File Scanner** (Local File Processor)
- **Schedule**: Every 10 minutes (`*/10 * * * *`)
- **Service**: `LocalFileProcessorService`
- **Method**: `handleScheduledFileScan()`
- **Description**: Automatically scans the local directory (`/Users/mwendavano/trab/files`) for unprocessed PDF files

**What it does**:
- Scans for PDF files with pattern `Appeal_*.pdf`
- Checks which files haven't been processed yet
- Imports unprocessed files into the database
- Fetches metadata from TRAIS API
- Copies PDFs to the uploads directory
- Creates case and document records

**Prevents duplicate runs**: Yes (uses `isProcessing` flag)

**Configuration**:
```env
SCHEDULE_FILE_SCAN=*/10 * * * *
```

### 2. **OCR Processor**
- **Schedule**: Every 10 minutes (`*/10 * * * *`)
- **Service**: `OcrService`
- **Method**: `handleScheduledOcrProcessing()`
- **Description**: Automatically processes pending documents with OCR and generates embeddings

**What it does**:
- Finds documents with `OCR_STATUS = PENDING`
- Processes up to 5 documents per run (configurable batch size)
- Extracts text from PDFs page by page
- Generates vector embeddings for semantic search
- Updates full-text search indexes
- Marks documents as `COMPLETED`, `FAILED`, or `MANUAL_REVIEW`

**Prevents duplicate runs**: Yes (uses `isProcessing` flag)

**Configuration**:
```env
SCHEDULE_OCR_PROCESS=*/10 * * * *
OCR_BATCH_SIZE=5
```

### 3. **Incremental Sync**
- **Schedule**: Daily at 2:00 AM (`0 2 * * *`)
- **Service**: `SyncService`
- **Method**: `handleScheduledSync()`
- **Description**: Syncs updated cases from the TRAIS external API

**What it does**:
- Finds the most recent sync date
- Fetches appeals updated since last sync from TRAIS
- Creates new cases or updates existing ones
- Downloads PDF decision documents
- Keeps the database in sync with external system

**Prevents duplicate runs**: Yes (uses `isSyncing` flag)

**Configuration**:
```env
SCHEDULE_INCREMENTAL_SYNC=0 2 * * *
```

## Monitoring Endpoints

### Get Scheduler Status
```bash
GET /api/v1/scheduler/status
```

**Response**:
```json
{
  "enabled": true,
  "scheduledTasks": [
    {
      "name": "File Scanner",
      "schedule": "*/10 * * * *",
      "description": "Scans local directory for unprocessed PDF files and imports them",
      "nextRun": "Every 10 minutes"
    },
    {
      "name": "OCR Processor",
      "schedule": "*/10 * * * *",
      "description": "Processes pending documents with OCR and generates embeddings",
      "nextRun": "Every 10 minutes"
    },
    {
      "name": "Incremental Sync",
      "schedule": "0 2 * * *",
      "description": "Syncs updated cases from TRAIS API",
      "nextRun": "Daily at 2:00 AM"
    }
  ],
  "uptime": 3600.5
}
```

### Get OCR Processing Stats
```bash
GET /api/v1/ocr/documents/stats
```

**Response**:
```json
{
  "total": 100,
  "pending": 20,
  "processing": 2,
  "completed": 75,
  "failed": 2,
  "manualReview": 1
}
```

### Get Local File Stats
```bash
GET /api/v1/sync/local-files/stats
```

**Response**:
```json
{
  "totalFilesInDirectory": 50,
  "processedFiles": 45,
  "unprocessedFiles": 5,
  "files": ["Appeal_12345.pdf", "Appeal_12346.pdf", ...]
}
```

### Get Sync Status
```bash
GET /api/v1/sync/status
```

**Response**:
```json
{
  "isSyncing": false,
  "totalCases": 500,
  "lastSyncDate": "2026-01-22T10:30:00.000Z",
  "casesByStatus": {
    "pending": 10,
    "decided": 480,
    "dismissed": 10
  }
}
```

## Manual Triggers

You can also manually trigger these tasks via API endpoints:

### Trigger File Processing
```bash
POST /api/v1/sync/process-local-files
```

### Trigger OCR Processing
```bash
POST /api/v1/ocr/process/pending
```

### Trigger Full Sync
```bash
POST /api/v1/sync/full
```

### Trigger Incremental Sync
```bash
POST /api/v1/sync/incremental
```

## Cron Expression Format

The schedule uses standard cron syntax:

```
* * * * *
│ │ │ │ │
│ │ │ │ └─ Day of week (0-7, 0 and 7 are Sunday)
│ │ │ └─── Month (1-12)
│ │ └───── Day of month (1-31)
│ └─────── Hour (0-23)
└───────── Minute (0-59)
```

**Common Examples**:
- `*/10 * * * *` - Every 10 minutes
- `0 * * * *` - Every hour at minute 0
- `0 2 * * *` - Daily at 2:00 AM
- `0 0 * * 0` - Weekly on Sunday at midnight
- `0 0 1 * *` - Monthly on the 1st at midnight

## Best Practices

### 1. **Prevent Overlapping Runs**
All scheduled methods use a flag (`isProcessing`, `isSyncing`) to prevent concurrent execution.

### 2. **Batch Processing**
OCR processing limits batch size to avoid overwhelming the system:
```typescript
private readonly batchSize = 5; // Process 5 documents at a time
```

### 3. **Error Handling**
All scheduled tasks wrap their logic in try-catch blocks and log errors without crashing:
```typescript
try {
  // Task logic
} catch (error) {
  this.logger.error('Task failed', error.stack);
} finally {
  this.isProcessing = false;
}
```

### 4. **Logging**
Each task logs:
- Start of execution
- Progress updates
- Completion summary
- Any errors encountered

### 5. **Graceful Skipping**
If no work is available, tasks exit early:
```typescript
if (pendingCount === 0) {
  this.logger.debug('No pending documents for OCR processing');
  return;
}
```

## Customizing Schedules

To change the schedule intervals:

1. **Edit `.env` file**:
```env
SCHEDULE_FILE_SCAN=*/5 * * * *  # Run every 5 minutes instead of 10
SCHEDULE_OCR_PROCESS=0 * * * *  # Run every hour
SCHEDULE_INCREMENTAL_SYNC=0 3 * * *  # Run at 3 AM instead of 2 AM
```

2. **Update the code** (if using hardcoded cron expressions):
```typescript
@Cron(CronExpression.EVERY_5_MINUTES)  // Use built-in expressions
// OR
@Cron('*/5 * * * *')  // Use custom cron string
```

3. **Restart the application** for changes to take effect

## Troubleshooting

### Tasks Not Running
1. Check server logs for cron job execution
2. Verify ScheduleModule is imported in AppModule
3. Check if task is blocked by another running instance
4. Ensure cron expression is valid

### High Resource Usage
1. Reduce batch size for OCR processing
2. Increase interval between runs
3. Limit concurrent task execution

### Files Not Being Processed
1. Check directory permissions
2. Verify file naming pattern matches (`Appeal_*.pdf`)
3. Check logs for specific errors
4. Ensure TRAIS API is accessible

## Logs

Watch logs in real-time:
```bash
tail -f /tmp/trab-server.log | grep -E "File|OCR|Sync"
```

Filter for scheduled tasks only:
```bash
tail -f /tmp/trab-server.log | grep "Running scheduled"
```

## Performance Considerations

- **File Scanner**: Lightweight, scans directory and checks database
- **OCR Processor**: CPU-intensive, limits batch size to 5 documents
- **Incremental Sync**: Network-dependent, fetches from external API

## Summary

The scheduled tasks automate:
1. ✅ **File ingestion** - New PDFs are imported automatically
2. ✅ **Text extraction** - Documents are OCR'd and indexed
3. ✅ **Data synchronization** - Cases stay up-to-date with TRAIS

This ensures the case repository is always current with minimal manual intervention.
