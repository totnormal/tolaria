/**
 * Git operations for the Tolaria web server.
 * Wraps git CLI for vault version control.
 */

import { execFileSync } from "node:child_process";
import path from "node:path";

// ── Types ────────────────────────────────────────────────────────────────

export interface GitStatusFile {
	path: string;
	status: "modified" | "added" | "deleted" | "renamed" | "conflict";
	staged: boolean;
}

export interface GitCommitInfo {
	hash: string;
	author: string;
	date: string;
	message: string;
}

export interface GitRemoteStatus {
	ahead: number;
	behind: number;
	hasRemote: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────

function git(args: string[], workdir: string): string {
	try {
		return execFileSync("git", args, {
			cwd: workdir,
			encoding: "utf-8",
			maxBuffer: 10 * 1024 * 1024,
		}).trim();
	} catch {
		return "";
	}
}

function gitSilent(
	args: string[],
	workdir: string,
): { ok: boolean; output: string } {
	try {
		return {
			ok: true,
			output: execFileSync("git", args, {
				cwd: workdir,
				encoding: "utf-8",
				maxBuffer: 10 * 1024 * 1024,
			}).trim(),
		};
	} catch (e: unknown) {
		return {
			ok: false,
			output: e instanceof Error ? e.message : String(e),
		};
	}
}

// ── Repository checks ────────────────────────────────────────────────────

export function isGitRepo(workdir: string): boolean {
	return gitSilent(["rev-parse", "--git-dir"], workdir).ok;
}

export function getGitRoot(workdir: string): string {
	return git(["rev-parse", "--show-toplevel"], workdir);
}

// ── Status ───────────────────────────────────────────────────────────────

export function getModifiedFiles(workdir: string): GitStatusFile[] {
	const output = git(["status", "--porcelain"], workdir);
	if (!output) return [];

	return output.split("\n").map((line) => {
		const statusCode = line.slice(0, 2);
		const filePath = line.slice(3);
		const staged = statusCode[0] !== " " && statusCode[0] !== "?";

		let status: GitStatusFile["status"] = "modified";
		if (statusCode.includes("M")) status = "modified";
		if (statusCode.includes("A")) status = "added";
		if (statusCode.includes("D")) status = "deleted";
		if (statusCode.includes("R")) status = "renamed";
		if (statusCode.includes("U")) status = "conflict";

		return { path: filePath, status, staged };
	});
}

// ── Diff ─────────────────────────────────────────────────────────────────

export function getFileDiff(
	filePath: string,
	workdir: string,
	staged: boolean = false,
): string {
	const args = ["diff"];
	if (staged) args.push("--staged");
	args.push("--", filePath);
	return git(args, workdir);
}

export function getFileDiffAtCommit(
	filePath: string,
	commitHash: string,
	workdir: string,
): string {
	return git(["diff", `${commitHash}^`, commitHash, "--", filePath], workdir);
}

// ── History ──────────────────────────────────────────────────────────────

export function getFileHistory(
	filePath: string,
	workdir: string,
	maxCount: number = 20,
): GitCommitInfo[] {
	const output = git(
		["log", `-${maxCount}`, "--format=%H|%an|%ai|%s", "--", filePath],
		workdir,
	);
	if (!output) return [];

	return output.split("\n").map((line) => {
		const [hash, author, date, ...msgParts] = line.split("|");
		return { hash, author, date, message: msgParts.join("|") };
	});
}

export function getVaultPulse(
	workdir: string,
	maxCount: number = 30,
): GitCommitInfo[] {
	const output = git(
		["log", `-${maxCount}`, "--format=%H|%an|%ai|%s", "--", "*.md"],
		workdir,
	);
	if (!output) return [];
	return output.split("\n").map((line) => {
		const [hash, author, date, ...msgParts] = line.split("|");
		return { hash, author, date, message: msgParts.join("|") };
	});
}

// ── Commit ───────────────────────────────────────────────────────────────

export function gitCommit(
	message: string,
	workdir: string,
	files?: string[],
): string {
	const args = ["commit"];
	if (files && files.length > 0) {
		git(["add", ...files], workdir);
	} else {
		git(["add", "-A"], workdir);
	}
	args.push("-m", message);
	return git(args, workdir);
}

export function getLastCommitInfo(
	workdir: string,
): { hash: string; message: string } | null {
	const output = git(["log", "-1", "--format=%H|%s"], workdir);
	if (!output) return null;
	const [hash, ...msgParts] = output.split("|");
	return { hash, message: msgParts.join("|") };
}

// ── Push / Pull ──────────────────────────────────────────────────────────

export function gitPull(workdir: string): { ok: boolean; output: string } {
	return gitSilent(["pull", "--rebase"], workdir);
}

export function gitPush(workdir: string): { ok: boolean; output: string } {
	return gitSilent(["push"], workdir);
}

export function gitRemoteStatus(workdir: string): GitRemoteStatus {
	const remoteExist = gitSilent(["remote", "get-url", "origin"], workdir);
	if (!remoteExist.ok) return { ahead: 0, behind: 0, hasRemote: false };

	// Fetch to get accurate counts
	gitSilent(["fetch", "--quiet"], workdir);

	const branch = git(["rev-parse", "--abbrev-ref", "HEAD"], workdir);
	const ahead = git(
		[`rev-list`, `origin/${branch}..${branch}`, "--count"],
		workdir,
	);
	const behind = git(
		[`rev-list`, `${branch}..origin/${branch}`, "--count"],
		workdir,
	);

	return {
		ahead: parseInt(ahead, 10) || 0,
		behind: parseInt(behind, 10) || 0,
		hasRemote: true,
	};
}

// ── Clone ────────────────────────────────────────────────────────────────

export function gitClone(
	url: string,
	targetPath: string,
): { ok: boolean; output: string } {
	return gitSilent(["clone", url, targetPath], path.dirname(targetPath));
}

// ── Git config ───────────────────────────────────────────────────────────

export function gitAuthorIdentity(workdir: string): {
	name: string;
	email: string;
} {
	const name = git(["config", "user.name"], workdir) || "Tolaria Web";
	const email = git(["config", "user.email"], workdir) || "web@tolaria.local";
	return { name, email };
}

export function setGitConfig(
	workdir: string,
	name: string,
	email: string,
): void {
	git(["config", "user.name", name], workdir);
	git(["config", "user.email", email], workdir);
}

// ── Conflict resolution ──────────────────────────────────────────────────

export function hasConflicts(workdir: string): boolean {
	const output = git(["diff", "--name-only", "--diff-filter=U"], workdir);
	return output.length > 0;
}

export function resolveConflict(
	filePath: string,
	strategy: "ours" | "theirs",
	workdir: string,
): void {
	git(["checkout", `--${strategy}`, filePath], workdir);
	git(["add", filePath], workdir);
}

// ── Init ─────────────────────────────────────────────────────────────────

export function initGitRepo(workdir: string): { ok: boolean; output: string } {
	return gitSilent(["init"], workdir);
}

export function gitAddRemote(workdir: string, name: string, url: string): void {
	git(["remote", "add", name, url], workdir);
}

// ── Git file URL ─────────────────────────────────────────────────────────

export function gitFileUrl(filePath: string, workdir: string): string | null {
	const remoteUrl = git(["remote", "get-url", "origin"], workdir);
	if (!remoteUrl) return null;

	// Convert git@github.com:user/repo.git → https://github.com/user/repo
	const baseUrl = remoteUrl
		.replace(/^git@github\.com:/, "https://github.com/")
		.replace(/\.git$/, "");

	const gitRoot = getGitRoot(workdir);
	const relative = path.relative(gitRoot, filePath);

	const branch = git(["rev-parse", "--abbrev-ref", "HEAD"], workdir);
	return `${baseUrl}/blob/${branch}/${relative}`;
}
