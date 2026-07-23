/**
 * Settings routes — user settings persistence.
 * Mirrors the desktop Tolaria settings structure.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { type Request, type Response, Router } from "express";
import { requireAuth, userId } from "../middleware/auth.ts";
import { getConfig } from "../middleware/config.ts";

const router = Router();

router.use(requireAuth);

function settingsPath(uid: string): string {
	return path.join(getConfig().dataDir, "users", uid, "settings.json");
}

function ensureUserDir(uid: string): void {
	const dir = path.join(getConfig().dataDir, "users", uid);
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

// GET /api/settings
router.get("/", (req: Request, res: Response) => {
	try {
		const filePath = settingsPath(userId(req));
		ensureUserDir(userId(req));

		if (!existsSync(filePath)) {
			res.json({}); // default empty settings
			return;
		}
		const data = JSON.parse(readFileSync(filePath, "utf-8"));
		res.json(data);
	} catch (err) {
		res.status(500).json({
			error: err instanceof Error ? err.message : "Settings read failed",
		});
	}
});

// PUT /api/settings
router.put("/", (req: Request, res: Response) => {
	try {
		const filePath = settingsPath(userId(req));
		ensureUserDir(userId(req));
		writeFileSync(filePath, JSON.stringify(req.body, null, 2));
		res.json({ ok: true });
	} catch (err) {
		res.status(500).json({
			error: err instanceof Error ? err.message : "Settings save failed",
		});
	}
});

// GET /api/settings/vault-list
router.get("/vault-list", (req: Request, res: Response) => {
	try {
		const filePath = path.join(
			getConfig().dataDir,
			"users",
			userId(req),
			"vaults.json",
		);
		ensureUserDir(userId(req));

		if (!existsSync(filePath)) {
			res.json({ vaults: [], active_vault: null });
			return;
		}
		const data = JSON.parse(readFileSync(filePath, "utf-8"));
		res.json(data);
	} catch (err) {
		res.status(500).json({
			error: err instanceof Error ? err.message : "Vault list read failed",
		});
	}
});

// PUT /api/settings/vault-list
router.put("/vault-list", (req: Request, res: Response) => {
	try {
		const filePath = path.join(
			getConfig().dataDir,
			"users",
			userId(req),
			"vaults.json",
		);
		ensureUserDir(userId(req));
		writeFileSync(filePath, JSON.stringify(req.body, null, 2));
		res.json({ ok: true });
	} catch (err) {
		res.status(500).json({
			error: err instanceof Error ? err.message : "Vault list save failed",
		});
	}
});

export default router;
