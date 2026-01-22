# Migration Scripts

This directory contains utility scripts for database and file system migrations.

## PDF Filename Migration

### Problem

The original implementation used appeal numbers for PDF filenames (e.g., `DSM_41_2024.pdf`). However, **appeal numbers can be duplicated across different tax types**, causing file overwrites:

- `DSM.41/2024` for VAT → `DSM_41_2024.pdf`
- `DSM.41/2024` for Income Tax → `DSM_41_2024.pdf` (OVERWRITES!)

### Solution

Use case UUIDs for filenames to ensure uniqueness:
- Old: `DSM_41_2024.pdf`
- New: `f579f9dc-4335-4e95-84de-a296096cb37a.pdf`

Each case has a unique UUID, so no overwrites can occur.

### Running the Migration

```bash
# 1. Ensure you have a backup of your database and files
cp -r uploads/decisions uploads/decisions.backup

# 2. Load environment variables
source .env

# 3. Run the migration script
npx ts-node scripts/migrate-pdf-filenames.ts
```

### What the Script Does

1. Connects to the database
2. Finds all cases with PDF files
3. For each case:
   - Extracts the old filename from `pdf_url`
   - Renames the file from `<appeal-number>.pdf` to `<uuid>.pdf`
   - Updates the database `pdf_url` to point to the new filename
4. Reports statistics (renamed, skipped, failed)

### Safety Features

- ✅ Checks if file exists before renaming
- ✅ Skips if already migrated (filename is already a UUID)
- ✅ Detects duplicates (if target filename already exists)
- ✅ Updates database atomically
- ✅ Provides detailed logs for each operation

### Output Example

```
🔄 Starting PDF filename migration...

✓ Database connected

Found 2 cases with PDFs

✓ Renamed: DSM_41_2024.pdf → f579f9dc-4335-4e95-84de-a296096cb37a.pdf
  Case: DSM.41/2024 (f579f9dc-4335-4e95-84de-a296096cb37a)

✓ Renamed: DSM_211_2024.pdf → b673bccb-4872-497b-86f6-9f88266b2b82.pdf
  Case: DSM.211/2024 (b673bccb-4872-497b-86f6-9f88266b2b82)

📊 Migration Summary:
  ✓ Renamed: 2
  ⚠ Skipped: 0
  ✗ Failed: 0
  Total: 2

✓ Database connection closed
✅ Migration complete!
```

### Rollback

If you need to rollback:

```bash
# 1. Restore the backup
rm -rf uploads/decisions
mv uploads/decisions.backup uploads/decisions

# 2. Restore database (you'll need a DB backup)
# Or manually update the pdf_url fields in the database
```

### Post-Migration

After successful migration:

1. ✅ Verify PDFs are accessible via the API
2. ✅ Test search functionality
3. ✅ Run OCR processing on any pending documents
4. ✅ Delete the backup once confirmed working:
   ```bash
   rm -rf uploads/decisions.backup
   ```

---

## Future Scripts

Additional migration scripts can be added to this directory as needed.
