import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// defining the interface for decoded token
interface DecodedToken {
  userId: number;
  role: string;
}

// extending express request to include user
export interface AuthRequest extends Request {
  user?: DecodedToken;
}

export const authenticated = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.cookies.accessToken;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as DecodedToken;
    
    console.log('DEBUG - Decoded token:', decoded);
    
    // Fallback: if role is undefined, set it to USER
    if (!decoded.role) {
      decoded.role = 'USER';
      console.log('DEBUG - Role was undefined, set to USER as fallback');
    }
    
    // assigning decoded data to req.user so authorize middleware can see the role
    req.user = decoded; 
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};