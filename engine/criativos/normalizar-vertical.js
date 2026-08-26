/**
 * normalizar-vertical.js - Converte bruto horizontal em bruto vertical 9:16.
 *
 * Parte dos criativos e gravada em 16:9 e o entregavel e vertical. O motor de
 * reel espera bruto vertical, entao o crop acontece antes do pipeline, uma vez,
 * em vez de virar caso especial dentro do montador.
 *
 * O recorte e centrado no sujeito, nao no quadro: em entrevista o rosto quase
 * nunca esta no meio exato, e cortar pelo centro geometrico decapita ou
 * descentraliza.
 *
 * Uso: node .scripts/normalizar-vertical.js <entrada> <saida> [centroX] [centroY]
 *   centroX  fracao da largura onde esta o rosto (0 a 1). Padrao 0.5
 *   centroY  fracao da altura onde ficara o topo do recorte. Padrao 0 (altura cheia)
 */
const { execFileSync } = require('child_process');
const fs = require('fs');

const [entrada, saida, cxArg, cyArg] = process.argv.slice(2);
if (!entrada || !saida) {
  console.error('uso: node normalizar-vertical.js <entrada> <saida> [centroX] [centroY]');
  process.exit(1);
}
const centroX = Number(cxArg || 0.5);

const info = JSON.parse(execFileSync('ffprobe', [
  '-v', 'error', '-select_streams', 'v:0',
  '-show_entries', 'stream=width,height,r_frame_rate',
  '-of', 'json', entrada,
]).toString()).streams[0];

const L = info.width;
const A = info.height;
if (A > L) {
  console.log('ja e vertical, nada a fazer');
  process.exit(0);
}

// altura cheia, largura pelo 9:16
const alturaCorte = A;
const larguraCorte = Math.round((A * 9) / 16 / 2) * 2;
let x = Math.round(centroX * L - larguraCorte / 2);
x = Math.max(0, Math.min(L - larguraCorte, x));

console.log(`${L}x${A} -> recorte ${larguraCorte}x${alturaCorte} em x=${x} (centro ${(centroX * 100).toFixed(0)}%)`);
console.log('escalando para 2160x3840, que e o que o motor espera de bruto vertical');

execFileSync('ffmpeg', [
  '-v', 'error', '-stats', '-i', entrada,
  '-vf', `crop=${larguraCorte}:${alturaCorte}:${x}:0,scale=2160:3840:flags=lanczos`,
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '16',
  '-c:a', 'copy',
  '-y', saida,
], { stdio: 'inherit' });

const mb = (fs.statSync(saida).size / 1048576).toFixed(0);
console.log(`\n${saida}  ${mb} MB`);
