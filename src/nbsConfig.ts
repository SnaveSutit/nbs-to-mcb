import { existsSync, readdirSync, readFileSync } from 'fs'

/** Where the generated playback functions send their sound to. */
export type InstanceMode = 'single' | 'per-player'

/**
 * Settings read from a song's `<song file name>.nbs.json` sidecar file.
 *
 * `single` instance songs are a shared jukebox: `selector` and `position`
 * decide who hears it and where it plays from. `per-player` songs are
 * started/stopped per listener (as that player) and always follow them, so
 * `selector` and `position` are ignored.
 */
export interface NBSConfig {
	volume: number
	loop: boolean
	/** The entity selector to use for the playsound command. e.g. `@a` */
	selector: string
	/** The position to use for the playsound command. e.g. `~ ~ ~` */
	position: string
	/** Playsound category, e.g. `record` or `player` */
	category: string
	instance: InstanceMode
}

export interface NBSFile {
	path: string
	config: NBSConfig
}

const defaultNBSConfig: NBSConfig = {
	volume: 0.5,
	loop: false,
	selector: '@a',
	position: '~ ~ ~',
	category: 'record',
	instance: 'single',
}

export function slugify(s: string): string {
	return (
		s
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '_')
			.replace(/^_+|_+$/g, '') || 'song'
	)
}

function readNBSConfig(configPath: string): Partial<NBSConfig> {
	if (!existsSync(configPath)) {
		return {}
	}

	const raw: unknown = JSON.parse(readFileSync(configPath, 'utf8'))
	return raw && typeof raw === 'object' ? (raw as Partial<NBSConfig>) : {}
}

function loadNBSConfig(nbsPath: string): NBSConfig {
	return { ...defaultNBSConfig, ...readNBSConfig(`${nbsPath}.json`) }
}

/** Recursively finds every `.nbs` file under `dir`, alongside its resolved sidecar config. */
export function findNBSFiles(dir: string): NBSFile[] {
	const files: NBSFile[] = []

	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const fullPath = `${dir}/${entry.name}`
		if (entry.isDirectory()) {
			files.push(...findNBSFiles(fullPath))
		} else if (entry.isFile() && entry.name.endsWith('.nbs')) {
			files.push({ path: fullPath, config: loadNBSConfig(fullPath) })
		}
	}

	return files
}
