import { DataSource } from 'typeorm';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * Migration script to rename PDF files from appeal-number-based naming to UUID-based naming
 *
 * PROBLEM: Appeal numbers can be duplicated across different tax types
 * Example: DSM.41/2024 for VAT and DSM.41/2024 for Income Tax
 *
 * SOLUTION: Use case UUID as filename to ensure uniqueness
 * Old: DSM_41_2024.pdf
 * New: <case-uuid>.pdf
 *
 * Usage: npx ts-node scripts/migrate-pdf-filenames.ts
 */

interface CaseRecord {
  id: string;
  case_number: string;
  pdf_url: string | null;
  pdf_hash: string | null;
}

async function migratePdfFilenames() {
  console.log('🔄 Starting PDF filename migration...\n');

  // Database connection
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'trab_case',
  });

  try {
    await dataSource.initialize();
    console.log('✓ Database connected\n');

    // Get all cases with PDF URLs
    const cases = await dataSource.query<CaseRecord[]>(
      'SELECT id, case_number, pdf_url, pdf_hash FROM cases WHERE pdf_url IS NOT NULL'
    );

    console.log(`Found ${cases.length} cases with PDFs\n`);

    const uploadsDir = path.join(process.cwd(), 'uploads', 'decisions');
    let renamed = 0;
    let skipped = 0;
    let failed = 0;

    for (const caseRecord of cases) {
      try {
        // Extract old filename from pdf_url
        // Example: /uploads/decisions/DSM_41_2024.pdf
        const oldFileName = caseRecord.pdf_url?.split('/').pop();
        if (!oldFileName) {
          console.log(`⚠ Skipping case ${caseRecord.case_number}: No filename in pdf_url`);
          skipped++;
          continue;
        }

        const oldPath = path.join(uploadsDir, oldFileName);
        const newFileName = `${caseRecord.id}.pdf`;
        const newPath = path.join(uploadsDir, newFileName);

        // Check if old file exists
        try {
          await fs.access(oldPath);
        } catch {
          console.log(`⚠ Skipping case ${caseRecord.case_number}: File not found at ${oldPath}`);
          skipped++;
          continue;
        }

        // Check if already renamed
        if (oldFileName === newFileName) {
          console.log(`✓ Already migrated: ${caseRecord.case_number}`);
          skipped++;
          continue;
        }

        // Check if target file already exists
        try {
          await fs.access(newPath);
          console.log(`⚠ Target file already exists: ${newPath}`);
          console.log(`  Case: ${caseRecord.case_number} (${caseRecord.id})`);
          console.log(`  This may indicate a duplicate. Keeping old file for manual review.\n`);
          skipped++;
          continue;
        } catch {
          // Target doesn't exist, which is good
        }

        // Rename the file
        await fs.rename(oldPath, newPath);

        // Update database
        const newPdfUrl = `/uploads/decisions/${newFileName}`;
        await dataSource.query(
          'UPDATE cases SET pdf_url = $1 WHERE id = $2',
          [newPdfUrl, caseRecord.id]
        );

        console.log(`✓ Renamed: ${oldFileName} → ${newFileName}`);
        console.log(`  Case: ${caseRecord.case_number} (${caseRecord.id})\n`);
        renamed++;

      } catch (error) {
        console.error(`✗ Failed to migrate case ${caseRecord.case_number}:`, error.message);
        failed++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`  ✓ Renamed: ${renamed}`);
    console.log(`  ⚠ Skipped: ${skipped}`);
    console.log(`  ✗ Failed: ${failed}`);
    console.log(`  Total: ${cases.length}\n`);

    await dataSource.destroy();
    console.log('✓ Database connection closed');
    console.log('✅ Migration complete!\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    await dataSource.destroy();
    process.exit(1);
  }
}

// Run migration
migratePdfFilenames();
