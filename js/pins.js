// Stecknadeln für die Karte: Farbe und Symbol je Kategorie, damit sie auch ohne Farbsehen unterscheidbar sind.
// Private Spots bekommen einen gestrichelten Rand.

const ICONS = {
  // einfache 24×24-Symbole
  aussicht: g => { // Auge
    g.beginPath(); g.moveTo(2, 12); g.quadraticCurveTo(12, 1, 22, 12); g.quadraticCurveTo(12, 23, 2, 12); g.fill();
    g.globalCompositeOperation = "destination-out"; g.beginPath(); g.arc(12, 12, 4, 0, 7); g.fill();
    g.globalCompositeOperation = "source-over"; g.beginPath(); g.arc(12, 12, 2, 0, 7); g.fill();
  },
  natur: g => { g.beginPath(); g.moveTo(1, 20); g.lineTo(9, 6); g.lineTo(13, 13); g.lineTo(16, 9); g.lineTo(23, 20); g.closePath(); g.fill(); },
  stadt: g => { g.fillRect(3, 9, 7, 12); g.fillRect(11, 3, 10, 18); },
  parkdeck: g => { g.font = "bold 19px Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("P", 12, 13); },
  wasser: g => {
    g.lineWidth = 2.6; g.lineCap = "round";
    for (const y of [8, 14, 20]){ g.beginPath(); g.moveTo(2, y); g.bezierCurveTo(6, y - 4, 8, y + 4, 12, y); g.bezierCurveTo(16, y - 4, 18, y + 4, 22, y); g.stroke(); }
  },
  lostplace: g => { // Haus mit Riss
    g.beginPath(); g.moveTo(2, 12); g.lineTo(12, 3); g.lineTo(22, 12); g.lineTo(19, 12); g.lineTo(19, 21); g.lineTo(5, 21); g.lineTo(5, 12); g.closePath(); g.fill();
    g.globalCompositeOperation = "destination-out"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(13, 6); g.lineTo(10, 12); g.lineTo(14, 15); g.lineTo(11, 21); g.stroke();
    g.globalCompositeOperation = "source-over";
  },
  drohne: g => {
    g.lineWidth = 2.4;
    g.beginPath(); g.moveTo(6, 6); g.lineTo(18, 18); g.moveTo(18, 6); g.lineTo(6, 18); g.stroke();
    for (const [x, y] of [[5, 5], [19, 5], [5, 19], [19, 19]]){ g.beginPath(); g.arc(x, y, 3.6, 0, 7); g.stroke(); }
    g.fillRect(9.5, 9.5, 5, 5);
  },
  nacht: g => {
    g.beginPath(); g.arc(11, 12, 9, 0, 7); g.fill();
    g.globalCompositeOperation = "destination-out"; g.beginPath(); g.arc(16, 9, 8, 0, 7); g.fill();
    g.globalCompositeOperation = "source-over";
    g.beginPath(); g.arc(19, 17, 1.6, 0, 7); g.fill();
  }
};

export function drawPin(cat, priv, color, ratio = 2, asCanvas = false){
  const W = 32, H = 42;
  const c = document.createElement("canvas");
  c.width = W * ratio; c.height = H * ratio;
  const g = c.getContext("2d");
  g.scale(ratio, ratio);
  // Form
  const path = new Path2D("M16 41C16 41 3 26.5 3 16a13 13 0 0 1 26 0C29 26.5 16 41 16 41z");
  g.shadowColor = "rgba(0,0,0,.35)"; g.shadowBlur = 3; g.shadowOffsetY = 1.5;
  g.fillStyle = color; g.fill(path);
  g.shadowColor = "transparent";
  g.lineWidth = 2; g.strokeStyle = "#fff";
  if (priv) g.setLineDash([3, 2.5]);
  g.stroke(path); g.setLineDash([]);
  // Symbol (in eigener Ebene, damit "Ausschneiden" nur das Symbol betrifft)
  const ic = document.createElement("canvas");
  ic.width = 24 * ratio; ic.height = 24 * ratio;
  const ig = ic.getContext("2d");
  ig.scale(ratio, ratio); ig.fillStyle = "#fff"; ig.strokeStyle = "#fff";
  (ICONS[cat] || ICONS.aussicht)(ig);
  g.drawImage(ic, 16 - 8.5, 16 - 8.5, 17, 17);
  if (asCanvas) return c;
  return g.getImageData(0, 0, c.width, c.height);
}
