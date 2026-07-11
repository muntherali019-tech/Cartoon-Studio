// Pure form validators, shared by the UI and the test suite.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validators = {
  name(value) {
    if (!value.trim()) return "Please enter your name.";
    return "";
  },
  email(value) {
    if (!value.trim()) return "Please enter your email address.";
    if (!EMAIL_RE.test(value.trim())) return "Please enter a valid email address.";
    return "";
  },
  message(value) {
    if (!value.trim()) return "Please tell us about your project.";
    if (value.trim().length < 10)
      return "Please add a little more detail (at least 10 characters).";
    return "";
  },
};

// Validate an object of { field: value }. Returns { valid, errors }.
export function validateForm(fields) {
  const errors = {};
  let valid = true;
  for (const key of Object.keys(validators)) {
    const msg = validators[key](fields[key] ?? "");
    if (msg) {
      errors[key] = msg;
      valid = false;
    }
  }
  return { valid, errors };
}
