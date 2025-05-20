module.exports = (requiredRoles) => (req, res, next) => {
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden: insufficient role' });
  }
  next();
};
