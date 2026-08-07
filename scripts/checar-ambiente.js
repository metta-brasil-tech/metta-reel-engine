/**
 * checar-ambiente.js - Diz o que falta pra rodar o motor nesta maquina.
 *
 * Roda antes de qualquer coisa: cada item aqui ja custou uma sessao de
 * depuracao pra alguem. Uso: node scripts/checar-ambiente.js
 */
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const RAIZ = path.resolve(__dirname, '..');
let faltando = 0;

function ok(msg) { console.log(`  ok    ${msg}`); }
function falta(msg, comoResolver) {
  console.log(`  FALTA ${msg}`);
  if (comoResolver) console.log(`        ${comoResolver}`);
  faltando++;
}
function aviso(msg, detalhe) {
  console.log(`  aviso ${msg}`);
  if (detalhe) console.log(`        ${detalhe}`);
}

function versao(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  if (r.error) return null;
  return ((r.stdout || '') + (r.stderr || '')).split('\n')[0].trim();
}

console.log('\nObrigatorio\n');

// Node
const nodeMaior = Number(process.versions.node.split('.')[0]);
if (nodeMaior >= 18) ok(`Node ${process.versions.node}`);
else falta(`Node ${process.versions.node} e antigo`, 'instale Node 18 ou mais novo: https://nodejs.org');

// ffmpeg e ffprobe
const vFfmpeg = versao('ffmpeg', ['-version']);
if (vFfmpeg) ok(vFfmpeg.slice(0, 60));
else falta('ffmpeg nao esta no PATH', 'baixe em https://www.gyan.dev/ffmpeg/builds/ e adicione a pasta bin ao PATH');

const vFfprobe = versao('ffprobe', ['-version']);
if (vFfprobe) ok(vFfprobe.slice(0, 60));
else falta('ffprobe nao esta no PATH', 'vem junto com o ffmpeg, confira se a pasta bin inteira foi adicionada');

// o build de Windows costuma vir sem alguns filtros que o motor usa
if (vFfmpeg) {
  const filtros = versao('ffmpeg', ['-hide_banner', '-filters']);
  const saidaFiltros = spawnSync('ffmpeg', ['-hide_banner', '-filters'], { encoding: 'utf8' });
  const txt = (saidaFiltros.stdout || '') + (saidaFiltros.stderr || '');
  for (const f of ['drawtext', 'zoompan', 'loudnorm', 'tile', 'overlay']) {
    if (txt.includes(` ${f} `)) ok(`filtro ${f}`);
    else falta(`filtro ${f} ausente no seu build de ffmpeg`, 'use um build "full" (gyan.dev full ou BtbN win64-gpl)');
  }
}

// fontes
const fontes = [
  'engine/fonts/Inter-Bold.ttf',
  'engine/fonts/ZalandoSansExpanded-Black.ttf',
  'engine/fonts/ZalandoSansExpanded-ExtraBold.ttf',
];
for (const f of fontes) {
  if (fs.existsSync(path.join(RAIZ, f))) ok(f);
  else falta(`fonte ${f} ausente`, 'ela vem no repositorio, confira se o clone veio completo');
}

// googleapis, so pra baixar do Drive
try {
  require.resolve('googleapis');
  ok('pacote googleapis');
} catch {
  falta('pacote googleapis', 'rode: npm install');
}

console.log('\nOpcional\n');

// whisper.cpp, so pra transcrever
const WHISPER_DIR = process.env.WHISPER_DIR || 'C:/whisper-cpp';
if (fs.existsSync(path.join(WHISPER_DIR, 'main.exe'))) {
  ok(`whisper.cpp em ${WHISPER_DIR}`);
  if (fs.existsSync(path.join(WHISPER_DIR, 'ggml-medium.bin'))) ok('modelo ggml-medium');
  else aviso('modelo ggml-medium ausente', 'baixe de https://huggingface.co/ggerganov/whisper.cpp');
} else {
  aviso(`whisper.cpp nao encontrado em ${WHISPER_DIR}`, 'so e preciso pra legenda e transcricao. Aponte outra pasta com a variavel WHISPER_DIR');
}

// credencial do Drive, so pra baixar bruto
if (fs.existsSync(path.join(RAIZ, 'google-service-account.json'))) {
  ok('credencial do Drive presente');
} else {
  aviso('google-service-account.json ausente', 'so e preciso pra baixar bruto do Drive pelos scripts. Veja o README');
}

console.log('');
if (faltando) {
  console.log(`${faltando} item(ns) obrigatorio(s) faltando. Resolva antes de rodar o motor.\n`);
  process.exit(1);
}
console.log('Ambiente pronto.\n');
