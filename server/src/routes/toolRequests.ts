import { Role, ToolRequestStatus } from "@prisma/client";
import type { Request, Response } from "express";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { getAuthContext, requireAuth, requireRole } from "../middleware/auth";
import { sendToolRequestNotification } from "../services/email";

const toolRequestsRouter = Router();

const createToolRequestSchema = z.object({
  name: z.string().min(1).max(100),
  salesforceApproved: z.boolean(),
  detailsUrl: z.string().url().max(500),
  description: z.string().min(1).max(2000),
  submitterFirstName: z.string().min(1).max(100),
  submitterLastName: z.string().min(1).max(100),
});

const reviewToolRequestSchema = z.object({
  status: z.enum(["APPROVED", "DECLINED", "ON_HOLD"]),
  reviewNotes: z.string().max(1000).optional(),
});

const listQuerySchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "DECLINED", "ON_HOLD"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

const idParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

toolRequestsRouter.get("/approved-tools", async (_req: Request, res: Response) => {
  try {
    const approvedRequests = await prisma.toolRequest.findMany({
      where: { status: ToolRequestStatus.APPROVED },
      select: { name: true },
      orderBy: { name: "asc" },
    });

    const toolNames = approvedRequests.map((r) => r.name);

    res.json({ data: toolNames });
  } catch (error) {
    console.error("Error fetching approved tools:", error);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to fetch approved tools." },
    });
  }
});

toolRequestsRouter.use(requireAuth);

toolRequestsRouter.post("/", async (req: Request, res: Response) => {
  const authContext = getAuthContext(req);
  if (!authContext) {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Authentication required." },
    });
    return;
  }

  const parseResult = createToolRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request body.",
        details: parseResult.error.flatten().fieldErrors,
      },
    });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: authContext.userId },
    select: { email: true },
  });

  if (!user) {
    res.status(404).json({
      error: { code: "USER_NOT_FOUND", message: "User not found." },
    });
    return;
  }

  try {
    const toolRequest = await prisma.toolRequest.create({
      data: {
        name: parseResult.data.name,
        salesforceApproved: parseResult.data.salesforceApproved,
        detailsUrl: parseResult.data.detailsUrl,
        description: parseResult.data.description,
        submitterFirstName: parseResult.data.submitterFirstName,
        submitterLastName: parseResult.data.submitterLastName,
        submitterEmail: user.email,
      },
    });

    sendToolRequestNotification(toolRequest).catch((err) => {
      console.error("Failed to send notification email:", err);
    });

    res.status(201).json({ data: toolRequest });
  } catch (error) {
    console.error("Error creating tool request:", error);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to create tool request." },
    });
  }
});

toolRequestsRouter.get("/", requireRole([Role.ADMIN, Role.OWNER]), async (req: Request, res: Response) => {
  const parseResult = listQuerySchema.safeParse(req.query);
  if (!parseResult.success) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid query parameters.",
        details: parseResult.error.flatten().fieldErrors,
      },
    });
    return;
  }

  const { status, page, pageSize } = parseResult.data;

  try {
    const where = status ? { status: status as ToolRequestStatus } : {};

    const [requests, total] = await Promise.all([
      prisma.toolRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          reviewedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      prisma.toolRequest.count({ where }),
    ]);

    res.json({
      data: requests,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Error listing tool requests:", error);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to list tool requests." },
    });
  }
});

toolRequestsRouter.patch("/:id", requireRole([Role.ADMIN, Role.OWNER]), async (req: Request, res: Response) => {
  const authContext = getAuthContext(req);
  if (!authContext) {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Authentication required." },
    });
    return;
  }

  const parsedParams = idParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    res.status(400).json({
      error: { code: "INVALID_ID", message: "Invalid tool request ID." },
    });
    return;
  }

  const { id } = parsedParams.data;

  const parseResult = reviewToolRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request body.",
        details: parseResult.error.flatten().fieldErrors,
      },
    });
    return;
  }

  try {
    const existing = await prisma.toolRequest.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({
        error: { code: "NOT_FOUND", message: "Tool request not found." },
      });
      return;
    }

    const updated = await prisma.toolRequest.update({
      where: { id },
      data: {
        status: parseResult.data.status as ToolRequestStatus,
        reviewNotes: parseResult.data.reviewNotes,
        reviewedAt: new Date(),
        reviewedById: authContext.userId,
      },
      include: {
        reviewedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    res.json({ data: updated });
  } catch (error) {
    console.error("Error updating tool request:", error);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to update tool request." },
    });
  }
});

export { toolRequestsRouter };
