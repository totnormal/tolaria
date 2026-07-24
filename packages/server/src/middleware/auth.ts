/**
 * JWT authentication middleware.
 * Single-user by default, multi-user ready.
 *
 * Tokens are carried in an HttpOnly cookie (`tolaria_token`) so they are not
 * reachable by JavaScript (XSS-safe). The `Authorization: Bearer …` header is
 * still accepted as a fallback for API clients and tests.
 */
import type { NextFunction, Request, Response } from "express";
import type { SignOptions } from "jsonwebtoken";
import jwt from "jsonwebtoken";
import { getConfig } from "./config.ts";

export interface AuthUser {
	userId: string;
	username: string;
}

declare global {
	// eslint-disable-next-line @typescript-eslint/no-namespace
	namespace Express {
		interface Request {
			user?: AuthUser;
			cookies?: Record<string, string>;
		}
	}
}

export function generateToken(user: AuthUser): string {
	const { secret, expiresIn } = getConfig().auth;
	return jwt.sign(user as object, secret, { expiresIn } as SignOptions);
}

export function verifyToken(token: string): AuthUser {
	const { secret } = getConfig().auth;
	return jwt.verify(token, secret) as AuthUser;
}

/** Cookie name carrying the JWT. */
export const AUTH_COOKIE = "tolaria_token";

/**
 * Resolve the bearer token for a request — cookie first (browser), then the
 * `Authorization: Bearer` header (API clients / tests). Returns `null` when
 * no usable credential is present.
 */
export function extractToken(req: Request): string | null {
	const cookieToken = req.cookies?.[AUTH_COOKIE];
	if (typeof cookieToken === "string" && cookieToken.length > 0) {
		return cookieToken;
	}
	const header = req.headers.authorization;
	if (typeof header === "string" && header.startsWith("Bearer ")) {
		const token = header.slice(7);
		if (token.length > 0) return token;
	}
	return null;
}

export function optionalAuth(
	req: Request,
	_res: Response,
	next: NextFunction,
): void {
	const token = extractToken(req);
	if (token) {
		try {
			req.user = verifyToken(token);
		} catch {
			/* invalid token — proceed as unauthenticated */
		}
	}
	next();
}

export function requireAuth(
	req: Request,
	res: Response,
	next: NextFunction,
): void {
	const token = extractToken(req);
	if (!token) {
		res.status(401).json({ error: "Authentication required" });
		return;
	}

	try {
		req.user = verifyToken(token);
		next();
	} catch {
		res.status(401).json({ error: "Invalid or expired token" });
	}
}

/** Thrown when an authenticated user is required but absent. Maps to HTTP 401. */
export class UnauthorizedError extends Error {
	constructor() {
		super("Authentication required");
		this.name = "UnauthorizedError";
	}
}

/** Return the authenticated user's id, throwing if absent (requireAuth runs first). */
export function userId(req: Request): string {
	const id = req.user?.userId;
	if (!id) throw new UnauthorizedError();
	return id;
}
