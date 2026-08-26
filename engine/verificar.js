/**
 * verificar.js - Confere o corte montado contra a decupagem.
 *
 * Dois testes, os dois erros que de fato aconteceram na edição do C7179:
 *
 *   cortes   toda emenda tem que cair em silêncio, senão o corte comeu fala
 *   palavras nenhuma palavra da decupagem pode ter sumido, e nenhuma palavra
 *            de trecho descartado pode ter sobrado
 *
 * O segundo exige transcrever o resultado, o que leva alguns minutos. Rode com
 * --rapido para pular essa parte e conferir só os cortes.
 *
 * Verifica a BASE (tmp/base.mp4), não o vídeo final. No final a música preenche
 * os silêncios e todo corte parece ter caído em cima de som, o que dá falso
 * positivo em toda emenda.
 *
 * Uso: node verificar.js --dir <pasta> [--video base.mp4] [--rapido]
 */
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const ctx = require('./contexto').abrir();

const arg = (n, d) => {
  const i = process.argv.indexOf(n);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const RAPIDO = process.argv.includes('--rapido');
const VIDEO = path.resolve(arg('--video', ctx.caminho('tmp', 'base.mp4')));
const WHISPER = process.env.WHISPER_DIR || 'C:/whisper-cpp';

const plano = ctx.lerJson('decupagem.json');
const TMP = ctx.sub('tmp');

let falhas = 0;

function energia(wav, janelaMs = 25) {
  const b = fs.readFileSync(wav);
  let pos = 12, off = -1, len = 0, sr = 16000;
  while (pos < b.length - 8) {
    const id = b.toString('ascii', pos, pos + 4);
    const sz = b.readUInt32LE(pos + 4);
    if (id === 'fmt ') sr = b.readUInt32LE(pos + 12);
    if (id === 'data') { off = pos + 8; len = sz; break; }
    pos += 8 + sz + (sz % 2);
  }
  const pj = Math.round((sr * janelaMs) / 1000);
  const tot = Math.floor(len / 2);
  const j = [];
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

// ---------- teste 1: cortes em silêncio ----------
function checarCortes(wav) {
  const partesDir = ctx.caminho('partes-final');
  if (!fs.existsSync(partesDir)) {
    console.log('  (sem partes-final, pulando checagem de emenda)');
    return;
  }
  const arquivos = fs.readdirSync(partesDir).filter(f => /^seg-\d+\.mp4$/.test(f)).sort();
  let acc = 0;
  const bordas = [];
  arquivos.forEach((f, i) => {
    const d = parseFloat(execFileSync(ctx.vt.FFPROBE,
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0',
        path.join(partesDir, f)]).toString().trim());
    acc += d;
    if (i < arquivos.length - 1) bordas.push(acc);
  });

  const j = energia(wav);
  console.log(`\ncortes: ${bordas.length} emendas`);
  bordas.forEach((t, i) => {
    const janela = j.filter(x => Math.abs(x.t - t) <= 0.25);
    const vale = janela.length ? Math.min(...janela.map(x => x.db)) : 0;
    const ok = vale < -40;
    if (!ok) { falhas++; console.log(`  FALHA emenda ${i + 1} em ${t.toFixed(2)}s: vale ${vale.toFixed(1)} dB, não há silêncio no ponto`); }
  });
  if (!falhas) console.log('  todas caem em silêncio');
}

// ---------- teste 2: integridade do texto ----------
function normalizar(s) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function checarPalavras(wav) {
  const saidaTr = path.join(TMP, 'verificacao');
  execFileSync(path.join(WHISPER, 'main.exe'),
    ['-m', path.join(WHISPER, 'ggml-medium.bin'), '-l', 'pt', '-f', wav, '-oj', '-of', saidaTr],
    { stdio: ['ignore', 'ignore', 'ignore'] });

  const j = JSON.parse(fs.readFileSync(saidaTr + '.json', 'utf8'));
  const obtido = normalizar((j.transcription || []).map(s => s.text).join(' '));
  // Quando o aperto de silencio parte uma frase em varios pedacos, todos os
  // pedacos herdam o texto inteiro dela. Somar isso conta a mesma frase varias
  // vezes: no depoimento-01, que o whisper pontuou como uma frase so, o esperado
  // saia com 1.760 palavras para uma peca de 220. Texto repetido em segmentos
  // vizinhos entra uma vez.
  const textos = [];
  plano.segmentos.forEach(s => { if (s.texto !== textos[textos.length - 1]) textos.push(s.texto); });
  const esperado = normalizar(textos.join(' '));

  const pEsperado = esperado.split(' ').filter(Boolean);
  const pObtido = new Set(obtido.split(' ').filter(Boolean));

  // palavras da decupagem que sumiram do resultado
  const sumidas = pEsperado.filter(p => p.length > 3 && !pObtido.has(p));

  // palavras exclusivas dos trechos descartados que voltaram
  const descartado = normalizar((plano.descartes || []).map(d => d.texto || '').join(' '));
  const soNoDescarte = descartado.split(' ')
    .filter(p => p.length > 4 && !esperado.includes(p));
  const vazadas = soNoDescarte.filter(p => pObtido.has(p));

  // Palavra isolada some por variação do whisper entre execuções, não por corte
  // errado ("sabe a mais" vira "Saiba mais" na segunda passada). O que denuncia
  // corte comendo fala é perder palavras SEGUIDAS.
  let maiorSequencia = 0, atual = 0;
  pEsperado.forEach(p => {
    if (p.length > 3 && !pObtido.has(p)) { atual++; maiorSequencia = Math.max(maiorSequencia, atual); }
    else atual = 0;
  });

  console.log(`\npalavras: ${pEsperado.length} esperadas`);
  if (maiorSequencia >= 2 || sumidas.length >= 4) {
    falhas++;
    console.log(`  FALHA ${sumidas.length} sumiram (maior sequência: ${maiorSequencia}): ${[...new Set(sumidas)].slice(0, 12).join(', ')}`);
  } else if (sumidas.length) {
    console.log(`  aviso: ${sumidas.length} palavra(s) isolada(s) divergem, provável variação de transcrição: ${[...new Set(sumidas)].join(', ')}`);
  } else {
    console.log('  nenhuma palavra perdida');
  }
  if (vazadas.length) {
    falhas++;
    console.log(`  FALHA resíduo de trecho descartado: ${[...new Set(vazadas)].join(', ')}`);
  } else if (soNoDescarte.length) {
    console.log('  nenhum resíduo dos descartes');
  }
}

// ---------- execução ----------
if (!fs.existsSync(VIDEO)) {
  console.error('vídeo não encontrado:', VIDEO);
  process.exit(1);
}

const wav = path.join(TMP, 'verificar.wav');
execFileSync(ctx.vt.FFMPEG, ['-hide_banner', '-loglevel', 'error', '-i', VIDEO,
  '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', '-y', wav]);

console.log('verificando', path.basename(VIDEO));
checarCortes(wav);
if (!RAPIDO) checarPalavras(wav);
else console.log('\npalavras: pulado (--rapido)');

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
