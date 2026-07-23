/**
 * JWT authentication middleware.
 * Single-user by default, multi-user ready.
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

export function optionalAuth(
	req: Request,
	_res: Response,
	next: NextFunction,
): void {
	const header = req.headers.authorization;
	if (header?.startsWith("Bearer ")) {
		try {
			req.user = verifyToken(header.slice(7));
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
	const header = req.headers.authorization;
	if (!header?.startsWith("Bearer ")) {
		res.status(401).json({ error: "Authentication required" });
		return;
	}

	try {
		req.user = verifyToken(header.slice(7));
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
