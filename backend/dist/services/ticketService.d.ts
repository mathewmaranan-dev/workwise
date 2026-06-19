export declare function getAllTickets(filters: {
    status?: string;
    assigned_to?: string;
    priority?: string;
}): Promise<any[]>;
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
//# sourceMappingURL=ticketService.d.ts.map