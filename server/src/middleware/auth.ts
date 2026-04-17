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

      if (!req.session.auth || !roles.includes(req.session.auth.role)) {
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
