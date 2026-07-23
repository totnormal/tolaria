/**
 * Path-containment guard for the Tolaria web server.
 *
 * Every client-supplied path is resolved against the authenticated user's
 * vault root and rejected if it escapes — lexically (`..`, absolute) or via a
 * symlink. This is defense-in-depth for a single-user deployment: even if a JWT
 * leaks, an attacker cannot read/write files outside the vault.
 */
import { realpathSync } from "node:fs";
import path from "node:path";

export class PathEscapeError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "PathEscapeError";
	}
}

/** True when `candidate` is `root` itself or nested below it. */
function isUnder(root: string, candidate: string): boolean {
	const rel = path.relative(root, candidate);
	return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

/** Realpath of the deepest existing ancestor of `target` (for new files). */
function deepestExistingAncestor(target: string): string {
	let p = path.resolve(target);
	while (true) {
		try {
			return realpathSync(p);
		} catch {
			const parent = path.dirname(p);
			if (parent === p) return p;
			p = parent;
		}
	}
}

/**
 * Resolve `target` against `root`, allowing absolute targets only when they
 * already sit inside `root`. Throws {@link PathEscapeError} on any escape.
 */
export function resolveInside(root: string, target: string): string {
	if (!target || typeof target !== "string" || target.trim() === "") {
		throw new PathEscapeError("Path must not be empty");
	}
	const resolvedRoot = path.resolve(root);
	const candidate = path.isAbsolute(target)
		? path.resolve(target)
		: path.resolve(resolvedRoot, target);

	if (!isUnder(resolvedRoot, candidate)) {
		throw new PathEscapeError("Path escapes the vault root");
	}
	// Symlink escape check: compare REAL paths, not lexical — the root itself
	// may live under a symlink (e.g. macOS /var -> /private/var).
	const realRoot = realpathSync(resolvedRoot);
	const ancestor = deepestExistingAncestor(candidate);
	if (!isUnder(realRoot, ancestor)) {
		throw new PathEscapeError("Path escapes the vault root via symlink");
	}
	return candidate;
}

/**
 * Route helper: clamp a client-supplied path to inside `root`, falling back to
 * a default note path when none is provided.
 */
export function resolveVaultPath(
	root: string,
	clientPath: string | undefined,
): string {
	if (!clientPath || clientPath.trim() === "") {
		return path.join(root, "untitled.md");
	}
	return resolveInside(root, clientPath);
}
