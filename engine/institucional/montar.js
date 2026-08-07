/**
 * institucional-montar.js - Monta um institucional de B-roll cortado na batida.
 *
 * Diferente do motor de reel, aqui nao ha fala pra ancorar o corte: quem define
 * o ponto de emenda e a grade da trilha, vinda de institucional-batidas.js.
 *
 * Uso: node .scripts/institucional-montar.js --dir <pastaDoVideo> [--base] [--final]
 *
 * Espera na pasta:
 *   plano.json      estrutura da peca (voce escreve)
 *   ../source/      brutos 4K verticais
 *
 * Formato do plano.json:
 * {
 *   "saida": "metta-institucional-01.mp4",
 *   "trilha": { "arquivo": "...mp3", "de": 8.7, "ganho": -14, "fadeOut": 2.0 },
 *   "cortes": [
 *     { "clipe": "C6898", "de": 1.6, "ate": 3.1, "zoom": 1.0, "transicao": "seco" }
 *   ],
 *   "cartelas": [
 *     { "de": 2.2, "ate": 5.0, "texto": "Bater meta e consequencia", "estilo": "display" }
 *   ]
 * }
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const LARGURA = 1080;
const ALTURA = 1920;
const FPS = 30;

const args = process.argv.slice(2);
const dir = args[args.indexOf('--dir') + 1];
const soBase = args.includes('--base');
const planoArq = args.indexOf('--plano') === -1 ? 'plano.json' : args[args.indexOf('--plano') + 1];
if (!dir || args.indexOf('--dir') === -1) {
  console.error('uso: node institucional-montar.js --dir <pasta> [--plano plano.json] [--base]');
  process.exit(1);
}

const RAIZ = path.resolve(__dirname, '..');
const FONTES = path.join(RAIZ, 'fonts');
const plano = JSON.parse(fs.readFileSync(path.join(dir, planoArq), 'utf8'));
const source = plano.source ? path.resolve(dir, plano.source) : path.join(dir, 'source');
const sufixo = planoArq.replace(/\.json$/, '');
const tmp = path.join(dir, 'tmp', sufixo);
const partes = path.join(dir, 'partes', sufixo);
fs.mkdirSync(tmp, { recursive: true });
fs.mkdirSync(partes, { recursive: true });

function ff(argumentos, rotulo) {
  try {
    execFileSync('ffmpeg', ['-hide_banner', '-v', 'error', ...argumentos], { stdio: ['ignore', 'ignore', 'pipe'] });
  } catch (e) {
    console.error(`falha em ${rotulo}: ${(e.stderr || '').toString().slice(0, 400)}`);
    throw e;
  }
}

function acharClipe(id) {
  for (const ext of ['.MP4', '.mp4', '.MOV', '.mov']) {
    const p = path.join(source, id + ext);
    if (fs.existsSync(p)) return p;
  }
  throw new Error(`clipe ${id} nao encontrado em ${source}`);
}

// --- 1. cada corte vira uma parte ja no formato final -----------------------
// O bruto e 2160x3840, entao o zoom e recorte, nao ampliacao: nao perde nitidez
// enquanto o fator ficar dentro de 2160/1080 = 2,0.
console.log(`montando ${plano.cortes.length} cortes`);
const lista = [];

// A 140 BPM e 30 fps uma batida da 12,857 quadros. Arredondar a duracao de cada
// parte por conta propria acumula erro e no fim da peca o corte sai da batida.
// Por isso a fronteira de cada plano e calculada em quadros absolutos sobre a
// linha do tempo: o erro nunca passa de meio quadro e nao se soma.
let tAcumulado = 0;
const fronteiras = [0];
for (const c of plano.cortes) {
  tAcumulado += c.ate - c.de;
  fronteiras.push(Math.round(tAcumulado * FPS));
}

plano.cortes.forEach((c, i) => {
  const arq = acharClipe(c.clipe);
  const quadros = fronteiras[i + 1] - fronteiras[i];
  const dur = +(quadros / FPS).toFixed(4);
  const saida = path.join(partes, `p${String(i).padStart(3, '0')}.mp4`);
  const zoom = c.zoom || 1.0;

  // recorte central com deslocamento opcional, depois escala pro formato final
  const larguraCorte = Math.round(2160 / zoom / 2) * 2;
  const alturaCorte = Math.round(3840 / zoom / 2) * 2;
  const desloqX = c.x ? Math.round((2160 - larguraCorte) * c.x) : Math.round((2160 - larguraCorte) / 2);
  const desloqY = c.y ? Math.round((3840 - alturaCorte) * c.y) : Math.round((3840 - alturaCorte) / 2);

  let vf = `crop=${larguraCorte}:${alturaCorte}:${desloqX}:${desloqY},scale=${LARGURA}:${ALTURA}:flags=lanczos,fps=${FPS},format=yuv420p`;

  // rampa de zoom dentro do plano, quando pedida, da vida a um plano parado
  if (c.zoomAte && c.zoomAte !== zoom) {
    const passo = (c.zoomAte - zoom) / (dur * FPS);
    vf = `scale=2160:3840,zoompan=z='min(zoom+${passo.toFixed(6)},${c.zoomAte})':d=${Math.round(dur * FPS)}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${LARGURA}x${ALTURA}:fps=${FPS},format=yuv420p`;
  }

  ff([
    // -frames:v em vez de -t: o alvo e contagem de quadros, nao tempo aproximado
    '-ss', String(c.de), '-i', arq, '-frames:v', String(quadros),
    '-vf', vf, '-an',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
    '-y', saida,
  ], `corte ${i} (${c.clipe})`);

  lista.push(saida);
  process.stdout.write(`\r  ${i + 1}/${plano.cortes.length}`);
});
console.log('');

// --- 2. emenda ---------------------------------------------------------------
const listaTxt = path.join(tmp, 'concat.txt');
// o concat resolve caminho relativo a partir do arquivo de lista, entao vai absoluto
fs.writeFileSync(listaTxt, lista.map((p) => `file '${path.resolve(p).replace(/\\/g, '/')}'`).join('\n'));
const base = path.join(tmp, 'base.mp4');
ff(['-f', 'concat', '-safe', '0', '-i', listaTxt, '-c', 'copy', '-y', base], 'emenda');

const durBase = Number(execFileSync('ffprobe', [
  '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', base,
]).toString().trim());
console.log(`base: ${durBase.toFixed(2)}s`);

if (soBase) { console.log(`base em ${base}`); process.exit(0); }

// --- 3. cartelas -------------------------------------------------------------
// Zalando Expanded e a fonte de display do design system. O libass e o drawtext
// nao acham fonte por nome no Windows, entao vai o caminho, com dois-pontos escapado.
function fonte(nome) {
  return path.join(FONTES, nome).replace(/\\/g, '/').replace(/:/g, '\\:');
}
const FONTE_DISPLAY = fonte('ZalandoSansExpanded-Black.ttf');
const FONTE_CORPO = fonte('Inter-ExtraBold.ttf');

let filtros = [];
(plano.cartelas || []).forEach((c) => {
  const linhas = c.texto.split('\n');
  const corpo = c.estilo === 'corpo';
  const tamanho = c.tamanho || (corpo ? 46 : 78);
  const entrelinha = Math.round(tamanho * (corpo ? 1.35 : 1.05));
  const alturaBloco = linhas.length * entrelinha;
  // ancora vertical em fracao da altura, default no centro-alto
  const topo = Math.round(ALTURA * (c.y != null ? c.y : 0.42) - alturaBloco / 2);
  const cor = c.cor || 'white';
  // aparece e some com fade curto, pra nao piscar no corte
  const fade = c.fade != null ? c.fade : 0.25;
  const alfa = `if(lt(t,${c.de}),0,if(lt(t,${c.de + fade}),(t-${c.de})/${fade},if(lt(t,${c.ate - fade}),1,if(lt(t,${c.ate}),(${c.ate}-t)/${fade},0))))`;

  linhas.forEach((linha, j) => {
    const texto = linha.replace(/[\\':]/g, (m) => '\\' + m);
    filtros.push(
      `drawtext=fontfile='${corpo ? FONTE_CORPO : FONTE_DISPLAY}':text='${texto}'` +
      `:fontsize=${tamanho}:fontcolor=${cor}:alpha='${alfa}'` +
      `:x=(w-text_w)/2:y=${topo + j * entrelinha}` +
      `:shadowcolor=black@0.45:shadowx=0:shadowy=3` +
      `:enable='between(t,${c.de},${c.ate})'`
    );
  });
});

// --- 4. marcas (logo e assinatura, sempre a partir do SVG oficial) ----------
const entradas = ['-i', base];
const cadeiasMarca = [];
let rotuloVideo = 'v0';   // a cadeia de texto sempre entrega v0, com ou sem cartela
(plano.marcas || []).forEach((m, i) => {
  const arq = path.isAbsolute(m.arquivo) ? m.arquivo : path.join(dir, m.arquivo);
  // -loop transforma o PNG num stream com duracao, que e o que o fade exige
  entradas.push('-loop', '1', '-t', String(durBase), '-i', arq);
  const idx = entradas.filter((e) => e === '-i').length - 1;
  const fade = m.fade != null ? m.fade : 0.4;
  const proximo = `vm${i}`;
  // o fade age no canal alfa do proprio PNG, porque o overlay nao aceita alfa variavel
  cadeiasMarca.push(
    `[${idx}:v]format=rgba,fade=t=in:st=${m.de}:d=${fade}:alpha=1,` +
    `fade=t=out:st=${(m.ate - fade).toFixed(3)}:d=${fade}:alpha=1,setpts=PTS-STARTPTS[m${i}]`,
    `[${rotuloVideo}][m${i}]overlay=x=${m.x != null ? m.x : '(W-w)/2'}:y=${m.y != null ? m.y : 'H*0.82'}` +
    `:enable='between(t,${m.de},${m.ate})'[${proximo}]`
  );
  rotuloVideo = proximo;
});

// --- 5. trilha ---------------------------------------------------------------
const t = plano.trilha || {};
let mapaAudio = [];
if (t.arquivo) {
  const trilha = path.isAbsolute(t.arquivo) ? t.arquivo : path.join(dir, 'musica', t.arquivo);
  entradas.push('-ss', String(t.de || 0), '-i', trilha);
  // as marcas entram como entrada antes da trilha, entao o indice se conta, nao se assume
  const idxTrilha = entradas.filter((e) => e === '-i').length - 1;
  const fadeOut = t.fadeOut != null ? t.fadeOut : 1.5;
  const fadeIn = t.fadeIn != null ? t.fadeIn : 0.4;
  mapaAudio = [
    `[${idxTrilha}:a]atrim=0:${durBase},afade=t=in:st=0:d=${fadeIn},` +
    `afade=t=out:st=${(durBase - fadeOut).toFixed(2)}:d=${fadeOut},` +
    `loudnorm=I=${t.ganho || -14}:TP=-1.5:LRA=11[a]`,
  ];
}

const cadeiaTexto = filtros.length ? `[0:v]${filtros.join(',')}[v0]` : `[0:v]null[v0]`;
// a ultima cadeia de marca renomeia pro rotulo que a saida espera
const cadeiaVideo = [cadeiaTexto, ...cadeiasMarca, `[${rotuloVideo === 'v0' ? 'v0' : rotuloVideo}]format=yuv420p[v]`];
const complexo = [...cadeiaVideo, ...mapaAudio].join(';');

const saidaFinal = path.isAbsolute(plano.saida) ? plano.saida : path.join(dir, plano.saida);
const mapas = ['-map', '[v]'];
if (mapaAudio.length) mapas.push('-map', '[a]');

ff([
  ...entradas,
  '-filter_complex', complexo,
  ...mapas,
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
  '-movflags', '+faststart',
  '-t', String(durBase),
  '-y', saidaFinal,
], 'acabamento');

const durFinal = Number(execFileSync('ffprobe', [
  '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', saidaFinal,
]).toString().trim());
const peso = (fs.statSync(saidaFinal).size / 1048576).toFixed(1);
console.log(`\n${path.basename(saidaFinal)}  ${durFinal.toFixed(2)}s  ${peso} MB  ${LARGURA}x${ALTURA} ${FPS}fps`);
