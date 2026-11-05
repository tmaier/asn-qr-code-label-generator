// Alpine.js data for the label generator. It does not import Alpine, so a
// site registers it with its own copy:
//
//   Alpine.data("asnLabels", asnLabels);
//   Alpine.data("asnLabels", () => asnLabels({ storageKey: null }));
import {
  DEFAULTS,
  PER_SHEET,
  fromQuery,
  labelText,
  parseCount,
  qrDataUri,
  sheet,
  toQuery,
} from "./labels.js";

// 189 codes per sheet; most stay the same between keystrokes.
const qrCache = new Map();
const qr = (text) => {
  if (!qrCache.has(text)) qrCache.set(text, qrDataUri(text));
  return qrCache.get(text);
};

// The number inputs are bound as strings, so an invalid entry stays visible
// in the field instead of being coerced.
const formFields = (state) => ({
  ...state,
  startNumber: String(state.startNumber),
  leadingZeros: String(state.leadingZeros),
});

function readStorage(key) {
  if (key == null) return {};
  try {
    return JSON.parse(globalThis.localStorage.getItem(key)) ?? {};
  } catch {
    return {};
  }
}

/**
 * @param {object} [options]
 * @param {string|null} [options.storageKey="asn-labels-v1"] localStorage key
 *   for the form fields; null keeps nothing in localStorage.
 * @param {boolean} [options.syncUrl=true] keep the form fields in the
 *   query string, so a link reproduces a sheet.
 */
export function asnLabels({ storageKey = "asn-labels-v1", syncUrl = true } = {}) {
  // A link with a query string wins over what this browser remembers, so a
  // shared or bookmarked sheet always opens as it was.
  const query = syncUrl ? fromQuery(globalThis.location?.search ?? "") : {};
  const initial = { ...DEFAULTS, ...readStorage(storageKey), ...query };

  return {
    ...formFields(initial),

    init() {
      this.$watch("labels", () => this.$nextTick(() => this.fitTexts()));
      document.fonts?.ready.then(() => this.fitTexts());
      this.$nextTick(() => this.fitTexts());
      this.$watch("state", (state) => {
        if (!state) return;
        if (storageKey != null) {
          try {
            localStorage.setItem(storageKey, JSON.stringify(state));
          } catch {}
        }
        if (syncUrl) history.replaceState(null, "", "?" + toQuery(state));
      });
    },

    valid(field) {
      return !isNaN(parseCount(this[field], field === "startNumber" ? 1 : 0));
    },
    get ok() {
      return this.valid("startNumber") && this.valid("leadingZeros");
    },
    // Parsed form values, or null while a field is invalid.
    get state() {
      if (!this.ok) return null;
      return {
        startNumber: parseCount(this.startNumber, 1),
        prefix: this.prefix,
        leadingZeros: parseCount(this.leadingZeros, 0),
        borderToggle: this.borderToggle,
      };
    },
    // One sheet: [{ text, col, row, qr }], qr being an SVG data URI.
    get labels() {
      const s = this.state;
      if (!s) return [];
      return sheet(s.startNumber, s.prefix, s.leadingZeros).map((label) => ({
        ...label,
        qr: qr(label.text),
      }));
    },
    get first() {
      const s = this.state;
      return s ? labelText(s.startNumber, s.prefix, s.leadingZeros) : "–";
    },
    // Start number of the following sheet, or null while it is invalid.
    get nextStart() {
      const start = parseCount(this.startNumber, 1);
      return isNaN(start) ? null : start + PER_SHEET;
    },
    get startHint() {
      if (!this.valid("startNumber")) return "Enter a whole number from 1.";
      return `One sheet holds ${PER_SHEET} labels, so the next one starts at ${this.nextStart}.`;
    },

    // Shrinks a label text that is too wide for the space next to the QR
    // code, so long numbers or prefixes never run off the label.
    fitTexts() {
      for (const box of this.$root.querySelectorAll(".asn-label-text")) {
        const text = box.firstElementChild;
        box.style.fontSize = "";
        const needed = text.getBoundingClientRect().width;
        const available = box.getBoundingClientRect().width;
        if (needed > available)
          box.style.fontSize = `calc(var(--text-max-size) * ${(available / needed) * 0.98})`;
      }
    },

    print() {
      if (this.ok) window.print();
    },
    nextSheet() {
      if (!this.ok) return;
      this.startNumber = String(this.nextStart);
      this.$refs?.startNumber?.focus();
    },
    reset() {
      Object.assign(this, formFields(DEFAULTS));
    },
  };
}
