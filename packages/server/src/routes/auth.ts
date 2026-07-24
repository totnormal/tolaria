/**
 * Authentication routes — login / logout / refresh / me.
 *
 * The JWT lives in an HttpOnly + SameSite=Lax + Secure(in prod) cookie, set on
 * `/login` and cleared on `/logout`. `/me` and `/refresh` require an existing
 * valid session. `/login` is rate-limited to blunt brute-force attempts.
 */
import rateLimit from "express-rate-limit";
import { type Request, type Response, Router } from "express";
import bcrypt from "bcryptjs";
import {
	AUTH_COOKIE,
	generateToken,
	requireAuth,
} from "../middleware/auth.ts";
import { getConfig } from "../middleware/config.ts";

const router = Router();

/** Cookie attributes — HttpOnly (XSS-safe), SameSite=Lax (CSRF-safe for same-origin). */
function authCookieOptions() {
	const secure =
		process.env.TOLARIA_SECURE_COOKIE === "true" ||
		process.env.NODE_ENV === "production";
	return {
		httpOnly: true,
		sameSite: "lax" as const,
		secure,
		path: "/",
		maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days, matches JWT expiresIn default
	};
}

/** Brute-force throttle on the login endpoint (per-IP, behind trust-proxy). */
const loginLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 20,
	standardHeaders: "draft-7",
	legacyHeaders: false,
	message: { error: "Too many login attempts, please try again later." },
});

// POST /api/auth/login — validate credentials, set the auth cookie.
router.post("/login", loginLimiter, (req: Request, res: Response) => {
	try {
		const { username, password } = req.body as {
			username?: string;
			password?: string;
		};
		if (!username || !password) {
			res.status(400).json({ error: "Username and password required" });
			return;
		}

		const user = getConfig().auth.users.find((u) => u.username === username);
		if (!user) {
			res.status(401).json({ error: "Invalid credentials" });
			return;
		}

		const valid = bcrypt.compareSync(password, user.passwordHash);
		if (!valid) {
			res.status(401).json({ error: "Invalid credentials" });
			return;
		}

		const token = generateToken({ userId: username, username });
		res.cookie(AUTH_COOKIE, token, authCookieOptions());
		res.json({ user: { userId: username, username } });
	} catch (err) {
		res
			.status(500)
			.json({ error: err instanceof Error ? err.message : "Login failed" });
	}
});

// POST /api/auth/logout — clear the auth cookie.
router.post("/logout", (_req: Request, res: Response) => {
	res.clearCookie(AUTH_COOKIE, authCookieOptions());
	res.json({ ok: true });
});

// GET /api/auth/me — echo the authenticated user (401 if not authenticated).
router.get("/me", requireAuth, (req: Request, res: Response) => {
	res.json({ user: req.user });
});

// POST /api/auth/refresh — rotate the cookie (sliding session).
router.post("/refresh", requireAuth, (req: Request, res: Response) => {
	const user = req.user;
	if (!user) {
		res.status(401).json({ error: "Authentication required" });
		return;
	}
	const token = generateToken(user);
	res.cookie(AUTH_COOKIE, token, authCookieOptions());
	res.json({ user });
});

export default router;
