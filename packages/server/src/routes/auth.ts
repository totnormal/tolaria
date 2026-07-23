/**
 * Authentication routes — login endpoint.
 */

import bcrypt from "bcryptjs";
import { type Request, type Response, Router } from "express";
import { generateToken } from "../middleware/auth.ts";
import { getConfig } from "../middleware/config.ts";

const router = Router();

// POST /api/auth/login
router.post("/login", (req: Request, res: Response) => {
	try {
		const { username, password } = req.body;
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
		res.json({ token, user: { userId: username, username } });
	} catch (err) {
		res
			.status(500)
			.json({ error: err instanceof Error ? err.message : "Login failed" });
	}
});

// GET /api/auth/me — echo the authenticated user (null if no/invalid token)
router.get("/me", (req: Request, res: Response) => {
	res.json({ user: req.user ?? null });
});

export default router;
