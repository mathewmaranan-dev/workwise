export declare function authenticateUser(email: string, password: string): Promise<{
    token: string;
    user: {
        id: string;
        email: string;
        role: string;
        termsAccepted: boolean;
        assignment_group_id: number | null;
        assignment_group: string | null;
        shift: string | null;
    };
} | null>;
export declare function getCurrentUser(userId: string): Promise<any>;
export declare function acceptTerms(userId: string): Promise<any>;
export declare function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<boolean>;
//# sourceMappingURL=authService.d.ts.map