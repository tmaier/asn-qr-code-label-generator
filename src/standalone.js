// Entry point of the standalone page (index.html), bundled into dist/app.js
// by `npm run build`. Sites that embed the generator register asnLabels
// with their own Alpine instead; see README.md.
import Alpine from "alpinejs";
import { asnLabels } from "./component.js";

Alpine.data("asnLabels", asnLabels);
window.Alpine = Alpine;
Alpine.start();
