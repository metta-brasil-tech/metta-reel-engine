/**
 * palavras.js - Mostra as palavras do bruto numa faixa de tempo, com o tempo de
 * cada uma. E o que permite escrever um descarte que comeca e termina onde a
 * fala realmente comeca e termina, em vez de chutar a janela.
 *
 * Uso: node .scripts/reel/palavras.js <pastaDoVideo> <de> <ate>
 */
const fs = require('fs');
const path = require('path');

const [dir, deArg, ateArg] = process.argv.slice(2);
if (!dir || deArg === undefined) {
  console.error('uso: node palavras.js <pasta> <de> <ate>');
  process.exit(1);
}
const de = Number(deArg);
const ate = Number(ateArg !== undefined ? ateArg : de + 10);

const cfg = JSON.parse(fs.readFileSync(path.join(dir, 'decupagem-config.json'), 'utf8'));
const offset = cfg.offset_transcricao || 0;
const tr = JSON.parse(fs.readFileSync(path.join(dir, 'util_palavras.json'), 'utf8'));
const palavras = tr.transcription || [];

let linha = [];
let inicioLinha = null;
let ultimo = null;

for (const p of palavras) {
  const t0 = p.offsets.from / 1000 + offset;
  const t1 = p.offsets.to / 1000 + offset;
  if (t1 < de || t0 > ate) continue;
  const txt = (p.text || '').trim();
  if (!txt) continue;

  // quebra a linha quando ha pausa, que e onde o corte pode entrar sem ferir fala
  if (ultimo !== null && t0 - ultimo > 0.35 && linha.length) {
    console.log(`${inicioLinha.toFixed(2)}-${ultimo.toFixed(2)}  ${linha.join('')}`);
    console.log(`        (pausa de ${(t0 - ultimo).toFixed(2)}s)`);
    linha = [];
    inicioLinha = null;
  }
  if (inicioLinha === null) inicioLinha = t0;
  linha.push(txt.startsWith("'") || /^[,.!?]/.test(txt) ? txt : ' ' + txt);
  ultimo = t1;
}
if (linha.length) console.log(`${inicioLinha.toFixed(2)}-${ultimo.toFixed(2)}  ${linha.join('')}`);
console.log(`\n(tempos em bruto, offset de transcricao ${offset}s ja somado)`);
