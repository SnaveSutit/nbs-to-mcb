import type { Instrument, Note } from '@nbsjs/core'
import { slugify } from './nbsConfig'

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

/** Matches a vanilla sound event id, e.g. `entity.experience_orb.pickup`. */
const VANILLA_SOUND_ID = /^[a-z0-9_]+(\.[a-z0-9_]+)+$/

/**
 * Sound event for a note's instrument. Built-ins map to their vanilla note
 * block sound.
 *
 * Custom instruments are commonly added in Note Block Studio by importing a
 * vanilla sound and naming the instrument after its sound event id (e.g.
 * `entity.firework.blast_far`) - when the name looks like one, it's used
 * directly as `minecraft:<name>`. Otherwise custom sounds map to `nbs:custom/<name>`.
 */
export function soundForInstrument(instrumentId: number, instrument: Instrument): string {
	if (instrument.isBuiltIn) {
		return INSTRUMENT_SOUNDS[instrumentId] ?? DEFAULT_SOUND
	}

	if (instrument.name && VANILLA_SOUND_ID.test(instrument.name)) {
		return `minecraft:${instrument.name}`
	}

	const name = instrument.name || instrument.soundFile || `instrument_${instrumentId}`
	return `nbs:custom/${slugify(name)}`
}

export function clamp(v: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, v))
}

export function round(v: number, decimals: number): number {
	const f = 10 ** decimals
	return Math.round(v * f) / f
}

/**
 * Converts an NBS note key + fine pitch into a `/playsound` pitch multiplier,
 * relative to the instrument's own reference key rather than assuming 45
 * (F#4) - built-ins default to 45 too, but a custom instrument's sample may
 * be tuned to a different natural pitch.
 */
export function pitchOf(note: Note, instrument: Instrument): number {
	const key = note.key ?? 45
	if (key < 0 || key > 87) {
		throw new Error(`Invalid note key: ${key}`)
	}

	const semitones = key - (instrument.key ?? 45) + (note.pitch ?? 0) / 100
	return round(clamp(2 ** (semitones / 12), 0.5, 2), 4)
}
