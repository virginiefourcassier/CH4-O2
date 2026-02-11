const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const UI = {
  temp: document.getElementById("temp"),
  ch4: document.getElementById("ch4"),
  o2: document.getElementById("o2"),
  btnSymbols: document.getElementById("btnSymbols"),
  btnPause: document.getElementById("btnPause"),
  btnReset: document.getElementById("btnReset"),
};

let showSymbols = true;
let paused = false;
let lastTs = null;

// ------- style / tailles -------
const R = 15;                 // rayon atomes (grossis)
const HUD = { x: 18, y: 18, w: 230, h: 135 };
const W = canvas.width, H = canvas.height;

// ------- particules : molécules -------
let CH4 = [];
let O2 = [];
let H2O = [];
let CO2 = [];

function clamp01(v){ return Math.max(0, Math.min(1, v)); }
function hexToRgb(hex){
  const h = hex.replace("#","").trim();
  const v = parseInt(h.length===3 ? h.split("").map(c=>c+c).join("") : h, 16);
  return { r:(v>>16)&255, g:(v>>8)&255, b:v&255 };
}
function rgbToHex({r,g,b}){
  const to2 = (n)=>("0"+Math.round(n).toString(16)).slice(-2);
  return "#"+to2(r)+to2(g)+to2(b);
}
function mix(c1, c2, t){
  t = clamp01(t);
  return { r: c1.r + (c2.r-c1.r)*t, g: c1.g + (c2.g-c1.g)*t, b: c1.b + (c2.b-c1.b)*t };
}

function drawSphere(x, y, baseHex, label, outlineHex=null, r=R){
  const base = hexToRgb(baseHex);
  const white = {r:255,g:255,b:255};
  const black = {r:0,g:0,b:0};

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 5;

  const grad = ctx.createRadialGradient(x - r*0.35, y - r*0.35, r*0.2, x, y, r);
  grad.addColorStop(0.00, rgbToHex(mix(base, white, 0.75)));
  grad.addColorStop(0.35, rgbToHex(mix(base, white, 0.25)));
  grad.addColorStop(1.00, rgbToHex(mix(base, black, 0.22)));

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI*2);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.shadowColor = "transparent";
  ctx.lineWidth = 2;
  ctx.strokeStyle = outlineHex ? outlineHex : "rgba(0,0,0,0.12)";
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x - r*0.35, y - r*0.35, r*0.35, 0, Math.PI*2);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fill();

  ctx.restore();

  if(showSymbols && label){
    ctx.save();
    ctx.fillStyle = (baseHex.toLowerCase() === "#ffffff") ? "#111" : "#fff";
    ctx.font = `bold ${Math.round(r*0.9)}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x, y);
    ctx.restore();
  }
}

function drawRoundedRect(x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y, x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r);
  ctx.arcTo(x, y, x+w, y, r);
  ctx.closePath();
}

function randVel(scale){
  return (Math.random()-0.5) * scale;
}

function newMolecule(type){
  // vx, vy en px/s
  const speed = 140;
  return {
    type,
    x: Math.random() * (W - 2*R) + R,
    y: Math.random() * (H - 260) + R,
    vx: randVel(speed),
    vy: randVel(speed),
    // pour CH4 : compte d'activation (besoin de 2 O2)
    armed: 0,
    armed_t: 0
  };
}

function resetSim(){
  CH4 = [];
  O2 = [];
  H2O = [];
  CO2 = [];

  const nCH4 = Number(UI.ch4.value);
  const nO2  = Number(UI.o2.value);

  for(let i=0;i<nCH4;i++) CH4.push(newMolecule("CH4"));
  for(let i=0;i<nO2;i++)  O2.push(newMolecule("O2"));

  lastTs = null;
}

function toggleSymbols(){
  showSymbols = !showSymbols;
  UI.btnSymbols.textContent = showSymbols ? "Symboles : ON" : "Symboles : OFF";
}

function pauseSim(){
  paused = !paused;
  UI.btnPause.textContent = paused ? "Reprendre" : "Pause";
}

// ---- dynamique ----
function step(arr, dt, speedMult){
  for(const m of arr){
    m.x += m.vx * dt * speedMult;
    m.y += m.vy * dt * speedMult;

    if(m.x < R){ m.x = R; m.vx *= -1; }
    if(m.x > W - R){ m.x = W - R; m.vx *= -1; }
    if(m.y < R){ m.y = R; m.vy *= -1; }
    if(m.y > H - 140){ m.y = H - 140; m.vy *= -1; }
  }
}

// ---- rendu molécules (sprites atomiques) ----
function drawCH4(m){
  // C au centre (gris foncé) + 4 H (blanc)
  const cx = m.x, cy = m.y;
  const off = R*1.15;
  drawSphere(cx, cy, "#444444", "C", null, R);
  drawSphere(cx + off, cy, "#ffffff", "H", "rgba(0,0,0,0.35)", R*0.9);
  drawSphere(cx - off, cy, "#ffffff", "H", "rgba(0,0,0,0.35)", R*0.9);
  drawSphere(cx, cy + off, "#ffffff", "H", "rgba(0,0,0,0.35)", R*0.9);
  drawSphere(cx, cy - off, "#ffffff", "H", "rgba(0,0,0,0.35)", R*0.9);

  if(showSymbols){
    ctx.save();
    ctx.fillStyle = "#111";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("CH₄", cx, cy - off - R*0.9);
    ctx.restore();
  }
}

function drawO2(m){
  // deux O rouges collés
  const dx = R*0.65;
  drawSphere(m.x - dx, m.y, "#d02020", "O", null, R);
  drawSphere(m.x + dx, m.y, "#d02020", "O", null, R);

  if(showSymbols){
    ctx.save();
    ctx.fillStyle = "#111";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("O₂", m.x, m.y - R*1.4);
    ctx.restore();
  }
}

function drawH2O(m){
  // O rouge + 2 H blancs en V
  const ox = m.x, oy = m.y;
  drawSphere(ox, oy, "#d02020", "O", null, R);
  const a = R*1.05;
  drawSphere(ox - a, oy + a*0.55, "#ffffff", "H", "rgba(0,0,0,0.35)", R*0.9);
  drawSphere(ox + a, oy + a*0.55, "#ffffff", "H", "rgba(0,0,0,0.35)", R*0.9);

  if(showSymbols){
    ctx.save();
    ctx.fillStyle = "#111";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("H₂O", ox, oy - R*1.4);
    ctx.restore();
  }
}

function drawCO2(m){
  // O=C=O : C gris + 2 O rouges
  const dx = R*1.05;
  drawSphere(m.x, m.y, "#444444", "C", null, R);
  drawSphere(m.x - dx*1.1, m.y, "#d02020", "O", null, R);
  drawSphere(m.x + dx*1.1, m.y, "#d02020", "O", null, R);

  if(showSymbols){
    ctx.save();
    ctx.fillStyle = "#111";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("CO₂", m.x, m.y - R*1.4);
    ctx.restore();
  }
}

// ---- collisions / réaction ----
// Simplification : une molécule CH4 doit rencontrer 2 O2 "en chaîne" (dans une fenêtre de temps courte)
// puis réaction: CH4 + 2 O2 -> CO2 + 2 H2O
function dist2(ax,ay,bx,by){ const dx=ax-bx, dy=ay-by; return dx*dx+dy*dy; }

function react(dt, temp){
  // paramètres pour finir < ~2 minutes (selon quantités)
  const pBase = 0.70;
  const p = Math.min(0.98, pBase * (0.60 + 0.22*temp));  // plus chaud => plus efficace
  const rHit = R*2.6;
  const r2 = rHit*rHit;

  // fenêtre d'armement (s)
  const armWindow = 0.9;

  // diminution de l'armement si trop vieux
  for(const m of CH4){
    if(m.armed > 0){
      m.armed_t += dt;
      if(m.armed_t > armWindow){
        m.armed = 0;
        m.armed_t = 0;
      }
    }
  }

  // collisions CH4-O2
  for(let i = CH4.length - 1; i >= 0; i--){
    const ch = CH4[i];

    // recherche d'un O2 proche
    let hitIndex = -1;
    for(let j = O2.length - 1; j >= 0; j--){
      const o = O2[j];
      if(dist2(ch.x, ch.y, o.x, o.y) <= r2){
        hitIndex = j;
        break;
      }
    }
    if(hitIndex === -1) continue;

    // collision détectée
    if(Math.random() < p){
      // consommer un O2
      const o = O2.splice(hitIndex, 1)[0];

      // "armement" : il faut 2 O2
      ch.armed += 1;
      ch.armed_t = 0;

      // petit "rebond" pour séparer visuellement
      ch.vx *= -1; ch.vy *= -1;

      // si 2 O2 déjà consommés autour du même CH4 -> réaction
      if(ch.armed >= 2){
        // consommer CH4
        CH4.splice(i, 1);

        // produire CO2 + 2 H2O (au voisinage)
        CO2.push({
          type:"CO2",
          x: ch.x,
          y: ch.y,
          vx: randVel(160),
          vy: randVel(160)
        });

        for(let k=0;k<2;k++){
          H2O.push({
            type:"H2O",
            x: ch.x + (Math.random()*40 - 20),
            y: ch.y + (Math.random()*40 - 20),
            vx: randVel(160),
            vy: randVel(160)
          });
        }
      }
    }
  }
}

// ---- HUD ----
function drawHUD(){
  ctx.save();
  drawRoundedRect(HUD.x, HUD.y, HUD.w, HUD.h, 14);
  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.stroke();

  ctx.fillStyle = "#111";
  ctx.font = "bold 18px Arial";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  const lines = [
    `CH₄ : ${CH4.length}`,
    `O₂  : ${O2.length}`,
    `CO₂ : ${CO2.length}`,
    `H₂O : ${H2O.length}`,
  ];
  let yy = HUD.y + 12;
  for(const ln of lines){
    ctx.fillText(ln, HUD.x + 14, yy);
    yy += 22;
  }
  ctx.restore();
}

// ---- rendu ----
function render(){
  ctx.clearRect(0,0,W,H);

  // ordre : réactifs puis produits
  for(const m of CH4) drawCH4(m);
  for(const m of O2)  drawO2(m);
  for(const m of CO2) drawCO2(m);
  for(const m of H2O) drawH2O(m);

  drawHUD();

  if(paused){
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.10)";
    ctx.fillRect(0,0,W,H);
    ctx.fillStyle = "#111";
    ctx.font = "bold 46px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("PAUSE", W/2, H/2);
    ctx.restore();
  }
}

// ---- boucle ----
function loop(ts){
  if(lastTs === null) lastTs = ts;
  const dt = Math.min(0.033, (ts - lastTs)/1000);
  lastTs = ts;

  const temp = Number(UI.temp.value);
  // effet T accentué sur vitesse
  const speedMult = (temp*temp) * 0.25; // temp=2 -> 1 ; temp=5 -> 6.25

  if(!paused){
    step(CH4, dt, speedMult);
    step(O2,  dt, speedMult*1.05);
    step(H2O, dt, speedMult*0.95);
    step(CO2, dt, speedMult*0.95);
    react(dt, temp);
  }

  render();
  requestAnimationFrame(loop);
}

// ---- events ----
UI.btnSymbols.addEventListener("click", toggleSymbols);
UI.btnPause.addEventListener("click", () => { paused = !paused; UI.btnPause.textContent = paused ? "Reprendre" : "Pause"; });
UI.btnReset.addEventListener("click", () => { paused = false; UI.btnPause.textContent = "Pause"; resetSim(); });

UI.ch4.addEventListener("input", resetSim);
UI.o2.addEventListener("input", resetSim);

// init
resetSim();
requestAnimationFrame(loop);
