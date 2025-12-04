// backend/src/middlewares/isAdmin.middleware.js
module.exports = function isAdmin(req, res, next) {
  // assume auth.middleware sets req.user = { sub: id, email, role... }
  const role = req.user?.role || (req.user && req.user.role) || null;
  if (!role) return res.status(403).json({ message: 'Forbidden' });
  if (role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  return next();
};
