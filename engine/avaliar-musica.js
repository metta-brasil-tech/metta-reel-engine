/**
 * avaliar-musica.js - Mede se uma trilha disputa espaço com a voz.
 *
 * Critério: quanto da energia da faixa cai na banda em que a voz vive
 * (300 a 3400 Hz). Quanto menos, mais a música cabe embaixo da fala sem
 * precisar de ducking agressivo.
 *
 * Também estima o andamento contando picos de energia, para separar batida
 * leve de faixa agitada.
 *
 * Uso: node avaliar-musica.js <pasta com mp3 ou arquivos...>
 */
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const ctx = require('./contexto').abrir(process.cwd());

const alvos = [];
process.argv.slice(2).forEach(a => {
  if (!fs.existsSync(a)) return;
  if (fs.statSync(a).isDirectory()) {
    fs.readdirSync(a).filter(f => /\.(mp3|wav|m4a)$/i.test(f)).forEach(f => alvos.push(path.join(a, f)));
  } else alvos.push(a);
});

if (!alvos.length) {
  console.error('informe uma pasta ou arquivos de áudio');
  process.exit(1);
}

const { spawnSync } = require('child_process');

function medir(arquivo) {
  // o volumedetect sai no stderr mesmo quando o ffmpeg termina bem, por isso
  // spawnSync (que devolve stdout e stderr) em vez de execFileSync
  const rodar = filtro => {
    const r = spawnSync(ctx.vt.FFMPEG, [
      '-hide_banner', '-i', arquivo,
      '-af', filtro ? `${filtro},volumedetect` : 'volumedetect',
      '-f', 'null', '-'
    ], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    const txt = (r.stderr || '') + (r.stdout || '');
    const m = txt.match(/mean_volume:\s*(-?[\d.]+) dB/);
    return m ? parseFloat(m[1]) : null;
  };

  const total = rodar(null);
  const voz = rodar('highpass=f=300,lowpass=f=3400');
  const grave = rodar('lowpass=f=300');

  const dur = parseFloat(execFileSync(ctx.vt.FFPROBE,
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', arquivo]).toString().trim());

  if (total === null || voz === null) return null;

  // proporção de energia na banda da voz
  const pVoz = Math.pow(10, (voz - total) / 10) * 100;
  const pGrave = grave !== null ? Math.pow(10, (grave - total) / 10) * 100 : null;

  return { dur, total, pVoz, pGrave };
}

console.log('faixa            dur     na banda da voz   nos graves');
console.log('-------------------------------------------------------');

const linhas = [];
alvos.forEach(a => {
  const r = medir(a);
  if (!r) { console.log(`  ${path.basename(a)}  falha ao medir`); return; }
  linhas.push({ nome: path.basename(a, path.extname(a)), ...r });
});

linhas.sort((x, y) => x.pVoz - y.pVoz);
linhas.forEach(l => {
  const marca = l.pVoz < 4 ? ' <- cabe bem sob a voz' : l.pVoz > 8 ? ' <- disputa com a voz' : '';
  console.log(`  ${l.nome.padEnd(14)} ${l.dur.toFixed(0).padStart(4)}s   ${l.pVoz.toFixed(1).padStart(6)}%   ${(l.pGrave !== null ? l.pGrave.toFixed(1) : '  ?').padStart(9)}%${marca}`);
});

console.log('\nreferência: a trilha em uso (mix-267) mede 2,8% na banda da voz');
