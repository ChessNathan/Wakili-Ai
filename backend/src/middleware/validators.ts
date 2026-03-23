import { body, param, query, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

// ── Run validation and return 422 if errors ──────────────────
export function validate(req: Request, res: Response, next: NextFunction) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      error: 'Validation failed',
      details: errors.array().map(e => ({ field: e.type === 'field' ? (e as any).path : 'unknown', message: e.msg })),
    });
  }
  next();
}

// ── Auth validators ──────────────────────────────────────────
export const validateSignup = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain a number'),
  body('full_name').trim().isLength({ min: 2, max: 100 }).escape().withMessage('Full name required (2–100 chars)'),
  body('firm_name').optional().trim().isLength({ min: 2, max: 200 }).escape().withMessage('Firm name too short or too long'),
];

export const validateLogin = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required'),
];

// ── AI validators ────────────────────────────────────────────
const ALLOWED_DOC_TYPES = ['pleading', 'contract', 'demand_letter', 'legal_opinion', 'affidavit', 'other'];

export const validateDraft = [
  body('prompt').trim().isLength({ min: 10, max: 5000 }).withMessage('Prompt must be 10–5000 characters'),
  body('doc_type').isIn(ALLOWED_DOC_TYPES).withMessage(`doc_type must be one of: ${ALLOWED_DOC_TYPES.join(', ')}`),
  body('title').optional().trim().isLength({ max: 300 }).escape().withMessage('Title too long (max 300)'),
  body('case_id').optional().isUUID().withMessage('case_id must be a valid UUID'),
];

export const validateRefine = [
  body('document_id').isUUID().withMessage('document_id must be a valid UUID'),
  body('instruction').trim().isLength({ min: 5, max: 2000 }).withMessage('Instruction must be 5–2000 characters'),
];

// ── Document validators ──────────────────────────────────────
const ALLOWED_STATUSES = ['draft', 'review', 'final', 'archived'];

export const validateDocUpdate = [
  param('id').isUUID().withMessage('Document id must be a valid UUID'),
  body('title').optional().trim().isLength({ max: 300 }).escape(),
  body('content').optional().isString().isLength({ max: 200000 }).withMessage('Content too large'),
  body('status').optional().isIn(ALLOWED_STATUSES).withMessage(`Status must be one of: ${ALLOWED_STATUSES.join(', ')}`),
  body('applicable_laws').optional().isArray({ max: 50 }).withMessage('applicable_laws must be an array'),
];

// ── Case validators ──────────────────────────────────────────
const ALLOWED_CASE_STATUSES = ['active', 'closed', 'on_hold'];

export const validateCaseCreate = [
  body('title').trim().isLength({ min: 2, max: 300 }).escape().withMessage('Title required (2–300 chars)'),
  body('matter_type').trim().isLength({ min: 2, max: 100 }).escape().withMessage('matter_type required'),
  body('court').optional().trim().isLength({ max: 200 }).escape(),
  body('client_id').optional().isUUID().withMessage('client_id must be a valid UUID'),
  body('notes').optional().trim().isLength({ max: 5000 }).escape(),
];

export const validateCaseUpdate = [
  param('id').isUUID().withMessage('Case id must be a valid UUID'),
  body('status').optional().isIn(ALLOWED_CASE_STATUSES),
  body('title').optional().trim().isLength({ max: 300 }).escape(),
  body('notes').optional().trim().isLength({ max: 5000 }).escape(),
];

// ── Client validators ────────────────────────────────────────
export const validateClientCreate = [
  body('name').trim().isLength({ min: 2, max: 200 }).escape().withMessage('Name required (2–200 chars)'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Invalid email'),
  body('phone').optional().trim().isLength({ max: 20 }).escape(),
  body('type').optional().isIn(['individual', 'company']),
  body('notes').optional().trim().isLength({ max: 5000 }).escape(),
];

// ── Deadline validators ──────────────────────────────────────
const ALLOWED_URGENCY = ['urgent', 'soon', 'normal'];

export const validateDeadlineCreate = [
  body('title').trim().isLength({ min: 2, max: 300 }).escape().withMessage('Title required'),
  body('due_date').isISO8601().withMessage('due_date must be a valid ISO date'),
  body('case_id').optional().isUUID().withMessage('case_id must be a valid UUID'),
  body('urgency').optional().isIn(ALLOWED_URGENCY),
];

// ── Google validators ────────────────────────────────────────
export const validateCreateDoc = [
  body('document_id').isUUID().withMessage('document_id must be a valid UUID'),
];

export const validateSyncDoc = [
  body('document_id').isUUID().withMessage('document_id must be a valid UUID'),
];

// ── UUID param validator (reusable) ──────────────────────────
export const validateUUIDParam = [
  param('id').isUUID().withMessage('id must be a valid UUID'),
];
