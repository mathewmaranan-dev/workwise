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
  const [uploadResult, setUploadResult] = useState<{ success: boolean; message: string; details?: string } | null>(null);
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
      let records = parsed.data as any[];
      let headers = (parsed.meta && (parsed.meta as any).fields) || (records[0] ? Object.keys(records[0]) : []);

      const friendlyHeaders = ['Ticket Number', 'Created', 'Priority', 'Status', 'Category', 'Made SLA', 'FCR'];
      const rawDbHeaders = ['ticket_id', 'created_date', 'priority_id', 'status_id', 'category_id', 'made_sla', 'fcr'];
      const headersCaseInsensitive = headers.map((h: string) => h.toLowerCase().trim());
      const hasFriendlyHeaders = friendlyHeaders.every(h => headersCaseInsensitive.includes(h.toLowerCase()));
      const hasRawDbHeaders = rawDbHeaders.every(h => headersCaseInsensitive.includes(h.toLowerCase()));

      const isParseable = hasFriendlyHeaders || hasRawDbHeaders;
      if (!isParseable) {
        const fallback = Papa.parse(text, { header: false, dynamicTyping: true, skipEmptyLines: true });
        if (Array.isArray(fallback.data) && fallback.data.length > 0 && Array.isArray(fallback.data[0])) {
          const rawRows = fallback.data as any[][];
          const rawColumnOrder = [
            'ticket_id',
            'created_date',
            'resolved_date',
            'last_reopened_at',
            'duration',
            'reopen_count',
            'reassignment_count',
            'short_description',
            'work_notes',
            'made_sla',
            'fcr',
            'requester_id',
            'assigned_to_id',
            'closed_by_id',
            'assignment_group_id',
            'priority_id',
            'impact_id',
            'urgency_id',
            'status_id',
            'sub_status_id',
            'category_id',
            'subcategory_id',
            'channel_id',
            'source_id',
            'config_item_id',
            'sla_id',
            'sla_duedate',
            'created_at',
            'updated_at'
          ];

          records = rawRows.map((row) => {
            const record: any = {};
            rawColumnOrder.forEach((column, index) => {
              record[column] = row[index];
            });
            return record;
          });
          headers = rawColumnOrder;
        }
      }

      const finalHeaders = headers.map((h: string) => h.toLowerCase().trim());
      const hasHeadersNow = friendlyHeaders.every(h => finalHeaders.includes(h.toLowerCase())) || rawDbHeaders.every(h => finalHeaders.includes(h));
      if (!hasHeadersNow) {
        setUploadResult({
          success: false,
          message: `CSV file is missing required headers or recognizable raw DB columns. Required friendly headers: ${friendlyHeaders.join(', ')} or raw DB headers: ${rawDbHeaders.join(', ')}`
        });
        toast.error('Invalid CSV format - check headers');
        setUploading(false);
        return;
      }

      // Convert original headers to ERD ticket objects and update seedData so dashboards reflect upload
      try {
        const getValue = (row: any, keys: Array<string | number>) => {
          for (const key of keys) {
            if (row?.[key] !== undefined && row?.[key] !== null && String(row[key]).trim() !== '') {
              return row[key];
            }
          }
          return undefined;
        };

        const normalizeOptionalNumber = (value: unknown) => {
          if (typeof value === 'number' && Number.isFinite(value)) return value;
          if (typeof value === 'string' && value.trim() !== '') {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : undefined;
          }
          return undefined;
        };

        const parseBoolean = (value: any) => {
          if (typeof value === 'boolean') return value;
          if (typeof value === 'number') return value === 1;
          if (typeof value === 'string') {
            const normalized = value.trim().toLowerCase();
            return ['true', '1', 'yes'].includes(normalized);
          }
          return false;
        };

        const erdTickets = records.map((row: any, i: number) => {
          const ticketNumber = getValue(row, ['Ticket Number', 'ticket_id', 'TicketId', 'Ticket Id', 'TicketID']) || `UP-${Date.now()}-${i}`;
          const created = getValue(row, ['Created', 'created_date', 'createdAt', 'created_at']) || new Date().toISOString();
          const priorityVal = getValue(row, ['Priority', 'priority', 'priority_id']);
          const categoryVal = getValue(row, ['Category', 'category', 'category_id']);
          const assignGroupVal = getValue(row, ['Assignment group', 'assignment_group', 'assignment_group_id']);
          const statusValue = getValue(row, ['Status', 'status', 'status_name']);
          const statusIdRaw = getValue(row, ['status_id', 'Status Id', 'StatusID', 'statusId']);
          const requesterVal = getValue(row, ['Requester', 'requester', 'requester_id']);
          const assignedVal = getValue(row, ['Assigned to', 'Assigned', 'assigned_to', 'Assigned To', 'assigned_to_id']);
          const closedVal = getValue(row, ['Closed by', 'closed_by', 'Closed By', 'closed_by_id']);
          const lastReopenedValue = getValue(row, ['Last reopened at', 'last_reopened_at', 'lastReopenedAt']);
          const resolvedValue = getValue(row, ['Due Date', 'resolved_date', 'resolvedDate', 'resolved_at']);
          const slaDueValue = getValue(row, ['SLA due', 'sla_duedate', 'slaDueDate']);

          const priorityLookup = getPriorityByLevel(String(priorityVal || ''));
          const priority = priorityLookup ? priorityLookup.priority_id : normalizeOptionalNumber(priorityVal) ?? 3;
          const categoryLookup = getCategoryByName(String(categoryVal || ''));
          const category = categoryLookup ? categoryLookup.category_id : normalizeOptionalNumber(categoryVal) ?? 1;
          const assignmentGroupLookup = getAssignmentGroupByName(String(assignGroupVal || ''));
          const assignmentGroup = assignmentGroupLookup ? assignmentGroupLookup.assignment_group_id : normalizeOptionalNumber(assignGroupVal) ?? 1;
          const statusObj = statuses.find((s) => String(s.status_name).toLowerCase() === String(statusValue || '').toLowerCase());
          const parsedStatusId = typeof statusIdRaw === 'number' ? statusIdRaw : parseInt(String(statusIdRaw || ''), 10);
          const status_id = Number.isFinite(parsedStatusId)
            ? parsedStatusId
            : statusObj
            ? statusObj.status_id
            : 1;
          const requester = getUserByEmail(String(requesterVal || ''))?.user_id || normalizeOptionalNumber(requesterVal) || 1;
          const assignedUser = assignedVal ? (getUserByEmail(String(assignedVal)) || getUserByName(String(assignedVal))) : undefined;
          const closedUser = closedVal ? (getUserByEmail(String(closedVal)) || getUserByName(String(closedVal))) : undefined;

          return {
            ticket_id: String(ticketNumber).trim(),
            created_date: new Date(created).toISOString(),
            resolved_date: resolvedValue ? new Date(resolvedValue).toISOString() : undefined,
            duration: normalizeOptionalNumber(getValue(row, ['Duration', 'duration'])),
            reopen_count: normalizeOptionalNumber(getValue(row, ['Reopen count', 'reopen_count'])) ?? 0,
            reassignment_count: normalizeOptionalNumber(getValue(row, ['Reassignment count', 'reassignment_count'])) ?? 0,
            short_description: String(getValue(row, ['Short description', 'short_description', 'shortDescription']) || ''),
            work_notes: getValue(row, ['Work notes', 'work_notes', 'workNotes']) ? String(getValue(row, ['Work notes', 'work_notes', 'workNotes'])) : undefined,
            made_sla: parseBoolean(getValue(row, ['Made SLA', 'made_sla', 'madeSla'])),
            fcr: parseBoolean(getValue(row, ['FCR', 'fcr'])),
            requester_id: requester,
            assigned_to_id: normalizeOptionalNumber(getValue(row, ['assigned_to_id', 'Assigned to', 'assigned_to', 'Assigned To'])),
            closed_by_id: normalizeOptionalNumber(getValue(row, ['closed_by_id', 'Closed by', 'closed_by', 'Closed By'])),
            assignment_group_id: normalizeOptionalNumber(getValue(row, ['assignment_group_id', 'Assignment group', 'assignment_group', 'Assignment Group'])),
            priority_id: normalizeOptionalNumber(priorityVal) ?? priority,
            impact_id: normalizeOptionalNumber(getValue(row, ['impact_id', 'Impact', 'impact'] )) ?? 3,
            urgency_id: normalizeOptionalNumber(getValue(row, ['urgency_id', 'Urgency', 'urgency'])) ?? 2,
            status_id,
            sub_status_id: normalizeOptionalNumber(getValue(row, ['sub_status_id', 'Sub Status', 'sub_status'])),
            category_id: normalizeOptionalNumber(categoryVal) ?? category,
            subcategory_id: normalizeOptionalNumber(getValue(row, ['subcategory_id', 'Subcategory', 'subcategory'])),
            channel_id: normalizeOptionalNumber(getValue(row, ['channel_id', 'Channel', 'channel'] )) ?? 1,
            source_id: normalizeOptionalNumber(getValue(row, ['source_id', 'Source', 'source'] )) ?? 1,
            config_item_id: normalizeOptionalNumber(getValue(row, ['config_item_id', 'Config item', 'config_item'])),
            sla_id: normalizeOptionalNumber(getValue(row, ['sla_id', 'SLA id', 'sla_id'])) ?? 3,
            sla_duedate: slaDueValue ? new Date(slaDueValue).toISOString() : undefined,
            last_reopened_at: lastReopenedValue ? new Date(lastReopenedValue).toISOString() : undefined,
          };
        });

        // Send the parsed tickets to the backend so the database is updated
        const apiBase = (import.meta as any).env?.VITE_API_BASE_URL || (import.meta as any).env?.VITE_API_URL || '';
        const endpoint = apiBase ? `${apiBase.replace(/\/$/, '')}/api/tickets/import` : '/api/tickets/import';
        const token = typeof window !== 'undefined' ? localStorage.getItem('workwise_token') : null;
        const importResponse = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ tickets: erdTickets }),
        });

        if (!importResponse.ok) {
          const responseText = await importResponse.text().catch(() => '');
          let errorMessage = 'Ticket import failed';
          try {
            const errorBody = responseText ? JSON.parse(responseText) : {};
            errorMessage = errorBody.error || errorBody.message || errorMessage;
          } catch {
            errorMessage = responseText || errorMessage;
          }
          throw new Error(`Status ${importResponse.status}: ${errorMessage}`);
        }

        const importResult = await importResponse.json();
        const importedTickets = Array.isArray(importResult.tickets) ? importResult.tickets : erdTickets;
        setData(importedTickets);
        setTickets(importedTickets as any);
      } catch (e: any) {
        console.warn('Failed to convert uploaded CSV into ERD tickets', e);
        setUploadResult({
          success: false,
          message: 'Error processing file. Please ensure it is a valid CSV and try again.',
          details: e?.message || String(e)
        });
        toast.error('Upload failed');
        setUploading(false);
        return;
      }

      setUploadResult({
        success: true,
        message: `Successfully imported ${records.length} tickets from ${file.name}`
      });
      toast.success(`Uploaded ${records.length} tickets successfully`);
      setUploading(false);
      setFile(null);
      
    } catch (error) {
      setUploadResult({
        success: false,
        message: 'Error processing file. Please ensure it is a valid CSV.',
        details: error instanceof Error ? error.message : String(error)
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
                {uploadResult.details ? (
                  <p className="text-xs mt-1 text-gray-600 whitespace-pre-wrap">{uploadResult.details}</p>
                ) : null}
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
