import { createHash } from 'crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { parse } from 'path'
import { fromArrayBuffer } from '@nbsjs/core'
import { resolveLocation } from './location'
import { findNBSFiles, type NBSFile } from './nbsConfig'
import { generatePlayback, type GeneratedFiles } from './playback'
import { buildTimeline } from './timeline'

const TICK_TAG_PATH = 'data/minecraft/tags/function/tick.json'
/**
 * mc-build's own file cache, used to clean up files a previous build wrote
 * that the current one doesn't. Its `io` handler doesn't work from a plugin
 * right now, so files are written with `fs` directly and recorded here by hand.
 */
const FS_CACHE_PATH = '.mcb/fs-cache.txt'

/** The slice of mc-build's `Config` this plugin relies on. */
interface MCBPluginBuild {
	events: {
		onPreBuild: { subscribe: (callback: (result: { success: boolean }) => void) => void }
		onPostBuild: { subscribe: (callback: (result: { success: boolean }) => void) => void }
	}
}

const SONGS_DIR = './src'

export function nbsToMcb(build: MCBPluginBuild) {
	build.events.onPostBuild.subscribe(result => {
		if (!result.success) return

		const tickFunctions: string[] = []
		const writtenFiles: GeneratedFiles = {}
		for (const nbsFile of findNBSFiles(SONGS_DIR)) {
			const tickFunction = compileNBSFile(nbsFile, writtenFiles)
			if (tickFunction) tickFunctions.push(tickFunction)
		}

		if (tickFunctions.length > 0) writeTickTag(tickFunctions)
		recordInFsCache(writtenFiles)
	})
}
export default nbsToMcb

function compileNBSFile(nbsFile: NBSFile, writtenFiles: GeneratedFiles): string | undefined {
	const { namespace, songId } = resolveLocation(nbsFile.path, SONGS_DIR)
	const song = fromArrayBuffer(toArrayBuffer(readFileSync(nbsFile.path)))
	const timeline = buildTimeline(song, nbsFile.config)

	const { files, tickFunction } = generatePlayback(namespace, songId, timeline, nbsFile.config)
	for (const [path, content] of Object.entries(files)) {
		const dir = parse(path).dir
		mkdirSync(dir, { recursive: true })
		writeFileSync(path, content)
		writtenFiles[path] = content
	}

	return tickFunction
}

/** Upserts every generated file's path/hash into mc-build's fs cache, so it knows to clean them up once we stop writing them. */
function recordInFsCache(writtenFiles: GeneratedFiles) {
	const cache = readFsCache()
	for (const [path, content] of Object.entries(writtenFiles)) {
		cache.set(path, createHash('sha1').update(content, 'utf8').digest('hex'))
	}

	mkdirSync(parse(FS_CACHE_PATH).dir, { recursive: true })
	writeFileSync(FS_CACHE_PATH, Array.from(cache, ([path, hash]) => `${path}:${hash}`).join('\n'))
}

function readFsCache(): Map<string, string> {
	const cache = new Map<string, string>()
	if (!existsSync(FS_CACHE_PATH)) return cache

	for (const line of readFileSync(FS_CACHE_PATH, 'utf8').split('\n')) {
		const separator = line.lastIndexOf(':')
		if (separator === -1) continue
		cache.set(line.slice(0, separator), line.slice(separator + 1))
	}

	return cache
}

/** Merges per-player songs' tick functions into the `minecraft:tick` function tag, keeping any entries already there. */
function writeTickTag(tickFunctions: string[]) {
	const existingValues: unknown = existsSync(TICK_TAG_PATH)
		? JSON.parse(readFileSync(TICK_TAG_PATH, 'utf8')).values
		: []
	const values = Array.from(
		new Set([...(Array.isArray(existingValues) ? existingValues : []), ...tickFunctions])
	)

	mkdirSync(parse(TICK_TAG_PATH).dir, { recursive: true })
	writeFileSync(TICK_TAG_PATH, JSON.stringify({ values }))
}

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
	return buffer.buffer.slice(
		buffer.byteOffset,
		buffer.byteOffset + buffer.byteLength
	) as ArrayBuffer
}
