/**
 * Git API routes.
 *
 * Every client-supplied workdir/file path is clamped to the authenticated
 * user's vault root via the security guard; escapes return 400.
 */

import path from "node:path";
import { type Request, type Response, Router } from "express";
import {
	getFileDiff,
	getFileDiffAtCommit,
	getFileHistory,
	getGitRoot,
	getLastCommitInfo,
	getModifiedFiles,
	getVaultPulse,
	gitAuthorIdentity,
	gitCommit,
	gitFileUrl,
	gitPull,
	gitPush,
	gitRemoteStatus,
	hasConflicts,
	isGitRepo,
} from "../lib/gitOps.ts";
import { requireAuth, UnauthorizedError, userId } from "../middleware/auth.ts";
import { getConfig } from "../middleware/config.ts";
import { PathEscapeError, resolveInside } from "../security.ts";

const router = Router();

router.use(requireAuth);

function vaultRoot(req: Request): string {
	return path.join(getConfig().dataDir, "vaults", userId(req));
}

/** Clamp a workdir to the user's vault root (allows the root itself). */
function guardDir(req: Request, clientPath: string | undefined): string {
	if (!clientPath || clientPath.trim() === "") {
		throw new PathEscapeError("Missing path");
	}
	return resolveInside(vaultRoot(req), clientPath);
}

/** Clamp a file path to the user's vault root. */
function guardFile(req: Request, clientPath: string | undefined): string {
	if (!clientPath) throw new PathEscapeError("Missing path");
	return resolveInside(vaultRoot(req), clientPath);
}

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

// POST /api/git/status
router.post("/status", (req: Request, res: Response) => {
	try {
		const workdir = guardDir(req, req.body.path ?? req.body.vault_path);
		if (!isGitRepo(workdir)) {
			res.json({ is_repo: false, files: [], root: null });
			return;
		}
		res.json({
			is_repo: true,
			files: getModifiedFiles(workdir),
			root: getGitRoot(workdir),
		});
	} catch (err) {
		sendError(res, err, "Git status failed");
	}
});

// POST /api/git/diff
router.post("/diff", (req: Request, res: Response) => {
	try {
		const {
			path: filePath,
			vault_path: workdir,
			staged,
			commit_hash: commitHash,
		} = req.body;
		if (!filePath || !workdir) {
			res.status(400).json({ error: "Missing path or vault_path" });
			return;
		}
		const dir = guardDir(req, workdir);
		const diff = commitHash
			? getFileDiffAtCommit(guardFile(req, filePath), commitHash, dir)
			: getFileDiff(guardFile(req, filePath), dir, staged === true);
		res.json({ diff });
	} catch (err) {
		sendError(res, err, "Diff failed");
	}
});

// POST /api/git/history
router.post("/history", (req: Request, res: Response) => {
	try {
		const {
			path: filePath,
			vault_path: workdir,
			max_count: maxCount,
		} = req.body;
		if (!filePath || !workdir) {
			res.status(400).json({ error: "Missing path or vault_path" });
			return;
		}
		res.json(
			getFileHistory(
				guardFile(req, filePath),
				guardDir(req, workdir),
				maxCount || 20,
			),
		);
	} catch (err) {
		sendError(res, err, "History failed");
	}
});

// POST /api/git/pulse
router.post("/pulse", (req: Request, res: Response) => {
	try {
		const { vault_path: workdir, max_count: maxCount } = req.body;
		res.json(getVaultPulse(guardDir(req, workdir), maxCount || 30));
	} catch (err) {
		sendError(res, err, "Pulse failed");
	}
});

// POST /api/git/commit
router.post("/commit", (req: Request, res: Response) => {
	try {
		const { message, vault_path: workdir, files } = req.body;
		if (!message) {
			res.status(400).json({ error: "Missing message" });
			return;
		}
		res.json({ result: gitCommit(message, guardDir(req, workdir), files) });
	} catch (err) {
		sendError(res, err, "Commit failed");
	}
});

// POST /api/git/pull
router.post("/pull", (req: Request, res: Response) => {
	try {
		res.json(gitPull(guardDir(req, req.body.vault_path)));
	} catch (err) {
		sendError(res, err, "Pull failed");
	}
});

// POST /api/git/push
router.post("/push", (req: Request, res: Response) => {
	try {
		res.json(gitPush(guardDir(req, req.body.vault_path)));
	} catch (err) {
		sendError(res, err, "Push failed");
	}
});

// POST /api/git/remote-status
router.post("/remote-status", (req: Request, res: Response) => {
	try {
		res.json(gitRemoteStatus(guardDir(req, req.body.vault_path)));
	} catch (err) {
		sendError(res, err, "Remote status failed");
	}
});

// POST /api/git/last-commit
router.post("/last-commit", (req: Request, res: Response) => {
	try {
		res.json(getLastCommitInfo(guardDir(req, req.body.vault_path)));
	} catch (err) {
		sendError(res, err, "Last commit info failed");
	}
});

// POST /api/git/author-identity
router.post("/author-identity", (req: Request, res: Response) => {
	try {
		res.json(gitAuthorIdentity(guardDir(req, req.body.vault_path)));
	} catch (err) {
		sendError(res, err, "Author identity failed");
	}
});

// POST /api/git/file-url
router.post("/file-url", (req: Request, res: Response) => {
	try {
		const { path: filePath, vault_path: workdir } = req.body;
		if (!filePath || !workdir) {
			res.status(400).json({ error: "Missing path or vault_path" });
			return;
		}
		res.json({
			url: gitFileUrl(guardFile(req, filePath), guardDir(req, workdir)),
		});
	} catch (err) {
		sendError(res, err, "File URL failed");
	}
});

// POST /api/git/is-repo
router.post("/is-repo", (req: Request, res: Response) => {
	try {
		res.json({
			is_repo: isGitRepo(guardDir(req, req.body.path ?? req.body.vault_path)),
		});
	} catch (err) {
		sendError(res, err, "Repo check failed");
	}
});

// hasConflicts is exported by gitOps for future conflict-resolution UI.
void hasConflicts;

export default router;
