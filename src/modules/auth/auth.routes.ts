import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq, and } from "drizzle-orm";
import type { AppEnv } from "../../types/context";
import { createDb } from "../../db";
import { users } from "../../db/schema/users";
import { verifyPassword, hashPassword, generateUUID } from "../../security/crypto";
import { createAccessToken } from "../../security/jwt";
import { AppError } from "../../security/error-handler";
import { rateLimiter } from "../../security/rate-limiter";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { SECURITY_LIMITS } from "../../config/constants";

export const authRouter = new Hono<AppEnv>();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const registerCustomerSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(SECURITY_LIMITS.MIN_PASSWORD_LENGTH)
    .max(SECURITY_LIMITS.MAX_PASSWORD_LENGTH),
  fullName: z.string().min(2).max(80),
  phone: z.string().optional(),
});

// Tenant Store Login
authRouter.post(
  "/login",
  rateLimiter({ max: 10, windowMs: 60 * 1000 }),
  zValidator("json", loginSchema),
  async (c) => {
    const tenant = c.get("tenant")!;
    const { email, password } = c.req.valid("json");
    const normalizedEmail = email.toLowerCase().trim();

    const db = createDb(c.env.DB);

    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.tenantId, tenant.id), eq(users.email, normalizedEmail)))
      .limit(1);

    if (!user) {
      throw new AppError("Invalid email or password.", 401, "INVALID_CREDENTIALS");
    }

    if (user.status !== "ACTIVE") {
      throw new AppError("Your account has been deactivated. Please contact support.", 403, "ACCOUNT_INACTIVE");
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      throw new AppError("Invalid email or password.", 401, "INVALID_CREDENTIALS");
    }

    // Update last login timestamp
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));

    const secret = c.env.JWT_SECRET || "default-dev-secret-change-in-production";
    const token = await createAccessToken(
      {
        id: user.id,
        tenantId: tenant.id,
        email: user.email,
        role: user.role,
      },
      secret
    );

    return c.json({
      success: true,
      message: "Login successful.",
      data: {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
        },
        accessToken: token,
      },
    });
  }
);

// Register Customer on Storefront
authRouter.post(
  "/register",
  rateLimiter({ max: 5, windowMs: 60 * 1000 }),
  zValidator("json", registerCustomerSchema),
  async (c) => {
    const tenant = c.get("tenant")!;
    const body = c.req.valid("json");
    const normalizedEmail = body.email.toLowerCase().trim();

    const db = createDb(c.env.DB);

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.tenantId, tenant.id), eq(users.email, normalizedEmail)))
      .limit(1);

    if (existing) {
      throw new AppError(
        "An account with this email address already exists for this store.",
        409,
        "EMAIL_EXISTS"
      );
    }

    const userId = generateUUID();
    const hashedPassword = await hashPassword(body.password);

    await db.insert(users).values({
      id: userId,
      tenantId: tenant.id,
      email: normalizedEmail,
      passwordHash: hashedPassword,
      fullName: body.fullName,
      phone: body.phone || null,
      role: "CUSTOMER",
      status: "ACTIVE",
    });

    const secret = c.env.JWT_SECRET || "default-dev-secret-change-in-production";
    const token = await createAccessToken(
      {
        id: userId,
        tenantId: tenant.id,
        email: normalizedEmail,
        role: "CUSTOMER",
      },
      secret
    );

    return c.json(
      {
        success: true,
        message: "Customer account created successfully.",
        data: {
          user: {
            id: userId,
            email: normalizedEmail,
            fullName: body.fullName,
            role: "CUSTOMER",
          },
          accessToken: token,
        },
      },
      201
    );
  }
);

// Current User Profile
authRouter.get("/me", authMiddleware(true), async (c) => {
  const userContext = c.get("user")!;
  const db = createDb(c.env.DB);

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      phone: users.phone,
      role: users.role,
      status: users.status,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(and(eq(users.id, userContext.id), eq(users.tenantId, userContext.tenantId)))
    .limit(1);

  if (!user) {
    throw new AppError("User not found.", 404, "USER_NOT_FOUND");
  }

  return c.json({
    success: true,
    data: user,
  });
});
