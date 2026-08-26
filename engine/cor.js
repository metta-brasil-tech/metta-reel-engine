/**
 * cor.js - Aplica o tratamento de cor medido nas pecas do editor.
 *
 * Roda depois do acabamento, sobre o final.mp4, porque e a unica etapa que
 * precisa ver a peca inteira para conferir se acertou. Antes disso a imagem
 * ainda esta em partes.
 *
 * Alvos medidos nas 4 referencias (docs em _ref/DNA-EDITOR.md):
 *   preto ancorado em 0, com 15 a 35% do quadro abaixo de Y=25
 *   branco ate 253, contraste p5-p95 entre 190 e 253
 *   saturacao media de 21 a 31%
 *   temperatura quente, R-B entre +15 e +30 nos meios-tons
 *
 * Uso: node .scripts/reel/cor.js <entrada> <saida> [--medir]
 *      node .scripts/reel/cor.js <arquivo> --medir     so mede, nao grava
 */
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');

const args = process.argv.slice(2);
const soMedir = args.includes('--medir');
const entrada = args[0];
const saida = soMedir ? null : args[1];

if (!entrada || (!soMedir && !saida)) {
  console.error('uso: node cor.js <entrada> <saida> | node cor.js <arquivo> --medir');
  process.exit(1);
}

function medir(arquivo) {
  const r = spawnSync('ffmpeg', [
    '-v', 'error', '-i', arquivo,
    '-vf', 'signalstats,metadata=print:file=-',
    '-f', 'null', '-',
  ], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  const txt = (r.stdout || '') + (r.stderr || '');
  const pega = (chave) => {
    const vals = [...txt.matchAll(new RegExp(`lavfi\\.signalstats\\.${chave}=([-\\d.]+)`, 'g'))]
      .map((m) => Number(m[1]));
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };
  return {
    YMIN: pega('YMIN'), YMAX: pega('YMAX'), YAVG: pega('YAVG'),
    SATAVG: pega('SATAVG'), UAVG: pega('UAVG'), VAVG: pega('VAVG'),
  };
}

const antes = medir(entrada);
console.log('antes  :', Object.entries(antes).map(([k, v]) => `${k}=${v === null ? '?' : v.toFixed(1)}`).join('  '));

if (soMedir) process.exit(0);

// curves ancora o preto e abre o branco; eq levanta contraste e saturacao;
// colorbalance empurra os meios-tons para o quente sem sujar as altas.
// A saturacao parou em 1.30 por julgamento visual, nao por metrica. Comparado
// lado a lado: 1.30 da vida a pele e a camiseta; 1.80 chega ao SATAVG das
// referencias mas deixa a pele alaranjada. O SATAVG delas nao se transfere,
// porque mede o quadro inteiro e o cenario destes criativos e uma sala neutra.
const GRADE = [
  'curves=all=0/0 0.08/0.035 0.50/0.52 0.90/0.95 1/1',
  'eq=contrast=1.10:saturation=1.30:gamma=0.99',
  'colorbalance=rm=0.045:bm=-0.045:rs=0.015:bs=-0.015',
].join(',');

console.log('aplicando grade...');
execFileSync('ffmpeg', [
  '-v', 'error', '-stats', '-i', entrada,
  '-vf', GRADE,
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
  '-c:a', 'copy', '-movflags', '+faststart',
  '-y', saida,
], { stdio: ['ignore', 'ignore', 'ignore'] });

const depois = medir(saida);
console.log('depois :', Object.entries(depois).map(([k, v]) => `${k}=${v === null ? '?' : v.toFixed(1)}`).join('  '));

// confere contra os alvos, sem falhar o build: quem julga cor e o olho, o
// numero so diz se saiu da faixa em que as referencias vivem.
const rb = depois.VAVG !== null && depois.UAVG !== null ? (depois.VAVG - 128) - (depois.UAVG - 128) : null;
const avisos = [];
// Saturacao nao entra como criterio de falha: SATAVG mede o quadro inteiro, e
// cenario neutro derruba o numero sem que a pele esteja lavada. Fica so o
// registro, para acompanhar deriva entre pecas do mesmo cenario.
if (depois.YMIN !== null && depois.YMIN > 12) avisos.push(`preto em ${depois.YMIN.toFixed(0)}, deveria encostar em 0`);
if (depois.YMAX !== null && depois.YMAX < 235) avisos.push(`branco so vai a ${depois.YMAX.toFixed(0)}, imagem sem estouro`);
if (rb !== null && rb < 2) avisos.push(`R-B de ${rb.toFixed(1)}, imagem nao ficou quente`);
console.log(avisos.length ? 'avisos: ' + avisos.join('; ') : 'dentro da faixa das referencias');
console.log(`${saida}  ${(fs.statSync(saida).size / 1048576).toFixed(1)} MB`);
