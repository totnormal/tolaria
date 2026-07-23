import { mkdtempSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	PathEscapeError,
	resolveInside,
	resolveVaultPath,
} from "./security.ts";

describe("resolveInside — path containment guard", () => {
	const root = mkdtempSync(join(tmpdir(), "tolaria-sec-"));

	it("resolves a relative path inside the vault root", () => {
		const res = resolveInside(root, "note.md");
		expect(res).toBe(join(root, "note.md"));
	});

	it("resolves a nested relative path", () => {
		const res = resolveInside(root, "research/source-notes.md");
		expect(res).toBe(join(root, "research", "source-notes.md"));
	});

	it("accepts an absolute path that is already inside root", () => {
		const abs = join(root, "inside.md");
		const res = resolveInside(root, abs);
		expect(res).toBe(abs);
	});

	it("rejects parent-directory traversal (../../etc/passwd)", () => {
		expect(() => resolveInside(root, "../../etc/passwd")).toThrow(
			PathEscapeError,
		);
	});

	it("rejects traversal hidden mid-path (sub/../../etc)", () => {
		expect(() => resolveInside(root, "sub/../../etc/shadow")).toThrow(
			PathEscapeError,
		);
	});

	it("rejects an absolute path outside the vault root", () => {
		expect(() => resolveInside(root, "/etc/passwd")).toThrow(PathEscapeError);
	});

	it("rejects empty / whitespace-only paths", () => {
		expect(() => resolveInside(root, "")).toThrow(PathEscapeError);
		expect(() => resolveInside(root, "   ")).toThrow(PathEscapeError);
	});

	it("rejects symlink escapes pointing outside root", () => {
		const linkDir = mkdtempSync(join(tmpdir(), "tolaria-out-"));
		symlinkSync(linkDir, join(root, "escape-link"));
		expect(() => resolveInside(root, "escape-link/secret.md")).toThrow(
			PathEscapeError,
		);
	});
});

describe("resolveVaultPath — route helper", () => {
	const root = mkdtempSync(join(tmpdir(), "tolaria-rvp-"));

	it("clamps a client path to inside the vault root", () => {
		expect(resolveVaultPath(root, "a/b.md")).toBe(join(root, "a", "b.md"));
	});

	it("falls back to the default note path when client path is absent", () => {
		expect(resolveVaultPath(root, undefined)).toBe(join(root, "untitled.md"));
	});

	it("rejects escapes instead of clamping them silently", () => {
		expect(() => resolveVaultPath(root, "../evil.md")).toThrow(PathEscapeError);
	});
});
