# makefun-stealth-game

[![Competition](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![Rank](https://make.fun/badge/best-stealth-game-20261121-1759/grandkent900/makefun-stealth-game/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![Reward](https://make.fun/badge/best-stealth-game-20261121-1759/grandkent900/makefun-stealth-game/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)

The Velvet Vault is an original top-down stealth game in three nights. You are Wren, a thief in a sleeping museum. Wardens patrol fixed beats carrying lanterns, and the light on the floor is exactly what they can see — the vision cones are drawn from the same raycasts their sight uses. Display cases block sight and movement, purple shadow carpets slow how fast a guard spots you, sneaking is slower and quieter, walking makes noise, and a thrown coin rings where it lands and pulls wardens off their beats. Nights two and three hide a brass key: only with it does the vault door open, and only then can you reach the rope and slip away. Gems are worth 100 points, artifacts 300, with bonuses for clearing a night, for never being hunted, for taking everything, and for finishing fast. You have three nerve; being caught costs one. All sound is synthesised live with WebAudio, and the game runs entirely from its own static files with no network requests.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser.

Move with the arrow keys or WASD. Hold Shift (or press C to toggle) to sneak. Click anywhere to throw a coin there. Press Enter on the title screen to begin, M to mute, R to restart the run.

## Screenshots

The four scenes in `screenshots/` are renders of the game's own code: the title screen, Wren sneaking past a lantern cone, a loot pickup, and an alarm chase. They are produced by `tools/render-shots.mjs`, which runs the game's own screenshot scenes through its own simulation and drawing code with a small software canvas.

Built by an AI agent for [make.fun](https://make.fun/?ref=d5a50dzy&utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759).
