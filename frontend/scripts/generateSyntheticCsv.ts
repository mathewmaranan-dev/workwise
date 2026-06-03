import { mkdir, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import {
  exportSyntheticDatasetAsCSV,
  generateNonFCRDataset,
  generateStaffingIntelligenceDataset,
  generateTicketDataset,
  generateWorkloadBalanceDataset
} from '../src/app/utils/syntheticDatasetGenerator.js';

const outputDir = path.resolve(process.cwd(), 'generated');

const safeWriteCsv = async (filename: string, contents: string): Promise<string> => {
  const filePath = path.join(outputDir, filename);
  try {
    await writeFile(filePath, contents);
    return filePath;
  } catch (error: any) {
    if (error?.code === 'EBUSY') {
      const fallbackPath = path.join(outputDir, filename.replace('.csv', `.${Date.now()}.csv`));
      await writeFile(fallbackPath, contents);
      return fallbackPath;
    }
    throw error;
  }
};

const main = async () => {
  await mkdir(outputDir, { recursive: true });

  const workloadData = generateWorkloadBalanceDataset(48);
  const nonFCRData = generateNonFCRDataset(2000);
  const staffingData = generateStaffingIntelligenceDataset(104);
  const ticketData = generateTicketDataset(2000);

  const workloadPath = await safeWriteCsv('workload_balance.csv', exportSyntheticDatasetAsCSV(workloadData));
  const nonFCRPath = await safeWriteCsv('non_fcr_dataset.csv', exportSyntheticDatasetAsCSV(nonFCRData));
  const staffingPath = await safeWriteCsv('staffing_intelligence.csv', exportSyntheticDatasetAsCSV(staffingData));
  const ticketsPath = await safeWriteCsv('tickets_dataset.csv', exportSyntheticDatasetAsCSV(ticketData));

  console.log('CSV files generated in:', outputDir);
  console.log('Files:');
  console.log(' -', workloadPath);
  console.log(' -', nonFCRPath);
  console.log(' -', staffingPath);
  console.log(' -', ticketsPath);
};

main().catch(error => {
  console.error('Failed to generate CSV files:', error);
  process.exit(1);
});
