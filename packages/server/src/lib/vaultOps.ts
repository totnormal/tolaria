/**
 * Vault operations — ported from the Vite middleware vault API (vite.config.ts).
 * Reads and writes Markdown files with YAML frontmatter from a local filesystem vault.
 */

import {
	closeSync,
	type Dirent,
	fstatSync,
	mkdirSync,
	opendirSync,
	openSync,
	readFileSync,
	renameSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import path from "node:path";
import matter from "gray-matter";

// ── Types ────────────────────────────────────────────────────────────────

export interface VaultEntry {
	path: string;
	filename: string;
	title: string;
	isA: string | null;
	aliases: string[];
	belongsTo: string[];
	relatedTo: string[];
	status: string | null;
	archived: boolean;
	trashed: boolean;
	trashedAt: number | null;
	modifiedAt: number | null;
	createdAt: number | null;
	fileSize: number;
	snippet: string;
	wordCount: number;
	relationships: Record<string, string[]>;
	icon: string | null;
	color: string | null;
	order: number | null;
	sidebarLabel: string | null;
	template: string | null;
	sort: string | null;
	view: string | null;
	visible: boolean | null;
	outgoingLinks: string[];
	properties: Record<string, string | number | boolean | null>;
}

export type FrontmatterPropertyValue = string | number | boolean | null;

export interface VaultSearchResult {
	title: string;
	path: string;
	snippet: string;
	score: number;
	note_type: string | null;
}

export interface RenameResult {
	new_path: string;
	updated_files: number;
}

// ── Filesystem primitives ────────────────────────────────────────────────

function readUtf8File(filePath: string): string {
	const fd = openSync(filePath, "r");
	try {
		return readFileSync(fd, "utf-8");
	} finally {
		closeSync(fd);
	}
}

function writeUtf8File(filePath: string, content: string): void {
	mkdirSync(path.dirname(filePath), { recursive: true });
	const fd = openSync(filePath, "w");
	try {
		writeFileSync(fd, content, "utf-8");
	} finally {
		closeSync(fd);
	}
}

function pathStats(filePath: string) {
	const fd = openSync(filePath, "r");
	try {
		return fstatSync(fd);
	} finally {
		closeSync(fd);
	}
}

function pathExists(filePath: string): boolean {
	try {
		pathStats(filePath);
		return true;
	} catch {
		return false;
	}
}

function directoryEntries(dir: string): Dirent[] {
	const directory = opendirSync(dir);
	try {
		const entries: Dirent[] = [];
		let entry = directory.readSync();
		while (entry) {
			entries.push(entry);
			entry = directory.readSync();
		}
		return entries;
	} finally {
		directory.closeSync();
	}
}

function resolveInside(root: string, target: string): string | null {
	const normalizedTarget = path.normalize(target);
	if (path.isAbsolute(normalizedTarget)) return null;
	const candidate = path.normalize(`${root}${path.sep}${normalizedTarget}`);
	const relative = path.relative(root, candidate);
	return relative === "" ||
		(!relative.startsWith("..") && !path.isAbsolute(relative))
		? candidate
		: null;
}

// ── WikiLink extraction ──────────────────────────────────────────────────

function extractWikiLinks(value: string): string[] {
	const matches = value.match(/\[\[[^\]]+\]\]/g);
	return matches ?? [];
}

function wikiLinksFromValue(value: unknown): string[] {
	return collectWikiLinksFromValue(value, 0);
}

function collectWikiLinksFromValue(value: unknown, depth: number): string[] {
	if (typeof value === "string") return extractWikiLinks(value);
	if (!Array.isArray(value)) return [];
	const nestedLink = nestedFlowWikilink(value, depth);
	if (nestedLink) return [nestedLink];
	return value.flatMap((item) => collectWikiLinksFromValue(item, depth + 1));
}

function nestedFlowWikilink(value: unknown[], depth: number): string | null {
	if (depth === 0 || value.length !== 1 || typeof value[0] !== "string")
		return null;
	return extractWikiLinks(value[0]).length === 0 ? `[[${value[0]}]]` : null;
}

// ── Frontmatter parsing ──────────────────────────────────────────────────

const DEDICATED_KEYS = new Set(
	[
		"aliases",
		"is_a",
		"is a",
		"type",
		"status",
		"title",
		"_archived",
		"archived",
		"_icon",
		"icon",
		"color",
		"_order",
		"order",
		"_sidebar_label",
		"sidebar_label",
		"sidebar label",
		"template",
		"_sort",
		"sort",
		"view",
		"_width",
		"width",
		"visible",
		"_organized",
		"_favorite",
		"_favorite_index",
		"_list_properties_display",
	].map((key) => key.toLowerCase()),
);

function getFrontmatterValue(
	fm: Record<string, unknown>,
	keys: string[],
): unknown {
	const normalized = new Set(keys.map((k) => k.toLowerCase()));
	return Object.entries(fm).find(([k]) => normalized.has(k.toLowerCase()))?.[1];
}

function frontmatterString(
	fm: Record<string, unknown>,
	...keys: string[]
): string | null {
	const value = getFrontmatterValue(fm, keys);
	return typeof value === "string" ? value : null;
}

function frontmatterStringArray(
	fm: Record<string, unknown>,
	...keys: string[]
): string[] {
	const value = getFrontmatterValue(fm, keys);
	if (Array.isArray(value)) return value.map(String);
	if (typeof value === "string") return [value];
	return [];
}

function frontmatterBool(
	fm: Record<string, unknown>,
	...keys: string[]
): boolean | null {
	const value = getFrontmatterValue(fm, keys);
	return parseYamlBool(value);
}

function parseYamlBool(value: unknown): boolean | null {
	if (typeof value === "boolean") return value;
	if (typeof value !== "string") return null;
	switch (value.toLowerCase()) {
		case "true":
		case "yes":
			return true;
		case "false":
		case "no":
			return false;
		default:
			return null;
	}
}

function frontmatterWikiLinks(
	fm: Record<string, unknown>,
	...keys: string[]
): string[] {
	return frontmatterStringArray(fm, ...keys).flatMap(extractWikiLinks);
}

function frontmatterRelationships(
	fm: Record<string, unknown>,
): Record<string, string[]> {
	const rels: Record<string, string[]> = {};
	for (const [k, v] of Object.entries(fm)) {
		if (DEDICATED_KEYS.has(k.toLowerCase())) continue;
		const links = wikiLinksFromValue(v);
		if (links.length > 0) rels[k] = links;
	}
	return rels;
}

function frontmatterProperties(
	fm: Record<string, unknown>,
): Record<string, FrontmatterPropertyValue> {
	const props: Record<string, FrontmatterPropertyValue> = {};
	for (const [k, v] of Object.entries(fm)) {
		if (DEDICATED_KEYS.has(k.toLowerCase()) || k.trim().startsWith("_"))
			continue;
		const pv = frontmatterPropValue(v);
		if (pv !== undefined) props[k] = pv;
	}
	return props;
}

function frontmatterPropValue(
	value: unknown,
): FrontmatterPropertyValue | undefined {
	if (value === null) return null;
	if (typeof value === "number" || typeof value === "boolean") return value;
	if (typeof value === "string") return wikiLinkFreeString(value);
	if (
		Array.isArray(value) &&
		value.length === 1 &&
		typeof value[0] === "string"
	)
		return wikiLinkFreeString(value[0]);
	return undefined;
}

function wikiLinkFreeString(s: string): string | undefined {
	return extractWikiLinks(s).length === 0 ? s : undefined;
}

// ── Title / body ─────────────────────────────────────────────────────────

function markdownTitle(
	content: string,
	_fm: Record<string, unknown>,
	fallback: string,
): string {
	const h1Match = content.match(/^#\s+(.+)$/m);
	return h1Match ? h1Match[1].trim() : fallback;
}

function markdownBodyText(content: string): string {
	return content
		.replace(/^#+\s+.+$/gm, "")
		.replace(/[\n\r]+/g, " ")
		.trim();
}

// ── Type template resolution ─────────────────────────────────────────────

function resolveTypeTemplate(
	body: string,
	isA: string | null,
	title: string,
	explicitTemplate: string | null,
): string | null {
	if (explicitTemplate !== null) return explicitTemplate;
	if (isA !== "Type") return null;
	const template = bodyAfterTypeTitle(body, title)?.trim();
	if (!template) return null;
	return template.split(/\r?\n/).some((line) => {
		const trimmed = line.trimStart();
		return (
			trimmed.startsWith("## ") ||
			trimmed.startsWith("- [ ] ") ||
			(trimmed.length > 0 && trimmed.endsWith(":") && !trimmed.startsWith("-"))
		);
	})
		? template
		: null;
}

function bodyAfterTypeTitle(body: string, title: string): string | null {
	const trimmed = body.trimStart();
	const lineEnd = trimmed.indexOf("\n");
	const firstLine = (
		lineEnd === -1 ? trimmed : trimmed.slice(0, lineEnd)
	).replace(/\r$/, "");
	if (!firstLine.startsWith("# ") || firstLine.slice(2).trim() !== title)
		return null;
	return lineEnd === -1 ? "" : trimmed.slice(lineEnd + 1);
}

// ── Parsing ──────────────────────────────────────────────────────────────

export function parseMarkdownFile(filePath: string): VaultEntry | null {
	try {
		const raw = readUtf8File(filePath);
		const stats = pathStats(filePath);
		const { data, content } = matter(raw);
		const fm = data as Record<string, unknown>;

		const filename = path.basename(filePath);
		const basename = filename.replace(/\.md$/, "");
		const title = markdownTitle(content, fm, basename);
		const isA = frontmatterString(fm, "is_a", "is a", "type");
		const bodyText = markdownBodyText(content);

		return {
			path: filePath,
			filename,
			title,
			isA,
			aliases: frontmatterStringArray(fm, "aliases"),
			belongsTo: frontmatterWikiLinks(fm, "belongs_to", "belongs to"),
			relatedTo: frontmatterWikiLinks(fm, "related_to", "related to"),
			status: frontmatterString(fm, "status"),
			archived: frontmatterBool(fm, "archived") ?? false,
			trashed: frontmatterBool(fm, "trashed") ?? false,
			trashedAt: null,
			modifiedAt: stats.mtimeMs,
			createdAt: stats.birthtimeMs,
			fileSize: stats.size,
			snippet: bodyText.slice(0, 200),
			wordCount: bodyText.split(/\s+/).filter(Boolean).length,
			relationships: frontmatterRelationships(fm),
			icon: frontmatterString(fm, "icon"),
			color: frontmatterString(fm, "color"),
			order: typeof fm.order === "number" ? fm.order : null,
			sidebarLabel: frontmatterString(fm, "sidebar label", "sidebar_label"),
			template: resolveTypeTemplate(
				content,
				isA,
				title,
				frontmatterString(fm, "template"),
			),
			sort: frontmatterString(fm, "sort"),
			view: frontmatterString(fm, "view"),
			visible: frontmatterBool(fm, "visible"),
			outgoingLinks: [],
			properties: frontmatterProperties(fm),
		};
	} catch {
		return null;
	}
}

// ── File discovery ───────────────────────────────────────────────────────

export function findMarkdownFiles(dir: string): string[] {
	const results: string[] = [];
	try {
		for (const item of directoryEntries(dir)) {
			if (item.name.startsWith(".")) continue;
			const full = resolveInside(dir, item.name);
			if (!full) continue;
			if (item.isDirectory()) {
				results.push(...findMarkdownFiles(full));
			} else if (item.name.endsWith(".md")) {
				results.push(full);
			}
		}
	} catch {
		// skip unreadable dirs
	}
	return results;
}

// ── Vault CRUD ───────────────────────────────────────────────────────────

export function listVault(vaultPath: string): VaultEntry[] {
	return findMarkdownFiles(vaultPath)
		.map(parseMarkdownFile)
		.filter((e): e is VaultEntry => e !== null);
}

export function getNoteContent(filePath: string): string | null {
	try {
		return readUtf8File(filePath);
	} catch {
		return null;
	}
}

export function getAllContent(vaultPath: string): Record<string, string> {
	const map: Record<string, string> = {};
	for (const fp of findMarkdownFiles(vaultPath)) {
		try {
			map[fp] = readUtf8File(fp);
		} catch {
			/* skip */
		}
	}
	return map;
}

export function saveNote(filePath: string, content: string): void {
	writeUtf8File(filePath, content);
}

export function createNote(filePath: string, content: string): void {
	if (pathExists(filePath)) throw new Error("Note already exists");
	writeUtf8File(filePath, content);
}

// ── Validation ───────────────────────────────────────────────────────────

type FilenameStemValidation =
	| { ok: true; stem: string }
	| { ok: false; error: string };

function isUnsafeMarkdownStem(stem: string): boolean {
	return (
		stem === "." || stem === ".." || stem.includes("/") || stem.includes("\\")
	);
}

export function validateFilenameStem(value: unknown): FilenameStemValidation {
	const stem = String(value ?? "")
		.trim()
		.replace(/\.md$/i, "")
		.trim();
	if (!stem) return { ok: false, error: "New filename cannot be empty" };
	if (isUnsafeMarkdownStem(stem))
		return { ok: false, error: "Invalid filename" };
	return { ok: true, stem };
}

function markdownSiblingPath(filePath: string, stem: string): string | null {
	if (isUnsafeMarkdownStem(stem)) return null;
	return resolveInside(path.dirname(filePath), `${stem}.md`);
}

// ── Rename operations ────────────────────────────────────────────────────

export function renameNote(
	oldPath: string,
	newTitle: string,
	vaultPath?: string,
): RenameResult {
	const oldContent = readUtf8File(oldPath);
	const oldTitle = oldContent.match(/^# (.+)$/m)?.[1]?.trim() ?? "";
	const slug = newTitle
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/(^-|-$)/g, "");
	const newPath = markdownSiblingPath(oldPath, slug);
	if (!newPath) throw new Error("Invalid title");

	writeUtf8File(newPath, oldContent.replace(/^# .+$/m, `# ${newTitle}`));
	if (newPath !== oldPath) unlinkSync(oldPath);

	const updatedFiles = vaultPath
		? updateTitleWikilinks(newPath, oldTitle, vaultPath)
		: 0;

	return { new_path: newPath, updated_files: updatedFiles };
}

export function renameNoteFilename(
	oldPath: string,
	newStem: string,
	vaultPath?: string,
): RenameResult {
	const filename = validateFilenameStem(newStem);
	if (!filename.ok) throw new Error(filename.error);

	const newPath = markdownSiblingPath(oldPath, filename.stem);
	if (!newPath) throw new Error("Invalid filename");
	if (newPath !== oldPath && pathExists(newPath))
		throw new Error("A note with that name already exists");

	const oldTitle =
		parseMarkdownFile(oldPath)?.title ?? path.basename(oldPath, ".md");
	renameSync(oldPath, newPath);

	const updatedFiles = vaultPath
		? updatePathWikilinks(newPath, oldPath, oldTitle, vaultPath)
		: 0;

	return { new_path: newPath, updated_files: updatedFiles };
}

function updateTitleWikilinks(
	excludePath: string,
	oldTitle: string,
	vaultPath: string,
): number {
	const newPathStem = path
		.relative(vaultPath, excludePath)
		.replace(/\.md$/i, "");
	const oldTargets = collectLegacyTargets(excludePath, oldTitle, vaultPath);
	return updateWikilinksForTargets(
		excludePath,
		newPathStem,
		oldTargets,
		vaultPath,
	);
}

function updatePathWikilinks(
	newPath: string,
	oldPath: string,
	oldTitle: string,
	vaultPath: string,
): number {
	const newRelativeStem = path
		.relative(vaultPath, newPath)
		.replace(/\.md$/i, "");
	const oldTargets = collectLegacyTargets(oldPath, oldTitle, vaultPath);
	return updateWikilinksForTargets(
		newPath,
		newRelativeStem,
		oldTargets,
		vaultPath,
	);
}

function collectLegacyTargets(
	oldPath: string,
	oldTitle: string,
	vaultPath: string,
): string[] {
	const oldRelativeStem = path
		.relative(vaultPath, oldPath)
		.replace(/\.md$/i, "");
	const oldFilenameStem = path.basename(oldPath, ".md");
	return [
		...new Set([oldTitle, oldRelativeStem, oldFilenameStem].filter(Boolean)),
	];
}

function updateWikilinksForTargets(
	excludePath: string,
	newTarget: string,
	oldTargets: string[],
	vaultPath: string,
): number {
	if (oldTargets.length === 0) return 0;
	const allFiles = findMarkdownFiles(vaultPath);
	const targets = new Set(oldTargets);
	let updatedFiles = 0;

	for (const filePath of allFiles) {
		if (filePath === excludePath) continue;
		try {
			const content = readUtf8File(filePath);
			const replaced = content.replace(
				/\[\[([^\]|]+)(\|[^\]]*)?\]\]/g,
				(match, target, pipe) => {
					if (!targets.has(target)) return match;
					return pipe ? `[[${newTarget}${pipe}]]` : `[[${newTarget}]]`;
				},
			);
			if (replaced !== content) {
				writeUtf8File(filePath, replaced);
				updatedFiles++;
			}
		} catch {
			/* skip */
		}
	}
	return updatedFiles;
}

// ── Delete ───────────────────────────────────────────────────────────────

export function deleteNote(filePath: string): string {
	unlinkSync(filePath);
	return filePath;
}

// ── Search ───────────────────────────────────────────────────────────────

export function searchVault(
	vaultPath: string,
	query: string,
	excludeFrontmatter: boolean = false,
): VaultSearchResult[] {
	const q = query.toLowerCase();
	const results: VaultSearchResult[] = [];

	for (const filePath of findMarkdownFiles(vaultPath)) {
		const entry = parseMarkdownFile(filePath);
		if (!entry || entry.trashed) continue;
		const rawContent = readUtf8File(filePath);
		const searchableContent = excludeFrontmatter
			? matter(rawContent).content
			: rawContent;

		if (
			entry.title.toLowerCase().includes(q) ||
			searchableContent.toLowerCase().includes(q)
		) {
			results.push({
				title: entry.title,
				path: entry.path,
				snippet: entry.snippet,
				score: 1.0,
				note_type: entry.isA,
			});
		}
	}
	return results.slice(0, 20);
}

// ── Boundary check ───────────────────────────────────────────────────────

export function isInsideVault(vaultPath: string, targetPath: string): boolean {
	const resolved = resolveInside(vaultPath, targetPath);
	return resolved !== null;
}
