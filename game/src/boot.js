// Browser boot: find the canvas, stage a screenshot scene when the URL
// asks for one, and otherwise start the game shell.
import { createShell } from './shell.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');

if (shot) {
  stageShot(ctx, shot);
  window.__SHOT_READY = true;
} else {
  const shell = createShell(canvas);
  shell.start();
}
