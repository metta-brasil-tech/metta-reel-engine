/**
 * calibrar-sfx.js - Descobre o volume do whoosh comparando os cortes que têm
 * efeito com os que não têm.
 *
 * Medir o pico absoluto no corte não serve: o que aparece ali é sobretudo a voz.
 * O que importa é quanto o efeito soma acima do que já existiria sem ele.
 *
 * Uso: node calibrar-sfx.js [vol1 vol2 ...]
 */
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const ctx = require('./contexto').abrir();
const vt = ctx.vt;

const DIR = ctx.dir;
const TMP = ctx.sub('tmp');
const partes = JSON.parse(fs.readFileSync(path.join(TMP, 'partes.json'), 'utf8'));
const visual = JSON.parse(fs.readFileSync(path.join(DIR, 'plano-visual.json'), 'utf8'));
const regra = visual.sfx;

const volumes = process.argv.slice(2).map(Number);
const lista = volumes.length ? volumes : [0.22, 0.35, 0.5, 0.7];

// Onde entram os efeitos e onde estão os cortes secos
const comEfeito = [], semEfeito = [];
for (let i = 1; i < partes.length; i++) {
  const delta = partes[i].zoom - partes[i - 1].zoom;
  (Math.abs(delta) >= regra.delta_minimo ? comEfeito : semEfeito).push({ t: partes[i].inicio, sobe: delta > 0 });
}

function energia(wav) {
  const b = fs.readFileSync(wav);
  let pos = 12, off = -1, len = 0, sr = 16000;
  while (pos < b.length - 8) {
    const id = b.toString('ascii', pos, pos + 4);
    const sz = b.readUInt32LE(pos + 4);
    if (id === 'fmt ') sr = b.readUInt32LE(pos + 12);
    if (id === 'data') { off = pos + 8; len = sz; break; }
    pos += 8 + sz + (sz % 2);
  }
  const pj = Math.round(sr * 0.05), tot = Math.floor(len / 2), j = [];
  for (let w = 0; w * pj < tot; w++) {
    let s = 0, n = 0;
    for (let i = 0; i < pj; i++) {
      const k = w * pj + i;
      if (k >= tot) break;
      const v = b.readInt16LE(off + k * 2) / 32768;
      s += v * v; n++;
    }
    if (!n) break;
    const r = Math.sqrt(s / n);
    j.push({ t: (w * pj) / sr, db: r > 0 ? 20 * Math.log10(r) : -120 });
  }
  return j;
}

const media = a => a.reduce((x, y) => x + y, 0) / a.length;

console.log('cortes com efeito:', comEfeito.length, '| cortes secos:', semEfeito.length, '\n');

lista.forEach(vol => {
  const entradas = ['-i', path.join(TMP, 'base.mp4')];
  const filtros = [];
  comEfeito.forEach((c, i) => {
    const nome = c.sobe ? regra.arquivo_in : regra.arquivo_out;
    const ant = c.sobe ? regra.antecipacao_in_s : regra.antecipacao_out_s;
    const ms = Math.round(Math.max(0, c.t - ant) * 1000);
    entradas.push('-i', path.join(DIR, 'sfx', nome));
    filtros.push(`[${i + 1}:a]adelay=${ms}|${ms},volume=${vol}[s${i}]`);
  });
  const mix = ['[0:a]'].concat(comEfeito.map((_, i) => `[s${i}]`)).join('');
  filtros.push(`${mix}amix=inputs=${comEfeito.length + 1}:duration=first:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[aout]`);

  const wav = path.join(TMP, `cal-${vol}.wav`);
  execFileSync(vt.FFMPEG, entradas.concat([
    '-filter_complex', filtros.join(';'), '-map', '[aout]',
    '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', '-y', wav
  ]), { maxBuffer: 32 * 1024 * 1024 });

  const j = energia(wav);
  const pico = t => {
    const janela = j.filter(x => Math.abs(x.t - t) <= 0.30);
    return janela.length ? Math.max(...janela.map(x => x.db)) : -120;
  };
  const cw = media(comEfeito.map(c => pico(c.t)));
  const sw = media(semEfeito.map(c => pico(c.t)));
  console.log(`volume ${String(vol).padEnd(5)} -> efeito soma ${(cw - sw).toFixed(1)} dB acima dos cortes secos`);
});

console.log('\nreferência: 3 a 6 dB marca o corte sem cobrir a voz');
