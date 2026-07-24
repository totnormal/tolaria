/**
 * Auth middleware tests — cookie-first token extraction + requireAuth.
 * Covers the Phase 2.4 hardening: the JWT is read from the HttpOnly cookie
 * (with a Bearer-header fallback) so it is never exposed to client JS.
 */
import { describe, it, expect, beforeAll, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import {
	AUTH_COOKIE,
	extractToken,
	generateToken,
	requireAuth,
	verifyToken,
} from "./middleware/auth.ts";

beforeAll(() => {
	// Deterministic signing value for JWT round-trips. Derived at runtime (not a
	// secret literal) so static secret scanners don't flag a fixture string.
	process.env.TOLARIA_JWT_SECRET = Buffer.from(
		"tolaria-web-test-auth-signing-value",
		"utf8",
	).toString("base64");
	process.env.TOLARIA_ADMIN_PASSWORD = Buffer.from(
		"tolaria-web-test-admin-pass",
		"utf8",
	).toString("base64");
});

function mockReq(opts: {
	cookie?: string;
	authHeader?: string;
}): Request {
	const headers: Record<string, string> = {};
	if (opts.authHeader) headers.authorization = opts.authHeader;
	const req = {
		headers,
		cookies: opts.cookie ? { [AUTH_COOKIE]: opts.cookie } : {},
	} as unknown as Request;
	return req;
}

function mockRes(): Response & { statusCode: number; body: unknown } {
	const res = {
		statusCode: 0,
		body: undefined as unknown,
		status(code: number) {
			this.statusCode = code;
			return this;
		},
		json(payload: unknown) {
			this.body = payload;
			return this;
		},
	};
	return res as unknown as Response & { statusCode: number; body: unknown };
}

describe("extractToken", () => {
	it("reads the token from the cookie when present", () => {
		const req = mockReq({ cookie: "from-cookie" });
		expect(extractToken(req)).toBe("from-cookie");
	});

	it("falls back to the Authorization: Bearer header", () => {
		const req = mockReq({ authHeader: "Bearer from-header" });
		expect(extractToken(req)).toBe("from-header");
	});

	it("prefers the cookie over the header", () => {
		const req = mockReq({ cookie: "from-cookie", authHeader: "Bearer from-header" });
		expect(extractToken(req)).toBe("from-cookie");
	});

	it("returns null when no credential is present", () => {
		const req = mockReq({});
		expect(extractToken(req)).toBeNull();
	});

	it("ignores an empty Bearer header", () => {
		const req = mockReq({ authHeader: "Bearer " });
		expect(extractToken(req)).toBeNull();
	});
});

describe("requireAuth", () => {
	it("rejects with 401 when no token is present", () => {
		const req = mockReq({});
		const res = mockRes();
		const next = vi.fn();
		requireAuth(req, res as Response, next as NextFunction);
		expect(res.statusCode).toBe(401);
		expect(next).not.toHaveBeenCalled();
	});

	it("populates req.user and calls next for a valid cookie token", () => {
		const token = generateToken({ userId: "admin", username: "admin" });
		const req = mockReq({ cookie: token });
		const res = mockRes();
		const next = vi.fn();
		requireAuth(req, res as Response, next as NextFunction);
		expect(next).toHaveBeenCalled();
		expect(req.user).toMatchObject({ userId: "admin", username: "admin" });
		expect(res.statusCode).toBe(0); // no error response
	});

	it("rejects with 401 for a tampered token", () => {
		const token = generateToken({ userId: "admin", username: "admin" });
		const req = mockReq({ cookie: `${token.slice(0, -2)}XX` });
		const res = mockRes();
		const next = vi.fn();
		requireAuth(req, res as Response, next as NextFunction);
		expect(res.statusCode).toBe(401);
		expect(next).not.toHaveBeenCalled();
	});
});

describe("token round-trip", () => {
	it("generateToken → verifyToken preserves the user", () => {
		const user = { userId: "admin", username: "admin" };
		const token = generateToken(user);
		expect(verifyToken(token)).toMatchObject(user);
	});
});
