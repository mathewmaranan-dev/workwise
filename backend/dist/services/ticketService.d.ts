interface TicketFilterOptions {
    ticket_id?: string;
    assigned_to_id?: string;
    assignment_group_id?: string;
    category_id?: string;
    status_id?: string;
    status?: string;
    priority_id?: string;
    priority?: string;
    created_from?: string;
    created_to?: string;
    limit?: string;
    offset?: string;
}
export declare function getAllTicketsAnalyticsWithSummary(filters: TicketFilterOptions): Promise<{
    tickets: any[];
    summary: any;
}>;
export declare function getAllTickets(filters: TicketFilterOptions): Promise<any[]>;
export declare function getAllTicketsAnalytics(filters: TicketFilterOptions): Promise<any[]>;
export declare function getAllTicketsDetailed(filters: TicketFilterOptions): Promise<any[]>;
export declare function getTicketById(id: string): Promise<any>;
export declare function createTicket(payload: {
    assigned_to: unknown;
    assignment_group_id: unknown;
    priority_id: unknown;
}): Promise<any>;
export declare function importTickets(tickets: unknown[]): Promise<any[]>;
export declare function updateTicket(id: string, payload: {
    status_id?: unknown;
    assigned_to_id?: unknown;
    notes?: string;
}): Promise<any>;
export {};
//# sourceMappingURL=ticketService.d.ts.map