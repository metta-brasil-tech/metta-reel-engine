/**
 * preparar.js - Primeira etapa: lê o bruto, extrai o áudio e transcreve.
 *
 * Escreve na pasta de trabalho:
 *   decupagem-config.json   com os dados do bruto já preenchidos
 *   util.wav                áudio 16kHz mono do trecho aproveitável
 *   util_palavras.json      transcrição com timestamps por palavra
 *
 * O trecho aproveitável começa onde a fala do lapela começa de fato. Claquete e
 * voz de direção fora do microfone ficam bem abaixo do nível da fala, então a
 * primeira janela acima do limiar marca o início.
 *
 * Uso: node preparar.js --dir <pasta> --bruto <video.mp4> [--preset <nome>]
 */
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const ctx = require('./contexto').abrir();

const arg = (n, d) => {
  const i = process.argv.indexOf(n);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};

const BRUTO = arg('--bruto');
const PRESET = arg('--preset');
const WHISPER = process.env.WHISPER_DIR || 'C:/whisper-cpp';

// Limiar relativo ao nível da própria fala, não um valor fixo. Voz de direção
// fora do lapela também passa de um limiar absoluto, e o corte começaria na
// claquete: no C7179 isso apontava 6,3s em vez dos 18,0s corretos.
const ABAIXO_DO_PICO = 12;      // dB abaixo do nível típico da fala
const DURACAO_SUSTENTADA = 0.5; // segundos acima do limiar para valer como fala

if (!BRUTO || !fs.existsSync(BRUTO)) {
  console.error('informe o bruto com --bruto <arquivo>');
  process.exit(1);
}

// 1. metadados, já com a rotação aplicada
const info = JSON.parse(execFileSync(ctx.vt.FFPROBE,
  ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', BRUTO]).toString());
const v = info.streams.find(s => s.codec_type === 'video');
const rot = (v.side_data_list || []).map(x => x.rotation).find(x => x !== undefined) || 0;
const girado = Math.abs(rot) === 90 || Math.abs(rot) === 270;
const largura = girado ? v.height : v.width;
const altura = girado ? v.width : v.height;
const duracao = parseFloat(info.format.duration);

console.log(`bruto: ${largura}x${altura}, ${duracao.toFixed(2)}s, rotação ${rot}`);

// 2. áudio completo em 16kHz mono
const wavCheio = ctx.caminho('bruto16.wav');
execFileSync(ctx.vt.FFMPEG, ['-hide_banner', '-loglevel', 'error', '-i', BRUTO,
  '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', '-y', wavCheio]);

// 3. onde a fala do lapela começa
const b = fs.readFileSync(wavCheio);
let pos = 12, off = -1, len = 0, sr = 16000;
while (pos < b.length - 8) {
  const id = b.toString('ascii', pos, pos + 4);
  const sz = b.readUInt32LE(pos + 4);
  if (id === 'fmt ') sr = b.readUInt32LE(pos + 12);
  if (id === 'data') { off = pos + 8; len = sz; break; }
  pos += 8 + sz + (sz % 2);
}
const pj = Math.round(sr * 0.02);
const tot = Math.floor(len / 2);
let inicioFala = 0, fimFala = duracao;
const niveis = [];
for (let w = 0; w * pj < tot; w++) {
  let s = 0, n = 0;
  for (let i = 0; i < pj; i++) {
    const k = w * pj + i;
    if (k >= tot) break;
    const x = b.readInt16LE(off + k * 2) / 32768;
    s += x * x; n++;
  }
  if (!n) break;
  const r = Math.sqrt(s / n);
  niveis.push({ t: (w * pj) / sr, db: r > 0 ? 20 * Math.log10(r) : -120 });
}
// nível típico da fala: percentil 90 das janelas com algum som
const comSom = niveis.filter(x => x.db > -60).map(x => x.db).sort((a, b) => b - a);
const nivelFala = comSom.length ? comSom[Math.floor(comSom.length * 0.10)] : -20;
const limiar = nivelFala - ABAIXO_DO_PICO;

// Regiões acima do limiar, unidas quando o intervalo entre elas é curto, e só
// depois filtradas por duração. Sem a união, o fecho da fala (que sai mais
// baixo, entrecortado por pausas) não sustenta 0,5s seguidos e o fim do trecho
// aproveitável cai antes da hora.
const UNIR_ATE = 0.6;

const brutas = [];
let corrida = 0;
niveis.forEach((x, i) => {
  if (x.db > limiar) corrida++;
  else {
    if (corrida) brutas.push({ ini: niveis[i - corrida].t, fim: niveis[i - 1].t });
    corrida = 0;
  }
});
if (corrida) brutas.push({ ini: niveis[niveis.length - corrida].t, fim: niveis[niveis.length - 1].t });

const unidas = [];
brutas.forEach(r => {
  const ultima = unidas[unidas.length - 1];
  if (ultima && r.ini - ultima.fim <= UNIR_ATE) ultima.fim = r.fim;
  else unidas.push({ ...r });
});

const regioes = unidas.filter(r => r.fim - r.ini >= DURACAO_SUSTENTADA);

if (regioes.length) {
  inicioFala = Math.max(0, regioes[0].ini - 0.15);
  fimFala = Math.min(duracao, regioes[regioes.length - 1].fim + 0.4);
}

console.log(`nível típico da fala: ${nivelFala.toFixed(1)} dB, limiar em ${limiar.toFixed(1)} dB`);
console.log(`fala do lapela: ${inicioFala.toFixed(2)}s a ${fimFala.toFixed(2)}s`);

// 4. recorta o trecho aproveitável e transcreve
const util = ctx.caminho('util.wav');
execFileSync(ctx.vt.FFMPEG, ['-hide_banner', '-loglevel', 'error', '-i', wavCheio,
  '-ss', String(inicioFala), '-to', String(fimFala), '-c', 'copy', '-y', util]);

console.log('transcrevendo (alguns minutos)...');
execFileSync(path.join(WHISPER, 'main.exe'),
  ['-m', path.join(WHISPER, 'ggml-medium.bin'), '-l', 'pt', '-f', util,
    '-oj', '-of', ctx.caminho('util_palavras'), '-ml', '1'],
  { stdio: ['ignore', 'ignore', 'ignore'] });

// 5. configuração inicial, pronta para receber descartes e papéis
const base = ctx.lerJson('decupagem-config.json', false) || {};
const presetJson = PRESET ? path.join(ctx.presets, `${PRESET}.json`) : null;
const preset = presetJson && fs.existsSync(presetJson)
  ? JSON.parse(fs.readFileSync(presetJson, 'utf8')) : null;

ctx.gravarJson('decupagem-config.json', {
  fonte: BRUTO.replace(/\\/g, '/'),
  bruto: { duracao: +duracao.toFixed(2), resolucao: `${largura}x${altura}`, fps: +(eval(v.r_frame_rate)).toFixed(2), rotacao: rot },
  offset_transcricao: +inicioFala.toFixed(2),
  marca: base.marca || (preset && preset.marca) || 'Metta',
  formato: base.formato || 'Reels 1080x1920',
  motivo_cabeca: base.motivo_cabeca || 'cabeça: claquete e direção fora do lapela',
  descartes: base.descartes || [],
  papeis: base.papeis || (preset && preset.papeis) || []
});

console.log(`\npronto. offset da transcrição: ${inicioFala.toFixed(2)}s`);
console.log('próximo: revise decupagem-config.json (descartes e papéis) e rode decupar.js');
