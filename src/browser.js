// Browser entry (Vite): exposes the generator to the classic scripts in public/
// (player.js calls window.BachGenerator.generatePiece instead of GET /api/generate).
// Module scripts run before DOMContentLoaded, when player.js sets itself up.
import { generatePiece } from './main.js';

window.BachGenerator = { generatePiece };
