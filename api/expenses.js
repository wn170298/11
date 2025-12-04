// api/expenses.js
// CommonJS export to ensure compatibility with @vercel/node by default.

let expenses = [];

function sendJson(res, status, payload) {
  res.setHeader('Content-Type', 'application/json');
  res.statusCode = status;
  res.end(JSON.stringify(payload));
}

module.exports = (req, res) => {
  // Allow simple CORS so a static frontend can call this API during testing.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    // Preflight response
    return sendJson(res, 204, { success: true });
  }

  if (req.method === 'GET') {
    return sendJson(res, 200, { success: true, data: expenses });
  }

  if (req.method === 'POST') {
    // Read raw body (robust for environments that don't auto-parse)
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      // Protect from malicious large bodies
      if (body.length > 1e6) {
        // 1MB limit
        req.connection.destroy();
      }
    });

    req.on('end', () => {
      let parsed;
      if (!body) {
        parsed = {};
      } else {
        try {
          parsed = JSON.parse(body);
        } catch (err) {
          return sendJson(res, 400, { success: false, error: 'Invalid JSON body' });
        }
      }

      const { amount, description, category, date } = parsed || {};

      const missing = [];
      if (amount === undefined || amount === null || amount === '') missing.push('amount');
      if (!description) missing.push('description');
      if (!category) missing.push('category');
      if (!date) missing.push('date');

      if (missing.length > 0) {
        return sendJson(res, 400, {
          success: false,
          error: `Missing required fields: ${missing.join(', ')}`
        });
      }

      // Validate amount numeric
      const numericAmount = Number(amount);
      if (Number.isNaN(numericAmount)) {
        return sendJson(res, 400, {
          success: false,
          error: 'Invalid field: amount must be a number'
        });
      }

      // Basic date validation (ISO-ish)
      const ts = Date.parse(date);
      if (Number.isNaN(ts)) {
        return sendJson(res, 400, {
          success: false,
          error: 'Invalid field: date must be a valid date string (e.g. 2025-01-01)'
        });
      }

      const expense = {
        id: expenses.length + 1,
        amount: numericAmount,
        description: String(description),
        category: String(category),
        date: new Date(ts).toISOString().split('T')[0] // normalize to YYYY-MM-DD
      };

      expenses.push(expense);

      return sendJson(res, 201, { success: true, data: expense });
    });

    // In case request ends without 'end' (safety)
    req.on('error', (err) => {
      return sendJson(res, 500, { success: false, error: 'Server error', details: err.message });
    });

    return;
  }

  // Method not allowed
  return sendJson(res, 405, { success: false, error: 'Method not allowed' });
};
