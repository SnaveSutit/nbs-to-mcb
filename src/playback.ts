import type { NBSConfig } from './nbsConfig'
import type { NoteEvent, Timeline } from './timeline'

/** Shared dummy objective every song's single-instance "playing" flag lives on. */
const PLAYING_OBJECTIVE = 'nbs.playing'
/** Scratch storage used to hand a player's current step number to a macro function call. */
const PLAYBACK_STORAGE = 'nbs:playback'

/** Generated datapack files for one song, keyed by path relative to the project root. */
export type GeneratedFiles = Record<string, string>

export interface PlaybackResult {
	files: GeneratedFiles
	tickFunction?: string
}

/** Generates the `play`/`stop`/step-chain functions for a song. */
export function generatePlayback(
	namespace: string,
	songId: string,
	timeline: Timeline,
	config: NBSConfig
): PlaybackResult {
	return config.instance === 'per-player'
		? generatePerPlayer(namespace, songId, timeline, config)
		: { files: generateSingleInstance(namespace, songId, timeline, config) }
}

/** `songId` is empty when the song is the only one in its namespace. */
function functionDir(namespace: string, songId: string): string {
	return songId ? `data/${namespace}/function/${songId}` : `data/${namespace}/function`
}

/** Resource location of a function inside a song's own folder, e.g. `themes:tetris_a/steps/0` or `tetris_b_theme:steps/0`. */
function songFunction(namespace: string, songId: string, name: string): string {
	return songId ? `${namespace}:${songId}/${name}` : `${namespace}:${name}`
}

/** A song's resource location turned into a scoreboard-safe name, e.g. `themes:tetris_a` -> `themes.tetris_a`. */
function scoreboardName(namespace: string, songId: string): string {
	return (songId ? `${namespace}:${songId}` : namespace).replace(/[:/]/g, '.')
}

function playsoundCommand(
	prefix: string[],
	target: string,
	category: string,
	note: NoteEvent
): string {
	const playsound = `playsound ${note.soundId} ${category} ${target} ~ ~ ~ ${note.volume} ${note.pitch}`
	return prefix.length > 0 ? `execute ${prefix.join(' ')} run ${playsound}` : playsound
}

/**
 * A single shared instance of the song: one "is it playing" flag, heard by
 * whoever matches `config.selector` from `config.position`. Restarting via
 * `play` interrupts whatever was already playing, since `schedule ... replace`
 * only ever keeps one pending step per song.
 */
function generateSingleInstance(
	namespace: string,
	songId: string,
	timeline: Timeline,
	config: NBSConfig
): GeneratedFiles {
	const dir = functionDir(namespace, songId)
	const holder = `#${songId || namespace}.playing`
	const positionPrefix = config.position === '~ ~ ~' ? [] : [`positioned ${config.position}`]

	const files: GeneratedFiles = {
		[`${dir}/play.mcfunction`]: [
			`scoreboard objectives add ${PLAYING_OBJECTIVE} dummy`,
			`scoreboard players set ${holder} ${PLAYING_OBJECTIVE} 1`,
			`function ${songFunction(namespace, songId, 'steps/0')}`,
		].join('\n'),
		[`${dir}/stop.mcfunction`]: [
			`scoreboard players set ${holder} ${PLAYING_OBJECTIVE} 0`,
			`function ${songFunction(namespace, songId, 'clear')}`,
		].join('\n'),
	}

	for (const [i, tick] of timeline.ticks.entries()) {
		const lines = tick.notes.map(note =>
			playsoundCommand(positionPrefix, config.selector, config.category, note)
		)

		const next = nextStep(timeline, i, config.loop)
		if (next) {
			lines.push(
				`execute if score ${holder} ${PLAYING_OBJECTIVE} matches 1 run schedule function ${songFunction(namespace, songId, `steps/${next.step}`)} ${next.delay}t replace`
			)
		} else {
			// End of a non-looping song: drop the flag, there's nothing left to schedule.
			lines.push(`scoreboard players set ${holder} ${PLAYING_OBJECTIVE} 0`)
		}

		files[`${dir}/steps/${i}.mcfunction`] = lines.join('\n')
	}

	files[`${dir}/clear.mcfunction`] = timeline.ticks
		.map((_, i) => `schedule clear ${songFunction(namespace, songId, `steps/${i}`)}`)
		.join('\n')

	return files
}

/**
 * A per-listener instance: each player tracks their own step number, and the song follows them around.
 */
function generatePerPlayer(
	namespace: string,
	songId: string,
	timeline: Timeline,
	config: NBSConfig
): PlaybackResult {
	const dir = functionDir(namespace, songId)
	const objective = scoreboardName(namespace, songId)
	const tickFunction = songFunction(namespace, songId, 'tick')
	const lastTick = timeline.lengthInGameTicks - 1

	const files: GeneratedFiles = {
		[`${dir}/play.mcfunction`]: [
			`scoreboard objectives add ${objective} dummy`,
			`scoreboard players set @s ${objective} 0`,
		].join('\n'),
		[`${dir}/stop.mcfunction`]: `scoreboard players set @s ${objective} -1`,
		[`${dir}/tick.mcfunction`]: `execute as @a[scores={${objective}=0..}] at @s run function ${songFunction(namespace, songId, 'tick_player')}`,
		[`${dir}/tick_player.mcfunction`]: [
			`execute store result storage ${PLAYBACK_STORAGE} step int 1 run scoreboard players get @s ${objective}`,
			`function ${songFunction(namespace, songId, 'run_step')} with storage ${PLAYBACK_STORAGE}`,
			// Reset on the last tick (stop, or loop back to the start); otherwise just advance to the next tick.
			`execute if score @s ${objective} matches ${lastTick}.. run return run scoreboard players set @s ${objective} ${config.loop ? 0 : -1}`,
			`scoreboard players add @s ${objective} 1`,
		].join('\n'),
		[`${dir}/run_step.mcfunction`]: `$function ${songFunction(namespace, songId, 'steps')}/$(step)`,
	}

	for (const tick of timeline.ticks) {
		const lines = tick.notes.map(note => playsoundCommand([], '@s', config.category, note))
		files[`${dir}/steps/${tick.gameTick}.mcfunction`] = lines.join('\n')
	}

	return { files, tickFunction }
}

/** The next step to advance to after `ticks[index]`, or null if playback should stop there. */
function nextStep(
	timeline: Timeline,
	index: number,
	loop: boolean
): { step: number; gameTick: number; delay: number } | null {
	const current = timeline.ticks[index]!
	const upcoming = timeline.ticks[index + 1]

	if (upcoming) {
		return {
			step: index + 1,
			gameTick: upcoming.gameTick,
			delay: upcoming.gameTick - current.gameTick,
		}
	}

	if (loop) {
		const firstTick = timeline.ticks[0]!.gameTick
		return {
			step: 0,
			gameTick: firstTick,
			delay: timeline.lengthInGameTicks - current.gameTick + firstTick,
		}
	}

	return null
}
