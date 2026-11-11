// A minimal, hand-rolled replacement for express-mongo-sanitize: that
// package tries to reassign req.query, which is a getter-only property in
// Express 5 and crashes on any request with a query string (verified — see
// project docs). Scoped to req.body only, which is the only place this
// app's Mongoose queries actually derive filter values from (req.params.id
// values go through Mongoose's own ObjectId casting, which already rejects
// non-ObjectId shapes).
//
// Strips any object key starting with "$" or containing "." — the two ways
// a JSON body can smuggle a MongoDB query operator (e.g. sending
// {"email": {"$gt": ""}} as the login email to match an arbitrary user
// instead of a literal string).
const sanitizeValue = (value) => {
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value && typeof value === "object") {
    const clean = {};
    for (const [key, val] of Object.entries(value)) {
      if (key.startsWith("$") || key.includes(".")) continue;
      clean[key] = sanitizeValue(val);
    }
    return clean;
  }
  return value;
};

const sanitizeBody = (req, res, next) => {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeValue(req.body);
  }
  next();
};

module.exports = sanitizeBody;
