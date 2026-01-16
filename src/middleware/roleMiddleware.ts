import { Response, NextFunction } from 'express';

export const authorize = (...allowedRoles: string[]) => {
  return (req: any, res: Response, next: NextFunction) => {
    // authenticated মিডলওয়্যার থেকে আসা ডাটা চেক
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: 'User not found in request' });
    }

    // ইউজার রোলটি চেক করা হচ্ছে (Case sensitivity হ্যান্ডেল করা হয়েছে)
    const userRole = user.role;

    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({ 
        error: `Access denied. Role '${userRole}' is not authorized.` 
      });
    }

    next();
  };
};