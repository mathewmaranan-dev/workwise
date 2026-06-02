import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useData } from '../context/DataContext';
import * as Papa from 'papaparse';
import { loadTicketsFromCSVString, setTickets, getPriorityByLevel, getCategoryByName, getAssignmentGroupByName, getUserByEmail, getUserByName, statuses } from '../data/seedData';

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loadingSample, setLoadingSample] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ success: boolean; message: string } | null>(null);
  const { setData } = useData();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setUploadResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a file first');
      return;
    }

    setUploading(true);
    
    try {
      const text = await file.text();
      const parsed = Papa.parse(text, { header: true, dynamicTyping: true, skipEmptyLines: true });
      const records = parsed.data as any[];
      const headers = (parsed.meta && (parsed.meta as any).fields) || (records[0] ? Object.keys(records[0]) : []);
      
      // Validate headers - flexible matching for original ITSM columns
      const requiredHeaders = [
        'Ticket Number', 'Created', 'Priority', 'Status', 'Category', 'Made SLA', 'FCR'
      ];
      
      const headersCaseInsensitive = headers.map((h: string) => h.toLowerCase().trim());
      const hasAllHeaders = requiredHeaders.every(h => 
        headersCaseInsensitive.includes(h.toLowerCase())
      );
      
      if (!hasAllHeaders) {
        setUploadResult({
          success: false,
          message: `CSV file is missing required headers. Required: ${requiredHeaders.join(', ')}`
        });
        toast.error('Invalid CSV format - check headers');
        setUploading(false);
        return;
      }
      
      // Convert original headers to ERD ticket objects and update seedData so dashboards reflect upload
      try {
        const erdTickets = records.map((row: any, i: number) => {
          const ticketNumber = row['Ticket Number'] || row.ticket_id || `UP-${Date.now()}-${i}`;
          const created = row['Created'] || row.created_date || new Date().toISOString();
          const priorityVal = row['Priority'] || row.priority || '';
          const categoryVal = row['Category'] || row.category || '';
          const assignGroupVal = row['Assignment group'] || row.assignment_group || '';
          const statusVal = (row['Status'] || row.status || '').toString();
          const requesterVal = row['Requester'] || row.requester || '';

          const priority = getPriorityByLevel(String(priorityVal))?.priority_id || 3;
          const category = getCategoryByName(String(categoryVal))?.category_id || 1;
          const assignmentGroup = getAssignmentGroupByName(String(assignGroupVal))?.assignment_group_id || 1;
          const statusObj = statuses.find(s => s.status_name.toLowerCase() === String(statusVal).toLowerCase());
          const status_id = statusObj ? statusObj.status_id : 1;
          const requester = getUserByEmail(String(requesterVal))?.user_id || 1;

          const assignedVal = row['Assigned to'] || row['Assigned'] || row.assigned_to || row['Assigned To'] || '';
          const closedVal = row['Closed by'] || row.closed_by || row['Closed By'] || '';

          const assignedUser = assignedVal ? (getUserByEmail(String(assignedVal)) || getUserByName(String(assignedVal))) : undefined;
          const closedUser = closedVal ? (getUserByEmail(String(closedVal)) || getUserByName(String(closedVal))) : undefined;

          const assigned_to_id = assignedUser ? assignedUser.user_id : undefined;
          const closed_by_id = closedUser ? closedUser.user_id : undefined;

          return {
            ticket_id: String(ticketNumber).toString().trim(),
            created_date: new Date(created).toISOString(),
            resolved_date: row['Due Date'] ? new Date(row['Due Date']).toISOString() : undefined,
            duration: row['Duration'] ? parseInt(row['Duration']) : undefined,
            reopen_count: row['Reopen count'] ? parseInt(row['Reopen count']) : 0,
            reassignment_count: row['Reassignment count'] ? parseInt(row['Reassignment count']) : 0,
            short_description: String(row['Short description'] || row.short_description || ''),
            work_notes: row['Work notes'] ? String(row['Work notes']) : undefined,
            made_sla: String(row['Made SLA'] || row.made_sla || '').toLowerCase() === 'true',
            fcr: String(row['FCR'] || row.fcr || '').toLowerCase() === 'true',
            requester_id: requester,
            assigned_to_id,
            closed_by_id,
            assignment_group_id: assignmentGroup,
            priority_id: priority,
            impact_id: 3,
            urgency_id: 2,
            status_id,
            sub_status_id: undefined,
            category_id: category,
            subcategory_id: undefined,
            channel_id: 1,
            source_id: 1,
            config_item_id: undefined,
            sla_id: 3,
            sla_duedate: row['SLA due'] ? new Date(row['SLA due']).toISOString() : undefined
          };
        });

        // Update DataContext with ERD-formatted tickets so dashboards can consume them
        setData(erdTickets);
        setTickets(erdTickets as any);
      } catch (e) {
        console.warn('Failed to convert uploaded CSV into ERD tickets', e);
      }

      // Simulate success
      setTimeout(() => {
        setUploadResult({
          success: true,
          message: `Successfully processed ${records.length} tickets from ${file.name}`
        });
        toast.success(`Uploaded ${records.length} tickets successfully`);
        setUploading(false);
        setFile(null);
      }, 2000);
      
    } catch (error) {
      setUploadResult({
        success: false,
        message: 'Error processing file. Please ensure it is a valid CSV.'
      });
      toast.error('Upload failed');
      setUploading(false);
    }
  };

  const loadGeneratedSample = async () => {
    setLoadingSample(true);
    try {
      const sampleUrl = `${(import.meta as any).env?.BASE_URL || ''}generated/tickets_dataset.csv`;
      const response = await fetch(sampleUrl);
      if (!response.ok) {
        throw new Error('Generated sample dataset not found in public/generated. Run npm run generate:synthetic-csv first.');
      }
      const text = await response.text();
      const { tickets: erdTickets } = loadTicketsFromCSVString(text);
      setData(erdTickets);
      setTickets(erdTickets as any);
      toast.success('Loaded generated sample ticket dataset');
    } catch (error: any) {
      toast.error(error?.message || 'Could not load generated sample dataset');
    } finally {
      setLoadingSample(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Upload Ticket Data</h1>
        <p className="text-gray-600 mt-1">Import new ticket data from CSV files</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>CSV File Upload</CardTitle>
          <CardDescription>
            Upload a CSV file containing ticket data. The file should include the following columns:
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-medium text-sm mb-2">Required CSV Columns:</h3>
            <div className="grid grid-cols-2 gap-2 text-sm text-gray-700 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full" />
                Ticket Number
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full" />
                Created
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full" />
                Priority
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full" />
                Status
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full" />
                Category
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full" />
                Made SLA
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full" />
                FCR
              </div>
            </div>
            <p className="text-xs text-gray-600 mb-3">
              Optional Fields: SLA time, SLA due, Due Date, Survey, Comments, Survey Response, Sub Status, Assignment group, Assigned to, Closed by, Short description, Work notes, Requester, Source, Subcategory, Impact, Urgency, Channel, Duration, Last reopened at, Reopen count, Reassignment count, Configuration item, Tags
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="file-upload" className="block mb-2">Select CSV File</Label>
              <div className="flex items-center gap-4">
                <Input
                  id="file-upload"
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="flex-1"
                />
                {file && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>{file.name}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3">
              <Button
                onClick={handleUpload}
                disabled={!file || uploading}
                className="w-full sm:w-auto"
              >
                <Upload className="w-4 h-4 mr-2" />
                {uploading ? 'Processing...' : 'Upload and Process'}
              </Button>
              <Button
                onClick={loadGeneratedSample}
                disabled={loadingSample}
                variant="secondary"
                className="w-full sm:w-auto"
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                {loadingSample ? 'Loading sample…' : 'Load generated sample tickets'}
              </Button>
            </div>
          </div>

          {uploadResult && (
            <div className={`flex items-start gap-3 p-4 rounded-lg ${
              uploadResult.success 
                ? 'bg-green-50 text-green-800 border border-green-200' 
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {uploadResult.success ? (
                <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
              )}
              <div>
                <p className="font-medium">{uploadResult.success ? 'Upload Successful' : 'Upload Failed'}</p>
                <p className="text-sm mt-1">{uploadResult.message}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upload Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-700">
          <div className="flex gap-3">
            <div className="font-bold text-indigo-600 mt-0.5">1.</div>
            <div>
              <p className="font-medium mb-1">Prepare your CSV file</p>
              <p className="text-gray-600">
                Ensure your CSV file contains all required columns with proper headers.
                The first row should contain column names.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="font-bold text-indigo-600 mt-0.5">2.</div>
            <div>
              <p className="font-medium mb-1">Select and upload</p>
              <p className="text-gray-600">
                Click "Choose File" to select your CSV, then click "Upload and Process" to import the data.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="font-bold text-indigo-600 mt-0.5">3.</div>
            <div>
              <p className="font-medium mb-1">Verify the results</p>
              <p className="text-gray-600">
                After upload, the system will process the data and update all dashboards with the new information.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
