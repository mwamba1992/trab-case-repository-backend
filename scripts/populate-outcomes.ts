import { DataSource } from 'typeorm';
import { Case } from '../src/modules/cases/entities/case.entity';
import { CaseContent } from '../src/modules/cases/entities/case-content.entity';
import { CaseDocument } from '../src/modules/cases/entities/case-document.entity';
import { CaseParty } from '../src/modules/cases/entities/case-party.entity';

/**
 * Script to populate outcome field from existing case content
 *
 * This extracts outcome information from the cleaned_text of case content
 * and updates the outcome field in the cases table.
 */

// Outcome patterns to search for in the text
const outcomePatterns = [
  { pattern: /appeal\s+(?:is\s+)?dismissed/i, outcome: 'APPEAL DISMISSED' },
  { pattern: /appeal\s+(?:is\s+)?allowed/i, outcome: 'APPEAL ALLOWED' },
  { pattern: /appeal\s+(?:is\s+)?partly\s+allowed/i, outcome: 'APPEAL PARTLY ALLOWED' },
  { pattern: /appeal\s+(?:is\s+)?partially\s+allowed/i, outcome: 'APPEAL PARTLY ALLOWED' },
  { pattern: /dismissed\s+(?:with|for)\s+costs/i, outcome: 'APPEAL DISMISSED' },
  { pattern: /allowed\s+(?:with|for)\s+costs/i, outcome: 'APPEAL ALLOWED' },
  { pattern: /appeal\s+succeeds/i, outcome: 'APPEAL ALLOWED' },
  { pattern: /appeal\s+fails/i, outcome: 'APPEAL DISMISSED' },
];

async function populateOutcomes() {
  // Create database connection
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'amtz',
    password: process.env.DB_PASSWORD || 'amtz',
    database: process.env.DB_NAME || 'trab_case',
    entities: [Case, CaseContent],
    synchronize: false,
  });

  await dataSource.initialize();
  console.log('📊 Database connected');

  try {
    const caseRepository = dataSource.getRepository(Case);
    const contentRepository = dataSource.getRepository(CaseContent);

    // Get all cases without outcome
    const casesWithoutOutcome = await caseRepository
      .createQueryBuilder('case')
      .where('case.outcome IS NULL')
      .getMany();

    console.log(`\n📝 Found ${casesWithoutOutcome.length} cases without outcome\n`);

    let updated = 0;
    let notFound = 0;

    for (const caseItem of casesWithoutOutcome) {
      // Get case content
      const content = await contentRepository
        .createQueryBuilder('content')
        .where('content.case_id = :caseId', { caseId: caseItem.id })
        .andWhere('content.cleaned_text IS NOT NULL')
        .orderBy('content.page_number', 'ASC')
        .getMany();

      if (content.length === 0) {
        console.log(`⚠️  ${caseItem.caseNumber}: No content found`);
        notFound++;
        continue;
      }

      // Combine all text
      const fullText = content.map(c => c.cleanedText).join(' ');

      // Try to find outcome
      let foundOutcome: string | null = null;

      for (const { pattern, outcome } of outcomePatterns) {
        if (pattern.test(fullText)) {
          foundOutcome = outcome;
          break;
        }
      }

      if (foundOutcome) {
        // Update case
        await caseRepository.update(caseItem.id, { outcome: foundOutcome });
        console.log(`✅ ${caseItem.caseNumber}: ${foundOutcome}`);
        updated++;
      } else {
        console.log(`❌ ${caseItem.caseNumber}: No outcome pattern found`);
        notFound++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Not found: ${notFound}`);
    console.log(`   Total: ${casesWithoutOutcome.length}`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await dataSource.destroy();
    console.log('\n✅ Database connection closed');
  }
}

// Run the script
populateOutcomes()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
