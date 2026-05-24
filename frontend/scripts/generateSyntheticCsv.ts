import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  exportSyntheticDatasetAsCSV,
  generateNonFCRDataset,
  generateStaffingIntelligenceDataset,
  generateWorkloadBalanceDataset
} from '../src/app/utils/syntheticDatasetGenerator';

const outputDir = path.resolve(process.cwd(), 'frontend', 'generated');

const main = async () => {
  await mkdir(outputDir, { recursive: true });

  const workloadData = generateWorkloadBalanceDataset(24);
  const nonFCRData = generateNonFCRDataset(400);
  const staffingData = generateStaffingIntelligenceDataset(52);

  await writeFile(path.join(outputDir, 'workload_balance.csv'), exportSyntheticDatasetAsCSV(workloadData));
  await writeFile(path.join(outputDir, 'non_fcr_dataset.csv'), exportSyntheticDatasetAsCSV(nonFCRData));
  await writeFile(path.join(outputDir, 'staffing_intelligence.csv'), exportSyntheticDatasetAsCSV(staffingData));

  console.log('CSV files generated in:', outputDir);
};

main().catch(error => {
  console.error('Failed to generate CSV files:', error);
  process.exit(1);
});
