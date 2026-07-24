# nbs-to-mcb

An [mc-build](https://github.com/mc-build/mcb) plugin that turns [Note Block Studio](https://opennbs.org/) (`.nbs`) songs into Minecraft datapack functions you can play, stop, and loop in-game.

For each `.nbs` file in your project, it generates a chain of functions that plays the song's notes in real time using `playsound`, driven by `schedule` (single instance) or a `minecraft:tick` handler (per-player).

## Requirements

- An [mc-build](https://github.com/mc-build/mcb) project (a `pack.mcmeta` + `mcb.config.cjs`).

## Installing

Download `nbs-to-mcb.js` from the releases page and drop it into your mc-build project (e.g. as `mcb-plugins/nbs-to-mcb.js`) and `require` it from `mcb.config.cjs`'s `setup` hook.

```js
const { nbsToMcb } = require('./mcb-plugins/nbs-to-mcb.js')

module.exports = {
	setup: build => nbsToMcb(build),
}
```

The plugin hooks `onPostBuild` and, on every successful build, scans your project's `src/` directory for `.nbs` files, generates the corresponding datapack functions, and writes them to `data/`.

## Where songs come from

Every `.nbs` file under `src/` (searched recursively) is picked up automatically. A song's namespace and function path are derived from where the file sits relative to `src/`:

| File                           | Namespace        | Song functions                                      |
| ------------------------------ | ---------------- | --------------------------------------------------- |
| `src/tetris_b_theme.nbs`       | `tetris_b_theme` | `tetris_b_theme:play`, `tetris_b_theme:stop`, ...   |
| `src/themes/tetris_a.nbs`      | `themes`         | `themes:tetris_a/play`, `themes:tetris_a/stop`, ... |
| `src/themes/boss/tetris_a.nbs` | `themes`         | `themes:boss/tetris_a/play`, ...                    |

## Per-song configuration

Each song can be configured with a sidecar JSON file named after it: `<song file name>.nbs.json`, next to the `.nbs` file. For example, `src/themes/tetris_a.nbs` is configured by `src/themes/tetris_a.nbs.json`.

```json
{
	"volume": 0.5,
	"loop": false,
	"selector": "@a[distance=..10]",
	"position": "0 -63 0",
	"category": "player",
	"instance": "single"
}
```

All fields are optional and fall back to the defaults below.

| Field      | Default    | Description                                                                                             |
| ---------- | ---------- | ------------------------------------------------------------------------------------------------------- |
| `volume`   | `0.5`      | Multiplies every note's `playsound` volume (0-1).                                                       |
| `loop`     | `false`    | Restart from the beginning after the last note instead of stopping.                                     |
| `selector` | `"@a"`     | Who hears it. **Single instance only** - ignored in `per-player` mode.                                  |
| `position` | `"~ ~ ~"`  | Where the sound plays from. `"~ ~ ~"` is omitted from the generated commands. **Single instance only.** |
| `category` | `"record"` | The `playsound` sound category (`record`, `player`, `master`, ...).                                     |
| `instance` | `"single"` | `"single"` or `"per-player"` - see below.                                                               |

## Instance modes

### `single` (default)

One shared, jukebox-style instance of the song. `play` restarts it (interrupting whatever was already playing); `stop` halts it; `selector`/`position`/`category` control who hears it and from where.

Generated functions, e.g. for `themes:tetris_a`:

- `themes:tetris_a/play` - start (or restart) playback.
- `themes:tetris_a/stop` - stop playback.
- `themes:tetris_a/clear` - `schedule clear` every step, in case you need to hard-cancel a pending step outside of `stop`.
- `themes:tetris_a/steps/<n>` - internal, one per note event.

### `per-player`

Each player starts and stops their own copy of the song, tracked by their own scoreboard score, and only hears it themselves (`selector`/`position` don't apply). Playback follows the player rather than being tied to a location.

Generated functions:

- `themes:tetris_a/play` - run **as** the player to start it for them.
- `themes:tetris_a/stop` - run **as** the player to stop it for them.

## Example

Given `src/themes/tetris_a.nbs` with `"instance": "single"`, in-game:

```
/function themes:tetris_a/play
/function themes:tetris_a/stop
```

With `"instance": "per-player"`, `play`/`stop` need to run **as** the listener, e.g. from a command block:

```
/execute as @p run function themes:tetris_a/play
```

## Notes and caveats

- Custom instruments (added in Note Block Studio from a sound file) are common in community-made songs that reuse vanilla sounds - e.g. an instrument named `entity.firework.blast_far`. When a custom instrument's name already looks like a vanilla sound event id (dotted, lowercase, like `block.anvil.land`), it's used directly as `minecraft:<name>`. Otherwise (a plain label like `Whoosh`) NBS only stores the sample's file name, not its audio, so it maps to `nbs:custom/<name>` and needs a matching sound added to a resource pack under that id to actually play anything - or you can just rename the instrument in Note Block Studio to the vanilla sound event id you want.
- A custom instrument's own `key` (its sample's natural pitch, set in Note Block Studio) is used as the pitch reference instead of assuming F#4/45, so a note plays at the right pitch relative to that instrument's tuning.
- Generated files are written directly with `fs` rather than through mc-build's own `io` handler (which currently doesn't work from a plugin), and are recorded into `.mcb/fs-cache.txt` by hand so mc-build's cleanup still knows about them.

## License

[MIT](LICENSE)
