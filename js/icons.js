// Troca emojis por ícones de traço simples (SVG inline) em todo o app; emojis sem ícone mapeado ficam como estão
// e os mapeados para '' são removidos. Roda sozinho a cada mudança na tela.
const ICONS = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M2 20h20"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  utensils: '<path d="M6 3v7a2 2 0 0 0 4 0V3M8 10v11M17 3c-2 2-3 5-3 8h3v10"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H4v1a3 3 0 0 0 4 3M16 6h4v1a3 3 0 0 1-4 3M12 13v4M8 21h8M10 17h4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  settings: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>',
  moon: '<path d="M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z"/>',
  flame: '<path d="M12 3c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4-1-6 1-10z"/>',
  dumbbell: '<path d="M6 7v10M3 10v4M18 7v10M21 10v4M6 12h12"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 17l-6-6-8 8"/>',
  heart: '<path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'
};
const EMOJI = { '🏠': 'home', '📊': 'chart', '➕': 'plus', '🍽': 'utensils', '🏆': 'trophy', '👤': 'user', '⚙': 'settings', '☀': 'sun', '🌙': 'moon', '🔥': 'flame', '🏋': 'dumbbell', '🎯': 'target', '📝': 'edit', '✏': 'edit', '🗑': 'trash', '📷': 'camera', '🖼': 'image', '❤': 'heart', '📅': 'calendar', '⏱': 'clock', '🥩': '', '🍞': '', '🥑': '', '👋': '', '🚀': '', '💪': '', '🎉': '' };

function iconize(root = document.body) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(n => {
    if (!/\p{Extended_Pictographic}/u.test(n.nodeValue) || n.parentElement.closest('script,style,textarea,option')) return;
    const frag = document.createDocumentFragment(); let changed = false;
    n.nodeValue.split(/(\p{Extended_Pictographic}\uFE0F?)/u).forEach(part => {
      const key = part.replace('\uFE0F', '');
      if (part && key in EMOJI) {
        changed = true;
        if (EMOJI[key]) { const box = document.createElement('span'); box.innerHTML = `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${ICONS[EMOJI[key]]}</svg>`; frag.appendChild(box.firstChild); }
      } else if (part) frag.appendChild(document.createTextNode(part));
    });
    if (changed) n.replaceWith(frag);
  });
}
new MutationObserver(() => iconize()).observe(document.body, { childList: true, subtree: true });
iconize();
