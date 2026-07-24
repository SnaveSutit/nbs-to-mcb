import type { Note } from '@nbsjs/core'

/**
 * Maps NBS instrument IDs to their vanilla Minecraft note block sound event.
 *
 * IDs 16-19 (the copper trumpet variants) are a guess based on Mojang's usual
 * copper oxidation naming convention (trumpet/exposed/weathered/oxidized) -
 * NBS does not expose a real sound id for them.
 */
const INSTRUMENT_SOUNDS: Readonly<Record<number, string>> = {
	0: 'minecraft:block.note_block.harp',
	1: 'minecraft:block.note_block.bass',
	2: 'minecraft:block.note_block.basedrum',
	3: 'minecraft:block.note_block.snare',
	4: 'minecraft:block.note_block.hat',
	5: 'minecraft:block.note_block.guitar',
	6: 'minecraft:block.note_block.flute',
	7: 'minecraft:block.note_block.bell',
	8: 'minecraft:block.note_block.chime',
	9: 'minecraft:block.note_block.xylophone',
	10: 'minecraft:block.note_block.iron_xylophone',
	11: 'minecraft:block.note_block.cow_bell',
	12: 'minecraft:block.note_block.didgeridoo',
	13: 'minecraft:block.note_block.bit',
	14: 'minecraft:block.note_block.banjo',
	15: 'minecraft:block.note_block.pling',
	16: 'minecraft:block.note_block.trumpet',
	17: 'minecraft:block.note_block.trumpet_exposed',
	18: 'minecraft:block.note_block.trumpet_weathered',
	19: 'minecraft:block.note_block.trumpet_oxidized',
}

const DEFAULT_SOUND = 'minecraft:block.note_block.harp'

export function soundForInstrument(instrumentId: number): string {
	return INSTRUMENT_SOUNDS[instrumentId] ?? DEFAULT_SOUND
}

export function clamp(v: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, v))
}

export function round(v: number, decimals: number): number {
	const f = 10 ** decimals
	return Math.round(v * f) / f
}

/** Converts an NBS note key + fine pitch into a `/playsound` pitch multiplier. */
export function pitchOf(note: Note): number {
	const key = note.key ?? 45
	if (key < 0 || key > 87) {
		throw new Error(`Invalid note key: ${key}`)
	}

	// Key 45 (F#4) is vanilla note block pitch 0, and each key is a semitone.
	const semitones = key - 45 + (note.pitch ?? 0) / 100
	return round(clamp(2 ** (semitones / 12), 0.5, 2), 4)
}
