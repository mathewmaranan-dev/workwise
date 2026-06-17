import { Router, Response } from 'express';
import { AuthRequest, verifyToken } from '../middleware/auth.js';
import {
  authenticateUser,
  acceptTerms,
  changePassword,
  getCurrentUser,
} from '../services/authService.js';

const router = Router();

interface LoginBody {
  email: string;
  password: string;
}

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body as LoginBody;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const authResult = await authenticateUser(email, password);
    if (!authResult) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.json(authResult);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
router.get('/me', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await getCurrentUser(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Accept terms (persist for user)
router.post('/accept-terms', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await acceptTerms(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Accept terms error:', error);
    res.status(500).json({ error: 'Failed to accept terms' });
  }
});

interface ChangePasswordBody {
  currentPassword: string;
  newPassword: string;
}

router.post('/change-password', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { currentPassword, newPassword } = req.body as ChangePasswordBody;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new passwords are required' });
    }

    await changePassword(req.user.id, currentPassword, newPassword);
    res.json({ success: true });
  } catch (error) {
    const message = (error as Error).message;
    if (message === 'User not found' || message === 'Invalid current password') {
      return res.status(400).json({ error: message });
    }
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

export default router;
