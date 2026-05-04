import { Request, Response, NextFunction } from 'express';
export interface AuthRequest extends Request {
    user?: {
        id: string;
        email: string;
        role: string;
    };
}
export declare function verifyToken(req: AuthRequest, res: Response, next: NextFunction): any;
export declare function requireRole(...roles: string[]): (req: AuthRequest, res: Response, next: NextFunction) => any;
//# sourceMappingURL=auth.d.ts.map