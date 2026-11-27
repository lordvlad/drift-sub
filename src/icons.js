/** Inline stroke icons (24x24). ib() turns a <button> into an icon button with an accessible label. */
const P = {
  gamepad: 'M6 8h12a4 4 0 0 1 4 4v3a3 3 0 0 1-5.2 2L15 15H9l-1.8 2A3 3 0 0 1 2 15v-3a4 4 0 0 1 4-4z M8 10.5v3 M6.5 12h3 M16 11.5h.01 M18 13.5h.01',
  touch: 'M9 11V5.5a1.5 1.5 0 0 1 3 0V10 M12 10a1.5 1.5 0 0 1 3 0v1 M15 11a1.5 1.5 0 0 1 3 0v4a6 6 0 0 1-6 6h-1.5a6 6 0 0 1-4.6-2.2L4 15a1.5 1.5 0 0 1 2.3-1.9L9 15',
  keys: 'M3 6h18a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z M6 10h.01 M10 10h.01 M14 10h.01 M18 10h.01 M7.5 14h9',
  album: 'M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z M8.5 10a1.5 1.5 0 1 0 0-.01 M3 17l5-5 4 4 3-3 6 6',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2v2 M12 20v2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M2 12h2 M20 12h2 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4',
  sunrise: 'M17 18a5 5 0 0 0-10 0 M12 3v7 M9 6l3-3 3 3 M4.2 11.2l1.4 1.4 M19.8 11.2l-1.4 1.4 M1 18h3 M20 18h3 M2 22h20',
  sunset: 'M17 18a5 5 0 0 0-10 0 M12 10V3 M9 7l3 3 3-3 M4.2 11.2l1.4 1.4 M19.8 11.2l-1.4 1.4 M1 18h3 M20 18h3 M2 22h20',
  moon: 'M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z',
  lamp: 'M7 3h10l-2 6H9z M9 9v11a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V9 M12 13v2',
  lampOn: 'M7 3h10l-2 6H9z M9 9v11a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V9 M12 13v2 M4 4L2 3 M4 7H2 M20 4l2-1 M20 7h2',
  lampOff: 'M7 3h10l-2 6H9z M9 9v11a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V9 M12 13v2 M3 3l18 18',
  still: 'M3 12h18',
  calm: 'M2 12c2.5-2.5 5-2.5 7.5 0s5 2.5 7.5 0 3-2 5 0',
  windy: 'M2 17c2.5-2.5 5-2.5 7.5 0s5 2.5 7.5 0 M3 8h9a2 2 0 1 0-2-2 M3 12h14',
  gusty: 'M2 19c3-5 6-5 9 0s6 5 9 0 M4 7h10a2.5 2.5 0 1 0-2.5-2.5 M4 11h14',
  stormy: 'M7 16a4 4 0 0 1 .5-8 5 5 0 0 1 9.6 1A3.5 3.5 0 0 1 17 16 M13 12l-3 5h4l-3 5',
  soundOn: 'M4 9v6h4l5 4V5L8 9z M16 9a4 4 0 0 1 0 6 M18.5 6.5a8 8 0 0 1 0 11',
  soundOff: 'M4 9v6h4l5 4V5L8 9z M17 9l5 6 M22 9l-5 6',
  close: 'M6 6l12 12 M18 6L6 18',
  back: 'M15 5l-7 7 7 7',
  chevL: 'M15 5l-7 7 7 7',
  chevR: 'M9 5l7 7-7 7',
  coin: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.5 0-2.5.8-2.5 2s1 1.6 2.5 2 2.5.8 2.5 2-1 2-2.5 2c-1 0-2-.5-2.5-1.5 M12 6.5V8 M12 16v1.5',
  download: 'M12 4v11 M7 11l5 5 5-5 M5 20h14',
  trash: 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13 M10 11v6 M14 11v6',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z M4 21V5 M19 19v2H6 M9 8h6 M9 11h4',
  fullscreen: 'M4 9V4h5 M20 9V4h-5 M4 15v5h5 M20 15v5h-5',
  cart: 'M3 4h2.5l2.2 11h10.6l2-8H6.5 M10 20a1 1 0 1 0 .01 0 M17 20a1 1 0 1 0 .01 0',
  swap: 'M4 8h13 M13 4l4 4-4 4 M20 16H7 M11 12l-4 4 4 4',
  zoom: 'M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13z M15.5 15.5L21 21 M10.5 7.5v6 M7.5 10.5h6',
};
export const svg = (name, size = 22) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${P[name]}"/></svg>`;

export function ib(el, name, title) {
  if (el._ib !== name) { el._ib = name; el.innerHTML = svg(name); }
  el.classList.add('ib'); el.title = title; el.setAttribute('aria-label', title);
}
