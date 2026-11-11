const { body, validationResult } = require("express-validator");

// Returns the first validation error as the standard {success, message}
// shape every other endpoint already uses, instead of express-validator's
// default array format — keeps the frontend's error handling uniform.
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
    });
  }
  next();
};

const signupValidation = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("email").trim().isEmail().withMessage("Enter a valid email address").normalizeEmail(),
  body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
  handleValidationErrors,
];

const loginValidation = [
  body("email").trim().isEmail().withMessage("Enter a valid email address").normalizeEmail(),
  body("password").notEmpty().withMessage("Password is required"),
  handleValidationErrors,
];

const forgotPasswordValidation = [
  body("email").trim().isEmail().withMessage("Enter a valid email address").normalizeEmail(),
  handleValidationErrors,
];

const resetPasswordValidation = [
  body("token").notEmpty().withMessage("Reset token is required"),
  body("newPassword").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
  handleValidationErrors,
];

module.exports = { signupValidation, loginValidation, forgotPasswordValidation, resetPasswordValidation };
