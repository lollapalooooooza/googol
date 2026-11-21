import * as THREE from "three";

export interface MarsProceduralTextures {
  regolithColor: THREE.CanvasTexture;
  regolithBump: THREE.CanvasTexture;
  tireTrack: THREE.CanvasTexture;
  solarGrid: THREE.CanvasTexture;
  domeRibColor: THREE.CanvasTexture;
  domeRibBump: THREE.CanvasTexture;
  cratePanel: THREE.CanvasTexture;
  dustSprite: THREE.CanvasTexture;
  softShadow: THREE.CanvasTexture;
  dispose: () => void;
}

function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");
  return [canvas, ctx];
}

export function createMarsProceduralTextures(maxAnisotropy: number): MarsProceduralTextures {
  const anisotropy = Math.max(1, Math.min(8, maxAnisotropy));

  // 1. Regolith albedo + grayscale micro-relief bump map (tileable 512x512)
  const [regCanvas, regCtx] = makeCanvas(512, 512);
  const [bumpCanvas, bumpCtx] = makeCanvas(512, 512);
  const rand = seededRandom(4207);

  regCtx.fillStyle = "#9d4b29";
  regCtx.fillRect(0, 0, 512, 512);
  bumpCtx.fillStyle = "#808080";
  bumpCtx.fillRect(0, 0, 512, 512);

  // Subtle wind-blown aeolian ripple bands
  for (let y = 0; y < 512; y += 2) {
    const wave = Math.sin((y / 512) * Math.PI * 18) * 0.5 + 0.5;
    const tone = Math.round(138 + wave * 34);
    bumpCtx.fillStyle = `rgba(${tone},${tone},${tone},0.22)`;
    bumpCtx.fillRect(0, y, 512, 2);

    const r = Math.round(145 + wave * 28);
    const g = Math.round(68 + wave * 18);
    const b = Math.round(38 + wave * 10);
    regCtx.fillStyle = `rgba(${r},${g},${b},0.25)`;
    regCtx.fillRect(0, y, 512, 2);
  }

  // Iron-oxide patches and fine basaltic grit
  for (let i = 0; i < 4200; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const rad = 0.6 + rand() * 3.4;
    const dark = rand() > 0.45;
    regCtx.fillStyle = dark
      ? `rgba(${90 + Math.floor(rand() * 32)},${39 + Math.floor(rand() * 18)},${22 + Math.floor(rand() * 12)},${0.18 + rand() * 0.25})`
      : `rgba(${176 + Math.floor(rand() * 36)},${96 + Math.floor(rand() * 24)},${54 + Math.floor(rand() * 16)},${0.15 + rand() * 0.2})`;
    regCtx.beginPath();
    regCtx.arc(x, y, rad, 0, Math.PI * 2);
    regCtx.fill();

    const bv = dark ? 85 + Math.floor(rand() * 35) : 145 + Math.floor(rand() * 45);
    bumpCtx.fillStyle = `rgba(${bv},${bv},${bv},0.28)`;
    bumpCtx.beginPath();
    bumpCtx.arc(x, y, rad * 0.9, 0, Math.PI * 2);
    bumpCtx.fill();
  }

  const regolithColor = new THREE.CanvasTexture(regCanvas);
  regolithColor.colorSpace = THREE.SRGBColorSpace;
  regolithColor.wrapS = regolithColor.wrapT = THREE.RepeatWrapping;
  regolithColor.repeat.set(22, 22);
  regolithColor.anisotropy = anisotropy;

  const regolithBump = new THREE.CanvasTexture(bumpCanvas);
  regolithBump.wrapS = regolithBump.wrapT = THREE.RepeatWrapping;
  regolithBump.repeat.set(22, 22);
  regolithBump.anisotropy = anisotropy;

  // 2. Dual rover tire-track chevron tread ribbon texture
  const [trkCanvas, trkCtx] = makeCanvas(256, 512);
  trkCtx.clearRect(0, 0, 256, 512);

  // Soft compacted-dust wheel lanes at u = 0.22 and u = 0.78
  for (const cx of [56, 200]) {
    const grad = trkCtx.createLinearGradient(cx - 40, 0, cx + 40, 0);
    grad.addColorStop(0, "rgba(74, 30, 16, 0)");
    grad.addColorStop(0.25, "rgba(78, 33, 18, 0.42)");
    grad.addColorStop(0.5, "rgba(62, 25, 13, 0.56)");
    grad.addColorStop(0.75, "rgba(78, 33, 18, 0.42)");
    grad.addColorStop(1, "rgba(74, 30, 16, 0)");
    trkCtx.fillStyle = grad;
    trkCtx.fillRect(cx - 40, 0, 80, 512);

    // Cleat tread bars
    for (let y = 8; y < 512; y += 20) {
      trkCtx.fillStyle = "rgba(44, 17, 9, 0.68)";
      trkCtx.fillRect(cx - 24, y, 48, 6);
      trkCtx.fillStyle = "rgba(155, 84, 48, 0.28)";
      trkCtx.fillRect(cx - 22, y + 6, 44, 3);
    }
  }

  const tireTrack = new THREE.CanvasTexture(trkCanvas);
  tireTrack.colorSpace = THREE.SRGBColorSpace;
  tireTrack.wrapS = THREE.ClampToEdgeWrapping;
  tireTrack.wrapT = THREE.RepeatWrapping;
  tireTrack.repeat.set(1, 14);
  tireTrack.anisotropy = anisotropy;

  // 3. Photovoltaic solar panel silicon grid texture
  const [solCanvas, solCtx] = makeCanvas(512, 256);
  solCtx.fillStyle = "#162642";
  solCtx.fillRect(0, 0, 512, 256);

  // Outer aluminum border
  solCtx.strokeStyle = "#cbd2db";
  solCtx.lineWidth = 10;
  solCtx.strokeRect(5, 5, 502, 246);

  // Cell rows & columns with silver busbars
  const cols = 12;
  const rows = 6;
  const cw = (512 - 20) / cols;
  const rh = (256 - 20) / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const px = 10 + c * cw;
      const py = 10 + r * rh;
      const shade = 20 + ((r * 7 + c * 13) % 14);
      solCtx.fillStyle = `rgb(${shade}, ${36 + (c % 3) * 5}, ${68 + (r % 2) * 8})`;
      solCtx.fillRect(px + 2, py + 2, cw - 4, rh - 4);
      // Thin silver sub-busbar line
      solCtx.fillStyle = "rgba(198, 214, 232, 0.35)";
      solCtx.fillRect(px + cw * 0.5, py + 2, 1, rh - 4);
    }
  }

  const solarGrid = new THREE.CanvasTexture(solCanvas);
  solarGrid.colorSpace = THREE.SRGBColorSpace;
  solarGrid.anisotropy = anisotropy;

  // 4. Habitat dome composite panel seams + bump
  const [domeCanvas, domeCtx] = makeCanvas(512, 256);
  const [domeBumpCanvas, domeBumpCtx] = makeCanvas(512, 256);
  domeCtx.fillStyle = "#d9d2c8";
  domeCtx.fillRect(0, 0, 512, 256);
  domeBumpCtx.fillStyle = "#989898";
  domeBumpCtx.fillRect(0, 0, 512, 256);

  // Subtle horizontal & vertical panel ribs and warm Martian dust along base
  const dustGrad = domeCtx.createLinearGradient(0, 175, 0, 256);
  dustGrad.addColorStop(0, "rgba(165, 86, 48, 0)");
  dustGrad.addColorStop(1, "rgba(155, 76, 41, 0.42)");
  domeCtx.fillStyle = dustGrad;
  domeCtx.fillRect(0, 175, 512, 81);

  for (let x = 0; x < 512; x += 32) {
    domeCtx.fillStyle = "rgba(86, 76, 68, 0.42)";
    domeCtx.fillRect(x, 0, 2, 256);
    domeBumpCtx.fillStyle = "#525252";
    domeBumpCtx.fillRect(x, 0, 2, 256);
  }
  for (let y = 32; y < 256; y += 44) {
    domeCtx.fillStyle = "rgba(92, 82, 74, 0.35)";
    domeCtx.fillRect(0, y, 512, 2);
    domeBumpCtx.fillStyle = "#626262";
    domeBumpCtx.fillRect(0, y, 512, 2);
  }

  const domeRibColor = new THREE.CanvasTexture(domeCanvas);
  domeRibColor.colorSpace = THREE.SRGBColorSpace;
  domeRibColor.wrapS = THREE.RepeatWrapping;
  domeRibColor.anisotropy = anisotropy;

  const domeRibBump = new THREE.CanvasTexture(domeBumpCanvas);
  domeRibBump.wrapS = THREE.RepeatWrapping;
  domeRibBump.anisotropy = anisotropy;

  // 5. Cargo crate ruggedized paneling
  const [crateCanvas, crateCtx] = makeCanvas(256, 256);
  crateCtx.fillStyle = "#d8d3cc";
  crateCtx.fillRect(0, 0, 256, 256);
  crateCtx.strokeStyle = "#3a3e45";
  crateCtx.lineWidth = 18;
  crateCtx.strokeRect(9, 9, 238, 238);
  crateCtx.fillStyle = "#484d55";
  crateCtx.fillRect(38, 108, 180, 16);
  crateCtx.fillRect(108, 42, 40, 16);
  crateCtx.fillStyle = "#d97724";
  crateCtx.fillRect(46, 112, 22, 8);
  crateCtx.fillRect(188, 112, 22, 8);

  const cratePanel = new THREE.CanvasTexture(crateCanvas);
  cratePanel.colorSpace = THREE.SRGBColorSpace;
  cratePanel.anisotropy = anisotropy;

  // 6. Soft radial dust puff sprite for dust devil & rover wheel wake
  const [dustCanvas, dustCtx] = makeCanvas(128, 128);
  const dGrad = dustCtx.createRadialGradient(64, 64, 6, 64, 64, 62);
  dGrad.addColorStop(0, "rgba(226, 143, 92, 0.72)");
  dGrad.addColorStop(0.45, "rgba(196, 108, 63, 0.36)");
  dGrad.addColorStop(1, "rgba(170, 86, 48, 0)");
  dustCtx.fillStyle = dGrad;
  dustCtx.fillRect(0, 0, 128, 128);

  const dustSprite = new THREE.CanvasTexture(dustCanvas);
  dustSprite.colorSpace = THREE.SRGBColorSpace;

  // 7. Soft radial contact shadow decal (fades smoothly to zero at rim)
  const [shCanvas, shCtx] = makeCanvas(128, 128);
  const shGrad = shCtx.createRadialGradient(64, 64, 8, 64, 64, 62);
  shGrad.addColorStop(0, "rgba(28, 10, 4, 0.58)");
  shGrad.addColorStop(0.52, "rgba(32, 12, 5, 0.30)");
  shGrad.addColorStop(1, "rgba(32, 12, 5, 0)");
  shCtx.fillStyle = shGrad;
  shCtx.fillRect(0, 0, 128, 128);
  const softShadow = new THREE.CanvasTexture(shCanvas);
  softShadow.colorSpace = THREE.SRGBColorSpace;

  return {
    regolithColor,
    regolithBump,
    tireTrack,
    solarGrid,
    domeRibColor,
    domeRibBump,
    cratePanel,
    dustSprite,
    softShadow,
    dispose: () => {
      regolithColor.dispose();
      regolithBump.dispose();
      tireTrack.dispose();
      solarGrid.dispose();
      domeRibColor.dispose();
      domeRibBump.dispose();
      cratePanel.dispose();
      dustSprite.dispose();
      softShadow.dispose();
    },
  };
}
