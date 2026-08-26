/**
 * onde.js - Traduz um tempo do video final para o tempo correspondente no bruto.
 *
 * O feedback chega sempre em tempo de entregavel ("no 0:27 ele erra a fala"),
 * mas o descarte precisa ser escrito em tempo de bruto. Fazer essa conta na mao
 * erra, porque cada corte desloca tudo o que vem depois.
 *
 * Uso: node .scripts/reel/onde.js <pastaDoVideo> <tempoNoFinal> [janela]
 *      node .scripts/reel/onde.js <pastaDoVideo> --lista
 */
const fs = require('fs');
const path = require('path');

const [dir, alvoArg, janelaArg] = process.argv.slice(2);
if (!dir) {
  console.error('uso: node onde.js <pasta> <tempoNoFinal> [janela] | <pasta> --lista');
  process.exit(1);
}

const dec = JSON.parse(fs.readFileSync(path.join(dir, 'decupagem.json'), 'utf8'));
const segs = Array.isArray(dec) ? dec : (dec.segmentos || dec);

// posicao de cada segmento na linha do tempo do entregavel
let t = 0;
const mapa = segs.map((s) => {
  const item = { id: s.id, finalDe: t, finalAte: t + (s.ate - s.de), brutoDe: s.de, brutoAte: s.ate, papel: s.papel, texto: s.texto };
  t += s.ate - s.de;
  return item;
});

function fmt(n) { return n.toFixed(2) + 's'; }

if (alvoArg === '--lista') {
  console.log('final          bruto            papel      texto');
  for (const m of mapa) {
    console.log(
      `${fmt(m.finalDe).padStart(7)}-${fmt(m.finalAte).padEnd(8)} ` +
      `${fmt(m.brutoDe).padStart(7)}-${fmt(m.brutoAte).padEnd(8)} ` +
      `${(m.papel || '').padEnd(10)} ${m.texto.slice(0, 60)}`
    );
  }
  console.log(`\ntotal ${fmt(t)} em ${mapa.length} segmentos`);
  process.exit(0);
}

const alvo = Number(alvoArg);
const janela = Number(janelaArg || 4);
console.log(`tempo ${fmt(alvo)} no final, janela de ${janela}s\n`);

const perto = mapa.filter((m) => m.finalAte >= alvo - janela && m.finalDe <= alvo + janela);
if (!perto.length) { console.log('nada nessa faixa'); process.exit(0); }

for (const m of perto) {
  const marca = alvo >= m.finalDe && alvo < m.finalAte ? ' <<< aqui' : '';
  console.log(`seg ${String(m.id).padStart(2)} | final ${fmt(m.finalDe)}-${fmt(m.finalAte)} | BRUTO ${fmt(m.brutoDe)}-${fmt(m.brutoAte)} | ${m.papel || ''}${marca}`);
  console.log(`        ${m.texto.slice(0, 100)}`);
}

const dentro = perto.find((m) => alvo >= m.finalDe && alvo < m.finalAte);
if (dentro) {
  const deslocamento = alvo - dentro.finalDe;
  console.log(`\nno bruto, o instante ${fmt(alvo)} do final cai em ${fmt(dentro.brutoDe + deslocamento)}`);
}
