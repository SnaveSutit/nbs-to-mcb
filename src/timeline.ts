import type { Song } from '@nbsjs/core'
import { clamp, pitchOf, round, soundForInstrument } from './instruments'
import type { NBSConfig } from './nbsConfig'

export interface NoteEvent {
	soundId: string
	volume: number
	pitch: number
}

export interface TickEvent {
	/** Tick this fires on, in Minecraft game ticks (20/sec) since playback started. */
	gameTick: number
	notes: NoteEvent[]
}

export interface Timeline {
	ticks: TickEvent[]
	/** Total song length in game ticks, used to time the loop-back delay. */
	lengthInGameTicks: number
}

/**
 * Flattens every layer of a song into a single, time-ordered list of note
 * events grouped by the game tick they play on.
 */
export function buildTimeline(song: Song, config: NBSConfig): Timeline {
	const gameTicksPerNbsTick = 20 / song.getTempo()
	const eventsByGameTick = new Map<number, NoteEvent[]>()

	for (const layer of song.layers) {
		const layerVolume = (layer.volume ?? 100) / 100

		for (const [nbsTick, note] of layer.notes) {
			const gameTick = Math.round(nbsTick * gameTicksPerNbsTick)
			const volume = round(
				clamp(((note.velocity ?? 100) / 100) * layerVolume * config.volume, 0, 1),
				4
			)

			const event: NoteEvent = {
				soundId: soundForInstrument(note.instrument),
				volume,
				pitch: pitchOf(note),
			}

			const existing = eventsByGameTick.get(gameTick)
			if (existing) {
				existing.push(event)
			} else {
				eventsByGameTick.set(gameTick, [event])
			}
		}
	}

	const ticks = Array.from(eventsByGameTick.entries())
		.sort(([a], [b]) => a - b)
		.map(([gameTick, notes]) => ({ gameTick, notes }))

	return {
		ticks,
		lengthInGameTicks: Math.round(song.getLength() * gameTicksPerNbsTick),
	}
}
