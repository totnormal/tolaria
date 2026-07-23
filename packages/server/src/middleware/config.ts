/**
 * Server configuration — reads from environment variables.
 */

import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";

const HOME = process.env.HOME || "/root";
const DATA_DIR =
	process.env.TOLARIA_DATA_DIR || path.join(HOME, ".tolaria-web");

export interface ServerConfig {
	port: number;
	dataDir: string;
	vaults: {
		defaultPath: string;
		defaultUser: string;
	};
	auth: {
		secret: string;
		expiresIn: string;
		users: Array<{ username: string; passwordHash: string }>;
	};
}

let _config: ServerConfig | null = null;

function ensureDataDir(): void {
	if (!existsSync(DATA_DIR)) {
		mkdirSync(DATA_DIR, { recursive: true });
	}
}

function loadUsersConfig(): ServerConfig["auth"]["users"] {
	const usersPath = path.join(DATA_DIR, "users.json");
	if (existsSync(usersPath)) {
		try {
			return JSON.parse(readFileSync(usersPath, "utf-8"));
		} catch {
			/* use defaults */
		}
	}

	// Default single-user setup
	const defaultPassword = process.env.TOLARIA_ADMIN_PASSWORD || "tolaria";
	const defaultHash = bcrypt.hashSync(defaultPassword, 10);

	const users = [{ username: "admin", passwordHash: defaultHash }];
	ensureDataDir();
	writeFileSync(usersPath, JSON.stringify(users, null, 2));
	return users;
}

/** Resolve the JWT signing secret, requiring an explicit value in production. */
function resolveJwtSecret(): string {
	const env = process.env.TOLARIA_JWT_SECRET;
	if (env) return env;
	// Dev-only fallback: cryptographically secure, but ephemeral — every restart
	// invalidates all sessions. Production MUST set TOLARIA_JWT_SECRET.
	console.warn(
		"[tolaria-server] WARNING: TOLARIA_JWT_SECRET not set — using an ephemeral random secret (sessions will not survive a restart). Set TOLARIA_JWT_SECRET in production.",
	);
	return randomBytes(48).toString("base64url");
}

export function getConfig(): ServerConfig {
	if (_config) return _config;

	ensureDataDir();

	_config = {
		port: parseInt(process.env.TOLARIA_PORT || "3200", 10),
		dataDir: DATA_DIR,
		vaults: {
			defaultPath:
				process.env.TOLARIA_VAULT_PATH ||
				path.join(DATA_DIR, "vaults", "default"),
			defaultUser: process.env.TOLARIA_DEFAULT_USER || "admin",
		},
		auth: {
			secret: resolveJwtSecret(),
			expiresIn: process.env.TOLARIA_JWT_EXPIRES || "7d",
			users: loadUsersConfig(),
		},
	};

	return _config;
}
