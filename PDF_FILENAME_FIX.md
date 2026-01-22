# PDF Filename Fix - Duplicate Appeal Numbers

**Date**: January 22, 2026
**Status**: ✅ Fixed
**Issue Type**: File Overwrite Bug

---

## Problem Description

The system was using appeal numbers (e.g., `DSM.41/2024`) as PDF filenames, which caused overwrites when different tax types had the same appeal number.

### Example Scenario

1. **Case 1**: DSM.41/2024 for **VAT**
   - File saved as: `DSM_41_2024.pdf` ✓

2. **Case 2**: DSM.41/2024 for **Income Tax**
   - File saved as: `DSM_41_2024.pdf` ❌ **OVERWRITES Case 1's file!**

### Root Cause

Appeal numbers are **not unique** across the system. The TRAIS system allows the same appeal number for different tax types, leading to file naming conflicts.

**Affected Files**:
- `src/modules/sync/sync.service.ts:272` - TRAIS sync downloads
- `src/modules/sync/services/local-file-processor.service.ts:183` - Local file processing

---

## Solution

### Change Summary

Replace appeal-number-based filenames with **UUID-based filenames** using the case `id` field.

**Old Approach**:
```typescript
const sanitizedFileName = appeal.appealNo.replace(/[^a-zA-Z0-9-]/g, '_');
const pdfPath = path.join(uploadsDir, `${sanitizedFileName}.pdf`);
// Result: DSM_41_2024.pdf (can duplicate!)
```

**New Approach**:
```typescript
// Use case UUID as filename to ensure uniqueness
const pdfPath = path.join(uploadsDir, `${caseId}.pdf`);
// Result: f579f9dc-4335-4e95-84de-a296096cb37a.pdf (guaranteed unique)
```

### Benefits

✅ **Uniqueness**: Each case has a unique UUID, preventing any overwrites
✅ **Consistency**: All PDFs follow the same naming pattern
✅ **Scalability**: Works regardless of how many cases share appeal numbers
✅ **Database Integrity**: PDF URLs stored in database match actual files

---

## Files Changed

### 1. `src/modules/sync/sync.service.ts`

**Location**: `downloadPdfForCase()` method (lines 268-286)

**Before**:
```typescript
const sanitizedFileName = appeal.appealNo.replace(/[^a-zA-Z0-9-]/g, '_');
const pdfPath = path.join(uploadsDir, `${sanitizedFileName}.pdf`);
```

**After**:
```typescript
// Use case UUID as filename to ensure uniqueness
// Appeal numbers can be duplicated across different tax types
// Format: {caseId}.pdf (UUID ensures uniqueness)
const pdfPath = path.join(uploadsDir, `${caseId}.pdf`);
```

---

### 2. `src/modules/sync/services/local-file-processor.service.ts`

**Location**: `copyPdfToUploads()` method (lines 169-199)

**Before**:
```typescript
private async copyPdfToUploads(
  filename: string,
  appealNo: string,  // ❌ Used appeal number
): Promise<{ path: string; url: string; hash: string; size: number }> {
  const sanitizedFileName = appealNo.replace(/[^a-zA-Z0-9-]/g, '_');
  const destPath = path.join(uploadsDir, `${sanitizedFileName}.pdf`);
}
```

**After**:
```typescript
private async copyPdfToUploads(
  filename: string,
  caseId: string,  // ✅ Now uses case UUID
): Promise<{ path: string; url: string; hash: string; size: number }> {
  // Use case UUID as filename to ensure uniqueness
  const destPath = path.join(uploadsDir, `${caseId}.pdf`);
}
```

---

## Migration Guide

### For Existing Files

A migration script has been created to rename existing PDF files.

**Script**: `scripts/migrate-pdf-filenames.ts`

**Usage**:
```bash
# 1. Backup existing files
cp -r uploads/decisions uploads/decisions.backup

# 2. Run migration
npx ts-node scripts/migrate-pdf-filenames.ts

# 3. Verify results
ls -lah uploads/decisions/
```

**What it does**:
1. Reads all cases with PDFs from database
2. Renames files from `DSM_41_2024.pdf` to `<uuid>.pdf`
3. Updates `pdf_url` in database to match new filenames
4. Reports results (renamed, skipped, failed)

**Output Example**:
```
✓ Renamed: DSM_41_2024.pdf → f579f9dc-4335-4e95-84de-a296096cb37a.pdf
  Case: DSM.41/2024 (f579f9dc-4335-4e95-84de-a296096cb37a)

📊 Migration Summary:
  ✓ Renamed: 2
  ⚠ Skipped: 0
  ✗ Failed: 0
```

### For New Syncs

No action needed! All new TRAIS syncs and local file processing will automatically use UUID-based filenames.

---

## Testing

### Test Scenario 1: Same Appeal Number, Different Tax Types

```bash
# Sync appeal DSM.41/2024 for VAT
POST /api/v1/sync/appeal/46575

# Sync appeal DSM.41/2024 for Income Tax
POST /api/v1/sync/appeal/46577

# Verify both files exist with different UUIDs
ls uploads/decisions/
# Output:
# f579f9dc-4335-4e95-84de-a296096cb37a.pdf  (VAT case)
# b673bccb-4872-497b-86f6-9f88266b2b82.pdf  (Income Tax case)
```

### Test Scenario 2: Local File Processing

```bash
# Process local PDF files
# Files in /Users/mwendavano/trab/files/:
# - Appeal_46575.pdf (DSM.41/2024 - VAT)
# - Appeal_46577.pdf (DSM.41/2024 - Income Tax)

# After processing, check uploads:
ls uploads/decisions/
# Output:
# <uuid-1>.pdf  (from Appeal_46575.pdf)
# <uuid-2>.pdf  (from Appeal_46577.pdf)
```

---

## Verification Checklist

After deploying this fix:

- [ ] Run the migration script on production database
- [ ] Verify all existing PDFs are accessible via API
- [ ] Test TRAIS sync with duplicate appeal numbers
- [ ] Test local file processing with duplicate appeal numbers
- [ ] Verify search results return correct PDF URLs
- [ ] Check OCR processing works with new filenames
- [ ] Delete backup files once confirmed working

---

## Technical Details

### Database Schema

The `cases` table stores the PDF URL:

```sql
CREATE TABLE cases (
  id UUID PRIMARY KEY,
  case_number VARCHAR NOT NULL,
  pdf_url VARCHAR,  -- Now stores: /uploads/decisions/{uuid}.pdf
  pdf_hash VARCHAR,
  ...
);
```

### File Storage

**Directory**: `uploads/decisions/`

**Old Format**: `{sanitized_appeal_number}.pdf`
- Example: `DSM_41_2024.pdf`
- Problem: Can duplicate

**New Format**: `{case_uuid}.pdf`
- Example: `f579f9dc-4335-4e95-84de-a296096cb37a.pdf`
- Guaranteed unique

---

## Impact Analysis

### Affected Components

1. **✅ TRAIS Sync** (`sync.service.ts`)
   - Fixed: Now uses UUID for downloads

2. **✅ Local File Processor** (`local-file-processor.service.ts`)
   - Fixed: Now uses UUID for file copies

3. **✅ Search Results** (No changes needed)
   - Already uses `pdf_url` from database

4. **✅ OCR Processing** (No changes needed)
   - Uses file path from `CaseDocument` entity

5. **✅ API Responses** (No changes needed)
   - Returns `pdf_url` from database

### Breaking Changes

**For API Consumers**:
- ⚠️ PDF URLs will change format after migration
- Old: `/uploads/decisions/DSM_41_2024.pdf`
- New: `/uploads/decisions/f579f9dc-4335-4e95-84de-a296096cb37a.pdf`

**Recommendation**: API consumers should use the `pdf_url` field from API responses rather than constructing URLs manually.

---

## Future Considerations

### Alternative Solutions Considered

1. **Include tax type in filename**
   - Example: `DSM_41_2024_VAT.pdf`
   - Rejected: Still possible to have edge cases with consolidated appeals

2. **Use appeal ID from TRAIS**
   - Example: `Appeal_46575.pdf`
   - Rejected: Not as clear as UUID, and TRAIS IDs might not be unique across systems

3. **Use case UUID** ✅ **SELECTED**
   - Example: `f579f9dc-4335-4e95-84de-a296096cb37a.pdf`
   - Benefits: Guaranteed unique, consistent, scalable

### Enhancements

Possible future enhancements:

1. **Metadata Service**: Create a mapping service to resolve UUIDs to human-readable names
2. **Download Endpoint**: Add API endpoint like `GET /api/v1/cases/:id/pdf` that serves the file with original case number as filename
3. **Archive System**: Implement versioning if PDFs are updated

---

## References

- **Issue Location**: `/Users/mwendavano/trab/case-repository-backend/uploads/decisions/`
- **Migration Script**: `scripts/migrate-pdf-filenames.ts`
- **Migration Guide**: `scripts/README.md`
- **Modified Files**:
  - `src/modules/sync/sync.service.ts`
  - `src/modules/sync/services/local-file-processor.service.ts`

---

**Last Updated**: January 22, 2026
**Author**: Development Team
**Status**: ✅ Implemented and Ready for Testing
