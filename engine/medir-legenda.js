/**
 * medir-legenda.js - Renderiza a legenda sobre preto e mede a caixa do texto.
 *
 * Serve para conferir contra o DNA (altura de maiúscula 41 a 46px, centro a 54%
 * da altura), já que o tamanho do corpo em ASS não corresponde direto ao pixel.
 *
 * Uso: node medir-legenda.js [segundo]
 */
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const ctx = require('./contexto').abrir();
const vt = ctx.vt;

const quando = process.argv[2] || '15.2';
const TMP = ctx.sub('tmp');
if (!fs.existsSync(TMP)) fs.mkdirSync(TMP, { recursive: true });

const escapar = p => p.replace(/\\/g, '/').replace(/:/g, '\\:');
const ass = escapar(ctx.caminho('legenda.ass'));
const fontsdir = escapar(ctx.fontes);

const png = path.join(TMP, 'leg_preto.png');
const raw = path.join(TMP, 'leg.raw');

execFileSync(vt.FFMPEG, [
  '-hide_banner', '-loglevel', 'error',
  '-f', 'lavfi', '-i', 'color=black:s=1080x1920:r=30', '-t', '50',
  '-vf', `ass='${ass}':fontsdir='${fontsdir}'`,
  '-ss', quando, '-frames:v', '1', '-y', png
]);

execFileSync(vt.FFMPEG, ['-hide_banner', '-loglevel', 'error', '-i', png, '-vf', 'format=gray', '-f', 'rawvideo', '-y', raw]);

const b = fs.readFileSync(raw);
const W = 1080, H = 1920;
let minX = W, maxX = 0, minY = H, maxY = 0, n = 0;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (b[y * W + x] > 180) {
      n++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}

if (!n) {
  console.log('nada renderizado em ' + quando + 's (fonte não carregou ou não há legenda nesse instante)');
  process.exit(0);
}

// altura por linha: conta as faixas horizontais com pixel aceso
const linhasCheias = [];
for (let y = 0; y < H; y++) {
  let temPixel = false;
  for (let x = 0; x < W; x++) if (b[y * W + x] > 180) { temPixel = true; break; }
  linhasCheias.push(temPixel);
}
let faixas = 0, dentro = false;
for (let y = 0; y < H; y++) {
  if (linhasCheias[y] && !dentro) { faixas++; dentro = true; }
  else if (!linhasCheias[y]) dentro = false;
}

console.log(`instante:            ${quando}s`);
console.log(`caixa do texto:      ${maxX - minX}px de largura, ${maxY - minY}px de altura`);
console.log(`linhas de texto:     ${faixas}`);
console.log(`altura por linha:    ${((maxY - minY) / Math.max(1, faixas)).toFixed(0)}px  (inclui acentos e descidas)`);
console.log(`centro vertical:     ${((minY + maxY) / 2).toFixed(0)}px  (alvo do DNA: 1037px)`);
console.log(`margem lateral:      ${minX}px à esquerda, ${W - maxX}px à direita`);
console.log(`DNA de referência:   maiúscula 41 a 46px, corpo ~60px, uma linha`);
