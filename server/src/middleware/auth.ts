import type { NextFunction, Request, Response } from "express";
import type { Role } from "@prisma/client";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.auth) {
    res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required.",
      },
    });
    return;
  }

  next();
}

export function requireRole(roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.session.auth) {
      res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required.",
        },
      });
      return;
    }

    if (!roles.includes(req.session.auth.role)) {
      res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Insufficient permissions.",
        },
      });
      return;
    }

    next();
  };
}

export type AuthContext = {
  userId: number;
  teamId: number;
  role: Role;
  userOu: string | null;
};

export function getAuthContext(req: Request): AuthContext | null {
  if (!req.session.auth) {
    return null;
  }

  return {
    userId: req.session.auth.userId,
    teamId: req.session.auth.teamId,
    role: req.session.auth.role,
    userOu: req.session.auth.userOu,
  };
}
