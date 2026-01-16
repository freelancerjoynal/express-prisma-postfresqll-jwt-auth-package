import express from 'express';
import { authenticated  } from '../../middleware/authMiddleware.js';
import { authorize } from '../../middleware/roleMiddleware.js';



const profileRouter = express.Router();

profileRouter.get('/', authenticated, authorize('USER'), (req, res) => {
  // Accessing user data attached by the authenticated middleware
  res.json({ 
    message: 'Authenticated data accessed successfully', 
    user: (req as any).user 
  });
});

export default profileRouter;