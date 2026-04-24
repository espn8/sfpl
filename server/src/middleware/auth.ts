import type { NextFunction, Request, Response } from "express";
import type { Role } from "@prisma/client";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";

async function checkWhitelistBypass(req: Request): Promise<boolean> {
  const token = req.headers["x-dev-whitelist-token"];
  if (!env.devWhitelistToken || !token) {
    return false;
  }

  if (token !== env.devWhitelistToken) {
    return false;
  }

  if (req.session.auth) {
    return true;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: env.devWhitelistUserId },
      select: { id: true, teamId: true, role: true, ou: true },
    });

    if (user) {
      req.session.auth = {
        userId: user.id,
        teamId: user.teamId,
        role: user.role,
        userOu: user.ou,
      };
    }
  } catch {
    return false;
  }

  return !!req.session.auth;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const proceed = async () => {
    if (req.session.auth) {
      return next();
    }

    const whitelisted = await checkWhitelistBypass(req);
    if (whitelisted) {
      return next();
    }

    res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required.",
      },
    });
  };

  proceed();
}

export function requireRole(roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const proceed = async () => {
      if (!req.session.auth) {
        const whitelisted = await checkWhitelistBypass(req);
        if (!whitelisted) {
          res.status(401).json({
            error: {
              code: "UNAUTHORIZED",
              message: "Authentication required.",
            },
          });
          return;
        }
      }

      if (!req.session.auth) {
        res.status(403).json({
          error: {
            code: "FORBIDDEN",
            message: "Insufficient permissions.",
          },
        });
        return;
      }

      const currentRole = await refreshSessionRoleFromDb(req);
      if (!currentRole || !roles.includes(currentRole)) {
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

    proceed();
  };
}

/** Re-reads role/teamId from the database and updates the session so permission
 * checks aren't based on a stale snapshot from an earlier login. Returns the
 * fresh role, or null if the user no longer exists. */
async function refreshSessionRoleFromDb(req: Request): Promise<Role | null> {
  if (!req.session.auth) {
    return null;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.session.auth.userId },
      select: { role: true, teamId: true, ou: true },
    });

    if (!user) {
      return null;
    }

    if (
      req.session.auth.role !== user.role ||
      req.session.auth.teamId !== user.teamId ||
      req.session.auth.userOu !== user.ou
    ) {
      req.session.auth.role = user.role;
      req.session.auth.teamId = user.teamId;
      req.session.auth.userOu = user.ou;
    }

    return user.role;
  } catch {
    return req.session.auth.role;
  }
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

export function requireWriteAccess(req: Request, res: Response, next: NextFunction): void {
  const proceed = async () => {
    if (!req.session.auth) {
      const whitelisted = await checkWhitelistBypass(req);
      if (!whitelisted) {
        res.status(401).json({
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required.",
          },
        });
        return;
      }
    }

    const currentRole = await refreshSessionRoleFromDb(req);
    if (currentRole === "VIEWER") {
      res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Viewer accounts cannot create or modify content.",
        },
      });
      return;
    }

    next();
  };

  proceed();
}
