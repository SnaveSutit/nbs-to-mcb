import { extname, relative } from 'path'
import { slugify } from './nbsConfig'

export interface SongLocation {
	namespace: string
	/** Function path within the namespace, e.g. `"tetris_a"`. Empty when the song is the namespace's only song. */
	songId: string
}

/**
 * Derives a song's namespace and function id from its path relative to the
 * songs directory.
 */
export function resolveLocation(nbsPath: string, songsDir: string): SongLocation {
	const relativePath = relative(songsDir, nbsPath)
	const withoutExtension = relativePath.slice(0, -extname(relativePath).length)
	const segments = withoutExtension.split(/[\\/]+/).filter(Boolean)

	const [namespace, ...rest] = segments
	return {
		namespace: slugify(namespace ?? 'song'),
		songId: rest.map(slugify).join('/'),
	}
}
