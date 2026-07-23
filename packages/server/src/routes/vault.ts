/**
 * Vault API routes — Express implementation of the Tolaria vault commands.
 * Ported from the Vite middleware (vite.config.ts).
 *
 * Every client-supplied path is clamped to the authenticated user's vault root
 * via {@link guardPath} (packages/server/src/security.ts). Escapes return 400.
 */

import path from "node:path";
import { type Request, type Response, Router } from "express";
import {
	createNote,
	deleteNote,
	getAllContent,
	getNoteContent,
	listVault,
	parseMarkdownFile,
	renameNote,
	renameNoteFilename,
	saveNote,
	searchVault,
} from "../lib/vaultOps.ts";
import { requireAuth, UnauthorizedError, userId } from "../middleware/auth.ts";
import { getConfig } from "../middleware/config.ts";
import { PathEscapeError, resolveInside } from "../security.ts";

const router = Router();

// All vault routes require authentication
router.use(requireAuth);

/** The authenticated user's vault root directory. */
function vaultRoot(req: Request): string {
	const config = getConfig();
	return path.join(config.dataDir, "vaults", userId(req));
}

/**
 * Clamp a client-supplied path to inside the user's vault root.
 * Throws {@link PathEscapeError} on any escape (mapped to 400 by {@link sendError}).
 */
function guardPath(req: Request, clientPath: string | undefined): string {
	return resolveInside(vaultRoot(req), clientPath ?? "");
}

/** Like {@link guardPath} but falls back to the vault root when path is absent. */
function guardDir(req: Request, clientPath: string | undefined): string {
	if (!clientPath || clientPath.trim() === "") return vaultRoot(req);
	return resolveInside(vaultRoot(req), clientPath);
}

/** Reject names that become filenames (no path separators, no traversal). */
function safeName(value: string, field: string): string {
	if (
		!value ||
		value.includes("/") ||
		value.includes("\\") ||
		value === "." ||
		value === ".."
	) {
		throw new PathEscapeError(`Invalid ${field}`);
	}
	return value;
}

/** Send an error response, mapping path-escape attempts to 400. */
function sendError(res: Response, err: unknown, fallback: string): void {
	const message = err instanceof Error ? err.message : fallback;
	res
		.status(
			err instanceof PathEscapeError
				? 400
				: err instanceof UnauthorizedError
					? 401
					: 500,
		)
		.json({ error: message });
}

// GET /api/vault/ping
router.get("/ping", (_req: Request, res: Response) => {
	res.json({ ok: true });
});

// GET /api/vault/list
router.get("/list", (req: Request, res: Response) => {
	try {
		const vaultPath = guardDir(req, req.query.path as string);
		res.json(listVault(vaultPath));
	} catch (err) {
		sendError(res, err, "Vault list failed");
	}
});

// GET /api/vault/content
router.get("/content", (req: Request, res: Response) => {
	try {
		const filePath = guardPath(req, req.query.path as string);
		const content = getNoteContent(filePath);
		if (content === null) {
			res.status(404).json({ error: "Note not found" });
			return;
		}
		res.json({ content });
	} catch (err) {
		sendError(res, err, "Read failed");
	}
});

// GET /api/vault/all-content
router.get("/all-content", (req: Request, res: Response) => {
	try {
		const vaultPath = guardDir(req, req.query.path as string);
		res.json(getAllContent(vaultPath));
	} catch (err) {
		sendError(res, err, "Read all content failed");
	}
});

// GET /api/vault/entry
router.get("/entry", (req: Request, res: Response) => {
	try {
		const filePath = guardPath(req, req.query.path as string);
		const entry = parseMarkdownFile(filePath);
		if (!entry) {
			res.status(404).json({ error: "Note not found" });
			return;
		}
		res.json(entry);
	} catch (err) {
		sendError(res, err, "Entry read failed");
	}
});

// GET /api/vault/search
router.get("/search", (req: Request, res: Response) => {
	try {
		const vaultPath = guardDir(req, req.query.vault_path as string);
		const query = req.query.query as string;
		const excludeFm = req.query.exclude_frontmatter === "true";

		if (!query) {
			res.json({ results: [], elapsed_ms: 0, query: "", mode: "all" });
			return;
		}

		const results = searchVault(vaultPath, query, excludeFm);
		res.json({ results, elapsed_ms: 1, query, mode: "all" });
	} catch (err) {
		sendError(res, err, "Search failed");
	}
});

// POST /api/vault/save
router.post("/save", (req: Request, res: Response) => {
	try {
		const { path: filePath, content } = req.body;
		if (!filePath || content === undefined) {
			res.status(400).json({ error: "Missing path or content" });
			return;
		}
		saveNote(guardPath(req, filePath), content);
		res.json(null);
	} catch (err) {
		sendError(res, err, "Save failed");
	}
});

// POST /api/vault/create
router.post("/create", (req: Request, res: Response) => {
	try {
		const { path: filePath, content } = req.body;
		if (!filePath || content === undefined) {
			res.status(400).json({ error: "Missing path or content" });
			return;
		}
		createNote(guardPath(req, filePath), content);
		res.json({ path: filePath });
	} catch (err) {
		sendError(res, err, "Create failed");
	}
});

// POST /api/vault/rename
router.post("/rename", (req: Request, res: Response) => {
	try {
		const {
			old_path: oldPath,
			new_title: newTitle,
			vault_path: vaultPath,
		} = req.body;
		if (!oldPath || !newTitle) {
			res.status(400).json({ error: "Missing rename input" });
			return;
		}
		const result = renameNote(
			guardPath(req, oldPath),
			newTitle,
			guardDir(req, vaultPath),
		);
		res.json(result);
	} catch (err) {
		sendError(res, err, "Rename failed");
	}
});

// POST /api/vault/rename-filename
router.post("/rename-filename", (req: Request, res: Response) => {
	try {
		const {
			old_path: oldPath,
			new_filename_stem: newStem,
			vault_path: vaultPath,
		} = req.body;
		if (!oldPath || !newStem) {
			res.status(400).json({ error: "Missing rename input" });
			return;
		}
		const result = renameNoteFilename(
			guardPath(req, oldPath),
			safeName(newStem, "new_filename_stem"),
			guardDir(req, vaultPath),
		);
		res.json(result);
	} catch (err) {
		const message = err instanceof Error ? err.message : "Rename failed";
		res
			.status(
				message.includes("already exists")
					? 409
					: err instanceof PathEscapeError
						? 400
						: 500,
			)
			.json({ error: message });
	}
});

// POST /api/vault/delete
router.post("/delete", (req: Request, res: Response) => {
	try {
		const { path: filePath } = req.body;
		if (!filePath) {
			res.status(400).json({ error: "Missing path" });
			return;
		}
		deleteNote(guardPath(req, filePath));
		res.json(filePath);
	} catch (err) {
		sendError(res, err, "Delete failed");
	}
});

// POST /api/vault/command — generic Tauri command dispatcher
router.post("/command", (req: Request, res: Response) => {
	try {
		const { cmd, args } = req.body;
		if (!cmd || !args) {
			res.status(400).json({ error: "Missing cmd or args" });
			return;
		}

		switch (cmd) {
			case "list_vault":
			case "reload_vault": {
				res.json(listVault(guardDir(req, args.path)));
				break;
			}
			case "get_note_content":
			case "validate_note_content": {
				const content = getNoteContent(guardPath(req, args.path));
				if (content === null) {
					res.status(404).json({ error: "Note not found" });
					return;
				}
				res.json({ content });
				break;
			}
			case "get_all_content": {
				res.json(getAllContent(guardDir(req, args.path)));
				break;
			}
			case "reload_vault_entry": {
				const entry = parseMarkdownFile(guardPath(req, args.path));
				if (!entry) {
					res.status(404).json({ error: "Note not found" });
					return;
				}
				res.json(entry);
				break;
			}
			case "save_note_content": {
				saveNote(guardPath(req, args.path), args.content);
				res.json(null);
				break;
			}
			case "delete_note": {
				deleteNote(guardPath(req, args.path));
				res.json(args.path);
				break;
			}
			case "rename_note": {
				res.json(
					renameNote(
						guardPath(req, args.old_path),
						args.new_title,
						guardDir(req, args.vault_path),
					),
				);
				break;
			}
			case "rename_note_filename": {
				res.json(
					renameNoteFilename(
						guardPath(req, args.old_path),
						safeName(args.new_filename_stem, "new_filename_stem"),
						guardDir(req, args.vault_path),
					),
				);
				break;
			}
			case "search_vault": {
				const vaultPath = guardDir(req, args.vault_path);
				const results = args.query
					? searchVault(vaultPath, args.query, args.exclude_frontmatter)
					: [];
				res.json({
					results,
					elapsed_ms: 1,
					query: args.query || "",
					mode: "all",
				});
				break;
			}
			default:
				res.status(404).json({ error: `Unsupported vault command: ${cmd}` });
		}
	} catch (err) {
		sendError(res, err, "Vault command failed");
	}
});

export default router;
