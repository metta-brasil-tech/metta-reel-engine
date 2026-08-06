/**
 * preparar-sfx-renan.js - Prepara os whooshes a partir do "Zoom Out.wav" do Renan.
 *
 * O pacote traz só o som de afastamento. O de aproximação sai do mesmo arquivo
 * invertido no tempo: a cauda longa vira rampa de subida e o impacto cai no fim,
 * que é exatamente a curva de um zoom in.
 *
 * Também converte para 48kHz (o projeto todo roda em 48k) e apara o silêncio
 * final, que só atrasaria o alinhamento.
 *
 * Uso: node preparar-sfx-renan.js
 */
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const ctx = require('./contexto').abrir();
const vt = ctx.vt;

const DIR = ctx.dir;
const args = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const ORIGEM = path.resolve(args('--fonte', path.join(DIR, 'sfx', 'origem.wav')));
const SAIDA = ctx.sub('sfx');

if (!fs.existsSync(ORIGEM)) {
  console.error('não encontrei o som de origem em', ORIGEM);
  process.exit(1);
}

// A energia acaba por volta de 0.85s; o resto é silêncio digital
const UTIL = 0.88;

const receitas = [
  {
    nome: 'zoom-out.wav',
    filtro: `atrim=0:${UTIL},asetpts=PTS-STARTPTS,aresample=48000`,
    descricao: 'afastamento: impacto na frente, cauda decaindo'
  },
  {
    nome: 'zoom-in.wav',
    filtro: `atrim=0:${UTIL},asetpts=PTS-STARTPTS,areverse,aresample=48000`,
    descricao: 'aproximação: rampa subindo até o impacto (mesmo som invertido)'
  }
];

receitas.forEach(r => {
  const destino = path.join(SAIDA, r.nome);
  execFileSync(vt.FFMPEG, [
    '-hide_banner', '-loglevel', 'error',
    '-i', ORIGEM,
    '-af', r.filtro,
    '-c:a', 'pcm_s16le', '-ar', '48000', '-ac', '2',
    '-y', destino
  ]);

  const saida = execFileSync(vt.FFMPEG, ['-hide_banner', '-i', destino, '-af', 'volumedetect', '-f', 'null', '-'],
    { stdio: ['ignore', 'pipe', 'pipe'] });
  console.log(`  ${r.nome}  ${r.descricao}`);
});

// Onde está o pico de cada um: serve para alinhar o impacto com o corte
['zoom-out.wav', 'zoom-in.wav'].forEach(nome => {
  const arq = path.join(SAIDA, nome);
  const raw = path.join(ctx.sub('tmp'), nome.replace('.wav', '.raw'));
  execFileSync(vt.FFMPEG, ['-hide_banner', '-loglevel', 'error', '-i', arq,
    '-ar', '16000', '-ac', '1', '-f', 's16le', '-y', raw]);
  const b = fs.readFileSync(raw);
  const janela = 800; // 50ms a 16kHz
  let melhor = 0, tPico = 0;
  for (let w = 0; (w + 1) * janela * 2 < b.length; w++) {
    let soma = 0;
    for (let i = 0; i < janela; i++) {
      const v = b.readInt16LE((w * janela + i) * 2) / 32768;
      soma += v * v;
    }
    const rms = Math.sqrt(soma / janela);
    if (rms > melhor) { melhor = rms; tPico = (w * janela) / 16000; }
  }
  console.log(`  ${nome}: pico de energia em ${tPico.toFixed(3)}s`);
});

console.log('\n[sfx] prontos em', SAIDA);
