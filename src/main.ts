import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/500.css';
import { launchGame } from './phaserGame';

console.log(`[snake-phaser] v${__BUILD_INFO__.version} (${__BUILD_INFO__.commitHash}, ${__BUILD_INFO__.buildTime})`);

void launchGame();