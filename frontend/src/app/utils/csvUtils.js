// Utility functions for data export and CSV handling
import { tickets, assignmentGroups, categories, statuses } from '../data/seedData';
export const exportToCSV = (data, filename) => {
    if (data.length === 0)
        return;
    // Get headers from first object
    const headers = Object.keys(data[0]);
    // Create CSV content
    const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(header => {
            const value = row[header];
            // Escape commas and quotes
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
        }).join(','))
    ].join('\n');
    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
export const exportTicketsToCSV = () => {
    const ticketData = tickets.map(ticket => ({
        'Ticket Number': ticket.ticket_id,
        'Created': ticket.opened_at,
        'Resolved': ticket.resolved_at || '',
        'Status': statuses.find(s => s.status_id === ticket.status_id)?.status_name || '',
        'Assignment Group': assignmentGroups.find(g => g.assignment_group_id === ticket.assignment_group_id)?.group_name || '',
        'Category': categories.find(c => c.category_id === ticket.category_id)?.category_name || '',
        'Priority': ticket.priority_code,
        'SLA Status': ticket.sla_status,
        'FCR': ticket.fcr ? 'Yes' : 'No',
        'Duration (minutes)': ticket.resolution_time_minutes || '',
        'Reopen Count': ticket.reopen_count
    }));
    exportToCSV(ticketData, `workwise_tickets_${new Date().toISOString().split('T')[0]}.csv`);
};
export const importCSV = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result;
                const lines = text.split('\n');
                const headers = lines[0].split(',').map(h => h.trim());
                const records = [];
                for (let i = 1; i < lines.length; i++) {
                    if (!lines[i].trim())
                        continue;
                    const values = lines[i].split(',');
                    const record = {};
                    headers.forEach((header, index) => {
                        record[header] = values[index]?.trim();
                    });
                    records.push(record);
                }
                resolve(records);
            }
            catch (error) {
                reject(error);
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
};
