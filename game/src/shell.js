// The game shell: screens, the frame loop, and wiring input, sound and
// drawing together. Screens: title, playing, night clear, caught, run over.
// The shell owns no simulation of its own; it drives sim.js.
import { createRun, stepRun, advanceNight, retryNight } from './sim.js';
import { createSound } from './sound.js';
import { createControls } from './controls.js';
import { drawWorld, drawTitle, drawNightClear, drawCaught, drawRunOver } from './draw.js';
import { VIEW_W, VIEW_H } from './config.js';

export function createShell(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
  const controls = createControls(canvas);
  const sound = createSound();
  let run = createRun();
  let screen = 'title';
  let last = performance.now();
  let acc = 0;
  let alarmOn = false;

  function playEventSounds() {
    for (const e of run.events) {
      if (e.type === 'pickup') sound.pickup(e.kind);
      else if (e.type === 'key') sound.key();
      else if (e.type === 'door') sound.door();
      else if (e.type === 'ring') sound.coinRing();
      else if (e.type === 'throw') sound.coinThrow();
      else if (e.type === 'caught') sound.caught();
      else if (e.type === 'clear') sound.clear();
      else if (e.type === 'guardstep') sound.guardStep(e.dist);
      else if (e.type === 'step') sound.footstep(9, e.loud);
    }
  }

  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (screen === 'playing') {
      acc += dt;
      const step = 1 / 60;
      while (acc >= step) {
        acc -= step;
        const mv = controls.move();
        const coin = controls.takeCoin();
        stepRun(run, { mx: mv.mx, my: mv.my, sneak: controls.sneaking, coin }, step);
        playEventSounds();
        if (run.state === 'nightclear') {
          screen = 'nightclear';
          break;
        }
        if (run.state === 'caught') {
          screen = 'caught';
          break;
        }
        if (run.state === 'runover') {
          screen = 'runover';
          break;
        }
      }
      // The alarm bell rings once when any guard starts a chase.
      const chasing = run.level.guards.some((g) => g.state === 'chase');
      if (chasing && !alarmOn) {
        alarmOn = true;
        sound.alarm();
      } else if (!chasing) {
        alarmOn = false;
      }
      drawWorld(ctx, run);
    } else if (screen === 'title') {
      sound.startDrone();
      drawTitle(ctx);
      if (controls.wasPressed('Enter')) {
        sound.unlock();
        screen = 'playing';
      }
    } else if (screen === 'nightclear') {
      drawNightClear(ctx, run);
      if (controls.wasPressed('Enter')) {
        advanceNight(run);
        screen = run.state === 'runover' ? 'runover' : 'playing';
      }
    } else if (screen === 'caught') {
      drawCaught(ctx, run);
      if (controls.wasPressed('Enter')) {
        retryNight(run);
        screen = 'playing';
      }
    } else if (screen === 'runover') {
      drawRunOver(ctx, run);
      if (controls.wasPressed('Enter')) {
        run = createRun();
        screen = 'title';
      }
    }
    if (controls.wasPressed('m')) sound.toggleMute();
    if (controls.wasPressed('r') && screen === 'playing') {
      run = createRun();
    }
    controls.drainPressed();
    requestAnimationFrame(frame);
  }

  return {
    start() {
      requestAnimationFrame(frame);
    },
    // For tests and the screenshot tool: the live run and its screen.
    get run() {
      return run;
    },
    get screen() {
      return screen;
    },
  };
}
