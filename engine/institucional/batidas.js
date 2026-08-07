/**
 * institucional-batidas.js - Acha a grade ritmica de uma trilha.
 *
 * O corte de um institucional de B-roll nao tem fala pra se apoiar, entao quem
 * manda no ponto de corte e a musica. Este script devolve onde estao as batidas,
 * o andamento e a grade de compasso, que e o que alimenta a decupagem.
 *
 * Metodo: energia por janela de ~11ms, fluxo positivo (onset), limiar adaptativo
 * pela mediana local, autocorrelacao do envelope pra estimar o andamento e
 * encaixe de uma grade regular no primeiro tempo que melhor explica os onsets.
 *
 * Uso: node .scripts/institucional-batidas.js <audio> [saida.json]
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const TAXA = 22050;
const JANELA = 256;           // ~11,6 ms por quadro
const QPS = TAXA / JANELA;    // quadros por segundo
const BPM_MIN = 70;
const BPM_MAX = 180;

const [entrada, saidaArg] = process.argv.slice(2);
if (!entrada) {
  console.error('uso: node institucional-batidas.js <audio> [saida.json]');
  process.exit(1);
}
const saida = saidaArg || entrada.replace(/\.[^.]+$/, '') + '-batidas.json';

// --- 1. audio cru em PCM 16 bits mono ---------------------------------------
const pcm = execFileSync('ffmpeg', [
  '-v', 'error', '-i', entrada,
  '-ac', '1', '-ar', String(TAXA), '-f', 's16le', '-',
], { maxBuffer: 512 * 1024 * 1024 });

const amostras = new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.length / 2));
const nQuadros = Math.floor(amostras.length / JANELA);
const duracao = amostras.length / TAXA;

// --- 2. envelope de energia --------------------------------------------------
const energia = new Float64Array(nQuadros);
for (let q = 0; q < nQuadros; q++) {
  let s = 0;
  const ini = q * JANELA;
  for (let i = 0; i < JANELA; i++) { const v = amostras[ini + i] / 32768; s += v * v; }
  energia[q] = Math.sqrt(s / JANELA);
}

// --- 3. fluxo positivo: so o que cresce vira candidato a batida --------------
const fluxo = new Float64Array(nQuadros);
for (let q = 1; q < nQuadros; q++) {
  const d = energia[q] - energia[q - 1];
  fluxo[q] = d > 0 ? d : 0;
}

// --- 4. onsets por limiar adaptativo ----------------------------------------
// limiar fixo perde a batida na parte baixa da musica e satura no refrao,
// entao o limiar acompanha a mediana de uma janela de ~0,5 s.
const RAIO = Math.round(QPS * 0.25);
const onsets = [];
const buf = [];
for (let q = 1; q < nQuadros - 1; q++) {
  const a = Math.max(0, q - RAIO);
  const b = Math.min(nQuadros - 1, q + RAIO);
  buf.length = 0;
  for (let i = a; i <= b; i++) buf.push(fluxo[i]);
  buf.sort((x, y) => x - y);
  const mediana = buf[Math.floor(buf.length / 2)];
  const limiar = mediana * 2.2 + 1e-5;
  if (fluxo[q] > limiar && fluxo[q] >= fluxo[q - 1] && fluxo[q] > fluxo[q + 1]) {
    onsets.push({ q, t: q / QPS, forca: fluxo[q] });
  }
}

// --- 5. andamento por autocorrelacao do fluxo -------------------------------
const lagMin = Math.round((60 / BPM_MAX) * QPS);
const lagMax = Math.round((60 / BPM_MIN) * QPS);
let melhorLag = lagMin;
let melhorPontos = -1;
for (let lag = lagMin; lag <= lagMax; lag++) {
  let s = 0;
  for (let q = 0; q + lag < nQuadros; q++) s += fluxo[q] * fluxo[q + lag];
  const pontos = s / (nQuadros - lag);
  if (pontos > melhorPontos) { melhorPontos = pontos; melhorLag = lag; }
}
const bpm = 60 / (melhorLag / QPS);

// --- 6. encaixa uma grade regular na fase que melhor explica os onsets -------
const periodo = melhorLag / QPS;
let melhorFase = 0;
let melhorSoma = -1;
const PASSOS = 100;
for (let p = 0; p < PASSOS; p++) {
  const fase = (p / PASSOS) * periodo;
  let soma = 0;
  for (const o of onsets) {
    const dist = Math.abs(((o.t - fase) % periodo + periodo) % periodo);
    const erro = Math.min(dist, periodo - dist);
    if (erro < periodo * 0.12) soma += o.forca * (1 - erro / (periodo * 0.12));
  }
  if (soma > melhorSoma) { melhorSoma = soma; melhorFase = fase; }
}

const batidas = [];
for (let t = melhorFase; t < duracao; t += periodo) batidas.push(+t.toFixed(3));

// --- 7. energia por compasso, pra saber onde a musica abre e onde recolhe ----
// util pra decidir onde entra a cartela e onde o corte pode acelerar.
const compassos = [];
for (let i = 0; i + 4 <= batidas.length; i += 4) {
  const ini = batidas[i];
  const fim = batidas[i + 4] || duracao;
  let s = 0, n = 0;
  for (let q = Math.round(ini * QPS); q < Math.round(fim * QPS) && q < nQuadros; q++) { s += energia[q]; n++; }
  compassos.push({ n: compassos.length + 1, inicio: +ini.toFixed(3), energia: n ? +(s / n).toFixed(5) : 0 });
}
const pico = Math.max(...compassos.map((c) => c.energia)) || 1;
compassos.forEach((c) => { c.rel = +(c.energia / pico).toFixed(3); });

const resultado = {
  arquivo: path.basename(entrada),
  duracao: +duracao.toFixed(2),
  bpm: +bpm.toFixed(1),
  periodo: +periodo.toFixed(4),
  primeiraBatida: +melhorFase.toFixed(3),
  onsetsDetectados: onsets.length,
  batidas,
  // grades de corte prontas: uma cena por 1, 2 ou 4 batidas
  cortes: {
    porBatida: batidas,
    por2: batidas.filter((_, i) => i % 2 === 0),
    por4: batidas.filter((_, i) => i % 4 === 0),
    por8: batidas.filter((_, i) => i % 8 === 0),
  },
  compassos,
};

fs.writeFileSync(saida, JSON.stringify(resultado, null, 2));
console.log(`${path.basename(entrada)}  ${duracao.toFixed(1)}s  ${bpm.toFixed(1)} BPM  ${batidas.length} batidas  primeira em ${melhorFase.toFixed(3)}s`);
console.log(`compasso de 4 tempos = ${(periodo * 4).toFixed(2)}s`);
const alto = compassos.filter((c) => c.rel > 0.85).map((c) => `${c.inicio.toFixed(1)}s`);
const baixo = compassos.filter((c) => c.rel < 0.5).map((c) => `${c.inicio.toFixed(1)}s`);
console.log(`compassos cheios: ${alto.slice(0, 12).join(', ') || 'nenhum'}`);
console.log(`compassos baixos: ${baixo.slice(0, 12).join(', ') || 'nenhum'}`);
console.log(`grade salva em ${saida}`);
