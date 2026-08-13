import type { Request, Response, NextFunction } from 'express'

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'not logged in' })
  }
  if (req.session.role !== 'admin') {
    return res.status(403).json({ error: 'admin access required' })
  }
  return next()
}
