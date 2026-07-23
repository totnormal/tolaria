/**
 * Tolaria Web Server — Express backend that replaces Tauri IPC.
 *
 * Serves the Tolaria React frontend and provides REST API endpoints
 * for vault operations, Git sync, AI agent streaming, auth, and settings.
 *
 * Dev mode (TOLARIA_DEV=true): API only — Vite serves frontend on :5202
 * Prod mode: serves built React app from ../dist/
 */

import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import type { Request, Response } from "express";
import express from "express";
import { getConfig } from "./middleware/config.ts";
import authRoutes from "./routes/auth.ts";
import gitRoutes from "./routes/git.ts";
import settingsRoutes from "./routes/settings.ts";
import vaultRoutes from "./routes/vault.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const config = getConfig();

// ── Middleware ────────────────────────────────────────────────────────────

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));

// ── API Routes ───────────────────────────────────────────────────────────

app.use("/api/vault", vaultRoutes);
app.use("/api/git", gitRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/settings", settingsRoutes);

// GET /api/mcp/info — MCP bridge info
app.get("/api/mcp/info", (_req: Request, res: Response) => {
	res.json({ wsUrl: `ws://localhost:${config.port + 1}`, available: false });
});

// GET /api/health
app.get("/api/health", (_req: Request, res: Response) => {
	res.json({ status: "ok", version: "0.1.0" });
});

// ── Frontend serving ─────────────────────────────────────────────────────

const isDev = process.env.TOLARIA_DEV === "true";

if (isDev) {
	console.log(
		"[tolaria-server] Dev mode — API only. Run Vite on :5202 for frontend.",
	);
} else {
	const distPath = path.join(__dirname, "..", "..", "dist");
	if (existsSync(distPath)) {
		app.use(express.static(distPath));
		app.get("*", (_req: Request, res: Response) => {
			res.sendFile(path.join(distPath, "index.html"));
		});
		console.log(`[tolaria-server] Serving frontend from ${distPath}`);
	} else {
		console.log(
			'[tolaria-server] No dist/ found. Build with "pnpm build" in tolaria root, or set TOLARIA_DEV=true',
		);
	}
}

// ── Boot ──────────────────────────────────────────────────────────────────

app.listen(config.port, () => {
	console.log(`[tolaria-server] Listening on http://localhost:${config.port}`);
	console.log(`[tolaria-server] Data directory: ${config.dataDir}`);
	console.log(
		`[tolaria-server] Auth enabled: ${config.auth.users.length > 0 ? "yes" : "no"}`,
	);
});
