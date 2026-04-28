import type { Request, Response } from "express";
import { Router } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Prisma, Role } from "@prisma/client";
import multer from "multer";
import { z } from "zod";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { authRateLimit } from "../middleware/rateLimit";
import { archivePublishedAssetsForProfileGate } from "../services/profileGateArchive";

const uploadsDir = path.resolve(__dirname, "../../public/uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const profilePhotoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${randomBytes(8).toString("hex")}`;
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    cb(null, `profile-${uniqueSuffix}${ext}`);
  },
});

const profilePhotoUpload = multer({
  storage: profilePhotoStorage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, GIF, and WebP images are allowed."));
    }
  },
});

const authRouter = Router();
const googleIssuer = "https://accounts.google.com";
const googleCallbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});
const updateProfileBodySchema = z.object({
  name: z.string().trim().min(1, "name is required."),
  avatarUrl: z
    .string()
    .trim()
    .refine(
      (val) => val.startsWith("/uploads/") || val.startsWith("http://") || val.startsWith("https://"),
      { message: "avatarUrl must be a valid URL or server upload path." },
    ),
  region: z.string().trim().optional().default(""),
  ou: z.string().trim().max(120, "Department/OU must be at most 120 characters.").optional().default(""),
  title: z.string().trim().optional().default(""),
});
const googleJwks = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);
const authUserSelect = {
  id: true,
  email: true,
  googleSub: true,
  name: true,
  avatarUrl: true,
  ou: true,
  onboardingCompleted: true,
  role: true,
  teamId: true,
} as const;

class GoogleAuthError extends Error {
  statusCode: number;
  errorCode: string;

  constructor(statusCode: number, errorCode: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

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
      select: { id: true, teamId: true, role: true, ou: true, onboardingCompleted: true },
    });

    if (user) {
      req.session.auth = {
        userId: user.id,
        teamId: user.teamId,
        role: user.role,
        userOu: user.ou,
        onboardingCompleted: user.onboardingCompleted,
      };
    }
  } catch {
    return false;
  }

  return !!req.session.auth;
}

function getValidSessionAuth(req: Request): {
  userId: number;
  teamId: number;
  role: string;
  userOu: string | null;
} | null {
  const auth = req.session.auth;
  if (!auth) {
    return null;
  }

  if (!Number.isInteger(auth.userId) || auth.userId <= 0) {
    return null;
  }

  if (!Number.isInteger(auth.teamId) || auth.teamId <= 0) {
    return null;
  }

  if (typeof auth.role !== "string" || auth.role.length === 0) {
    return null;
  }

  return auth;
}

function toSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Assigns ADMIN to listed emails on each Google sign-in; never demotes OWNER. */
function roleAfterGoogleAuth(normalizedEmail: string, priorRole: Role): Role {
  const domain = normalizedEmail.split("@")[1];
  if (domain === "meshmesh.io") {
    return Role.VIEWER;
  }
  if (priorRole === Role.OWNER) {
    return Role.OWNER;
  }
  if (env.bootstrapAdminEmails.has(normalizedEmail)) {
    return Role.ADMIN;
  }
  return priorRole;
}

function initialRoleForNewGoogleUser(normalizedEmail: string): Role {
  const domain = normalizedEmail.split("@")[1];
  if (domain === "meshmesh.io") {
    return Role.VIEWER;
  }
  return env.bootstrapAdminEmails.has(normalizedEmail) ? Role.ADMIN : Role.MEMBER;
}

async function exchangeCodeForIdToken(code: string): Promise<string> {
  const body = new URLSearchParams({
    code,
    client_id: env.googleClientId,
    client_secret: env.googleClientSecret,
    redirect_uri: env.googleCallbackUrl,
    grant_type: "authorization_code",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const tokenResult = (await response.json()) as {
    id_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!response.ok) {
    const googleError = tokenResult.error ?? "unknown_error";
    const googleDescription = tokenResult.error_description ?? "Google token exchange failed.";

    if (googleError === "invalid_grant" || googleError === "invalid_request") {
      throw new GoogleAuthError(400, "GOOGLE_TOKEN_INVALID", googleDescription);
    }

    if (googleError === "unauthorized_client") {
      throw new GoogleAuthError(401, "GOOGLE_CLIENT_UNAUTHORIZED", googleDescription);
    }

    throw new GoogleAuthError(502, "GOOGLE_TOKEN_EXCHANGE_FAILED", googleDescription);
  }

  if (!tokenResult.id_token) {
    throw new GoogleAuthError(502, "GOOGLE_TOKEN_MISSING_ID_TOKEN", "Google token response missing id_token.");
  }

  return tokenResult.id_token;
}

authRouter.get("/google", authRateLimit, (req: Request, res: Response) => {
  const state = randomBytes(16).toString("hex");
  const nonce = randomBytes(16).toString("hex");

  req.session.oauth = { state, nonce };

  const params = new URLSearchParams({
    client_id: env.googleClientId,
    redirect_uri: env.googleCallbackUrl,
    response_type: "code",
    scope: "openid email profile",
    prompt: "select_account",
    state,
    nonce,
  });

  req.session.save((err) => {
    if (err) {
      return res.status(500).json({
        error: {
          code: "SESSION_SAVE_FAILED",
          message: "Failed to save session state.",
        },
      });
    }
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  });
});

authRouter.get("/google/start", authRateLimit, (req: Request, res: Response) => {
  res.redirect("/api/auth/google");
});

authRouter.get("/google/callback", authRateLimit, async (req: Request, res: Response) => {
  try {
    const parsedQuery = googleCallbackQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      return res.status(400).json({ error: { code: "BAD_REQUEST", message: "Invalid OAuth callback parameters." } });
    }
    const { code, state } = parsedQuery.data;

    if (!req.session.oauth || req.session.oauth.state !== state) {
      return res.status(400).json({ error: { code: "INVALID_STATE", message: "OAuth state validation failed." } });
    }

    const idToken = await exchangeCodeForIdToken(code);
    const verifiedToken = await jwtVerify(idToken, googleJwks, {
      issuer: googleIssuer,
      audience: env.googleClientId,
    });
    const claims = verifiedToken.payload;

    if (claims.nonce !== req.session.oauth.nonce) {
      return res.status(400).json({ error: { code: "INVALID_NONCE", message: "OAuth nonce validation failed." } });
    }

    if (claims.email_verified !== true || typeof claims.email !== "string") {
      return res.status(403).json({ error: { code: "UNVERIFIED_EMAIL", message: "Google email must be verified." } });
    }

    if (typeof claims.sub !== "string") {
      return res.status(403).json({ error: { code: "INVALID_SUBJECT", message: "Google identity subject was missing." } });
    }

    const emailDomain = claims.email.split("@")[1] ?? "";
    const isAllowedDomain = !env.googleAllowedDomain || emailDomain === env.googleAllowedDomain || emailDomain === "meshmesh.io";
    if (!isAllowedDomain) {
      return res.status(403).json({ error: { code: "DOMAIN_NOT_ALLOWED", message: "Email domain is not allowed." } });
    }

    const baseTeamSlug = toSlug(emailDomain || "default-team");
    const team = await prisma.team.upsert({
      where: { slug: baseTeamSlug },
      update: {},
      create: {
        slug: baseTeamSlug,
        name: emailDomain || "Default Team",
      },
    });

    const normalizedEmail = claims.email.toLowerCase();
    const existingByGoogle = await prisma.user.findUnique({
      where: { googleSub: claims.sub },
      select: authUserSelect,
    });
    const existingByEmail = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: authUserSelect,
    });

    const user = existingByGoogle
      ? await prisma.user.update({
          where: { id: existingByGoogle.id },
          data: {
            email: normalizedEmail,
            name: existingByGoogle.onboardingCompleted
              ? existingByGoogle.name
              : typeof claims.name === "string"
                ? claims.name
                : null,
            avatarUrl: existingByGoogle.onboardingCompleted
              ? existingByGoogle.avatarUrl
              : typeof claims.picture === "string"
                ? claims.picture
                : null,
            teamId: team.id,
            role: roleAfterGoogleAuth(normalizedEmail, existingByGoogle.role),
          },
          select: authUserSelect,
        })
      : existingByEmail
        ? await prisma.user.update({
            where: { id: existingByEmail.id },
            data: {
              googleSub: claims.sub,
              name: existingByEmail.onboardingCompleted
                ? existingByEmail.name
                : typeof claims.name === "string"
                  ? claims.name
                  : existingByEmail.name,
              avatarUrl: existingByEmail.onboardingCompleted
                ? existingByEmail.avatarUrl
                : typeof claims.picture === "string"
                  ? claims.picture
                  : existingByEmail.avatarUrl,
              teamId: team.id,
              role: roleAfterGoogleAuth(normalizedEmail, existingByEmail.role),
            },
            select: authUserSelect,
          })
        : await prisma.user.create({
            data: {
              email: normalizedEmail,
              googleSub: claims.sub,
              name: typeof claims.name === "string" ? claims.name : null,
              avatarUrl: typeof claims.picture === "string" ? claims.picture : null,
              role: initialRoleForNewGoogleUser(normalizedEmail),
              teamId: team.id,
            },
            select: authUserSelect,
          });

    req.session.auth = {
      userId: user.id,
      teamId: user.teamId,
      role: user.role,
      userOu: user.ou,
      onboardingCompleted: user.onboardingCompleted,
    };
    delete req.session.oauth;

    req.session.save((err) => {
      if (err) {
        return res.status(500).json({
          error: {
            code: "SESSION_SAVE_FAILED",
            message: "Failed to save authentication session.",
          },
        });
      }
      return res.redirect(env.appBaseUrl);
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2022") {
      return res.status(500).json({
        error: {
          code: "DATABASE_SCHEMA_MISMATCH",
          message: "Database schema is out of date. Run Prisma migrations.",
        },
      });
    }

    if (error instanceof GoogleAuthError) {
      return res.status(error.statusCode).json({
        error: {
          code: error.errorCode,
          message: error.message,
        },
      });
    }

    // eslint-disable-next-line no-console
    console.error("Google callback failed unexpectedly", error);
    return res.status(500).json({
      error: {
        code: "GOOGLE_AUTH_FAILED",
        message: "Google authentication failed.",
      },
    });
  }
});

authRouter.post("/logout", authRateLimit, (req: Request, res: Response) => {
  req.session.destroy(() => {
    res.clearCookie("ailibrary.sid");
    res.status(200).json({ data: { ok: true } });
  });
});

authRouter.get("/whitelist-status", async (req: Request, res: Response) => {
  const token = req.headers["x-dev-whitelist-token"];
  if (!env.devWhitelistToken) {
    return res.status(200).json({
      data: {
        enabled: false,
        authenticated: false,
        message: "DEV_WHITELIST_TOKEN is not configured on the server.",
      },
    });
  }

  if (!token) {
    return res.status(200).json({
      data: {
        enabled: true,
        authenticated: false,
        message: "No X-Dev-Whitelist-Token header provided.",
      },
    });
  }

  if (token !== env.devWhitelistToken) {
    return res.status(200).json({
      data: {
        enabled: true,
        authenticated: false,
        message: "Invalid whitelist token.",
      },
    });
  }

  const user = await prisma.user.findUnique({
    where: { id: env.devWhitelistUserId },
    select: { id: true, email: true, name: true, role: true },
  });

  if (!user) {
    return res.status(200).json({
      data: {
        enabled: true,
        authenticated: false,
        message: `Whitelist user ID ${env.devWhitelistUserId} not found in database.`,
      },
    });
  }

  return res.status(200).json({
    data: {
      enabled: true,
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      message: "Whitelist authentication is active and valid.",
    },
  });
});

authRouter.get("/me", async (req: Request, res: Response) => {
  let sessionAuth = getValidSessionAuth(req);
  if (!sessionAuth) {
    const whitelisted = await checkWhitelistBypass(req);
    if (whitelisted) {
      sessionAuth = getValidSessionAuth(req);
    }
  }
  if (!sessionAuth) {
    return res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Not authenticated.",
      },
    });
  }

  let user;
  try {
    user = await prisma.user.findUnique({
      where: { id: sessionAuth.userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        region: true,
        ou: true,
        title: true,
        onboardingCompleted: true,
        role: true,
        teamId: true,
      },
    });
  } catch (_error) {
    return res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Session user could not be validated.",
      },
    });
  }

  if (!user) {
    return res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Session user no longer exists.",
      },
    });
  }

  if (
    req.session.auth &&
    (req.session.auth.role !== user.role ||
      req.session.auth.teamId !== user.teamId ||
      req.session.auth.userOu !== user.ou)
  ) {
    req.session.auth.role = user.role;
    req.session.auth.teamId = user.teamId;
    req.session.auth.userOu = user.ou;
  }

  if (req.session.auth) {
    req.session.auth.onboardingCompleted = user.onboardingCompleted;
  }

  if (!user.onboardingCompleted && !req.session.profileGateArchiveDone) {
    try {
      await archivePublishedAssetsForProfileGate(user.id);
      req.session.profileGateArchiveDone = true;
    } catch (_archiveError) {
      // Non-fatal: user still sees profile form; archive can be retried on next /me
    }
  }

  return res.status(200).json({ data: user });
});

authRouter.patch("/me", async (req: Request, res: Response) => {
  const sessionAuth = getValidSessionAuth(req);
  if (!sessionAuth) {
    return res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Not authenticated.",
      },
    });
  }

  const parsedBody = updateProfileBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({
      error: {
        code: "BAD_REQUEST",
        message: "Invalid profile payload.",
        details: parsedBody.error.flatten(),
      },
    });
  }

  const { name, avatarUrl, region, ou, title } = parsedBody.data;

  const existingUser = await prisma.user.findUnique({
    where: { id: sessionAuth.userId },
    select: { ou: true },
  });
  const hasOuInPayload = typeof ou === "string" && ou.trim().length > 0;
  const hasOuInDb = typeof existingUser?.ou === "string" && existingUser.ou.trim().length > 0;
  if (!hasOuInPayload && !hasOuInDb) {
    return res.status(400).json({
      error: {
        code: "OU_REQUIRED",
        message: "Please select your Department/OU before continuing.",
      },
    });
  }

  let updatedUser;
  try {
    updatedUser = await prisma.user.update({
      where: { id: sessionAuth.userId },
      data: {
        name,
        avatarUrl,
        region,
        ou,
        title,
        onboardingCompleted: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        region: true,
        ou: true,
        title: true,
        onboardingCompleted: true,
        role: true,
        teamId: true,
      },
    });
  } catch (_error) {
    return res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Session user could not be updated.",
      },
    });
  }

  if (req.session.auth) {
    req.session.auth.userOu = updatedUser.ou;
    req.session.auth.onboardingCompleted = updatedUser.onboardingCompleted;
    delete req.session.profileGateArchiveDone;
  }

  return res.status(200).json({ data: updatedUser });
});

authRouter.post(
  "/me/profile-photo",
  profilePhotoUpload.single("profilePhoto"),
  async (req: Request, res: Response) => {
    const sessionAuth = getValidSessionAuth(req);
    if (!sessionAuth) {
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Not authenticated.",
        },
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: {
          code: "BAD_REQUEST",
          message: "No file uploaded. Please select an image file.",
        },
      });
    }

    const photoUrl = `/uploads/${req.file.filename}`;

    try {
      const updatedUser = await prisma.user.update({
        where: { id: sessionAuth.userId },
        data: {
          avatarUrl: photoUrl,
        },
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          region: true,
          ou: true,
          title: true,
          onboardingCompleted: true,
          role: true,
          teamId: true,
        },
      });

      return res.status(200).json({ data: updatedUser });
    } catch (_error) {
      return res.status(500).json({
        error: {
          code: "UPLOAD_FAILED",
          message: "Failed to save profile photo.",
        },
      });
    }
  },
);

export { authRouter };
