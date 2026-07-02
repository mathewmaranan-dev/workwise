export declare function getAllUsers(): Promise<any[]>;
export declare function suggestEmail(firstName: string, lastName: string): Promise<any>;
export declare function getUsersByGroup(groupId: number, requester: {
    role: string;
    id: number;
}): Promise<any[]>;
export declare function getUserById(id: string): Promise<any>;
export declare function createUser(payload: {
    first_name: string;
    last_name: string;
    email?: string;
    password?: string;
    role: string;
    assignment_group_id?: unknown;
}): Promise<any>;
export declare function updateUser(id: string, payload: {
    first_name: string;
    last_name: string;
    role: string;
    assignment_group_id?: unknown;
}): Promise<any>;
export declare function deleteUser(id: string, requesterEmail?: string): Promise<true | null>;
export declare function resetUserPassword(id: string): Promise<{
    defaultPassword: string;
} | null>;
//# sourceMappingURL=userService.d.ts.map