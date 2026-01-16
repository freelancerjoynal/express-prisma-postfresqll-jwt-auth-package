import express from 'express';
import { protect } from '../../middleware/authMiddleware.js';

const profileRouter = express.Router();

profileRouter.get('/', protect, (req, res) => {
  // Accessing user data attached by the protect middleware
  res.json({ 
    message: 'Protected data accessed successfully', 
    user: (req as any).user 
  });
});

export default profileRouter;