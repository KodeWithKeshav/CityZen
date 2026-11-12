const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { authenticateUser } = require('../middleware/auth');
const logger = require('../utils/logger');

// Validation middleware
const validateSignup = [
  body('email').isEmail().normalizeEmail(),
  body('password')
    .isString()
    .isLength({ min: 6, max: 128 })
    .custom((value) => value.trim().length > 0)
    .withMessage('Password cannot be blank'),
  body('fullName').isString().trim().isLength({ min: 2, max: 100 }),
  body('phoneNumber')
    .isString()
    .trim()
    .matches(/^[+\d\s()-]{10,20}$/)
    .withMessage('Valid phone number is required')
    .custom((value) => value.replace(/\D/g, '').length >= 10)
    .withMessage('Phone number must contain at least 10 digits'),
  body('userType').isIn(['citizen', 'admin']),
  body('address').optional({ values: 'falsy' }).isString().trim().isLength({ max: 500 })
];

const validateLogin = [
  body('email').isEmail().normalizeEmail(),
  body('password').isString().notEmpty()
];

// Sign up route
router.post('/signup', validateSignup, async (req, res) => {
  try {
    const supabase = req.app.get('supabase');

    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, password, fullName, phoneNumber, userType, address } = req.body;

    // Check if user already exists
    const { data: existingUser, error: existingError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingError) {
      console.error('Supabase lookup error:', existingError);
      return res.status(500).json({
        success: false,
        message: 'Failed to check existing user'
      });
    }

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Hash password (10 rounds is secure and fast)
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user in Supabase
    const { data: user, error } = await supabase
      .from('users')
      .insert([
        {
          email,
          password: hashedPassword,
          full_name: fullName,
          phone_number: phoneNumber,
          user_type: userType,
          address: address || null,
          created_at: new Date().toISOString(),
          is_active: true
        }
      ])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({
          success: false,
          message: 'User already exists with this email'
        });
      }
      console.error('Supabase error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create user account'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        userType: user.user_type
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          phoneNumber: user.phone_number,
          userType: user.user_type,
          address: user.address
        },
        token
      }
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Login route
router.post('/login', validateLogin, async (req, res) => {
  try {
    const supabase = req.app.get('supabase');

    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Find active user
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, password, full_name, phone_number, user_type, address, is_active')
      .eq('email', email)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('Supabase login lookup error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }

    if (!user || !user.password) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        userType: user.user_type
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Update last login (non-fatal if update fails)
    const { error: updateError } = await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    if (updateError) {
      logger.warn('Failed to update last_login:', updateError.message);
    }

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          phoneNumber: user.phone_number,
          userType: user.user_type,
          address: user.address
        },
        token
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get user profile
router.get('/profile', authenticateUser, async (req, res) => {
  try {
    if (!req.user || !req.user.isAuthenticated) {
      const message = req.authError === 'TokenExpiredError'
        ? 'Token expired'
        : req.authError
          ? 'Invalid token'
          : 'No token provided';
      return res.status(401).json({
        success: false,
        message
      });
    }

    const supabase = req.app.get('supabase');

    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, full_name, phone_number, user_type, address, created_at')
      .eq('id', req.user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('Profile lookup error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          phoneNumber: user.phone_number,
          userType: user.user_type,
          address: user.address,
          createdAt: user.created_at
        }
      }
    });

  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;
