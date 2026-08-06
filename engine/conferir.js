/**
 * conferir.js - Confere o resultado por medição, não por olhar.
 *
 * Cada frame que entra no contexto custa caro e continua custando: uma imagem
 * lida no começo de uma sessão é reenviada em toda chamada seguinte. Na edição
 * do C7182, três imagens viraram 2,3 milhões de tokens de cache.
 *
 * Estas checagens respondem em texto o que antes exigia abrir um frame:
 * o overlay entrou, a legenda está na altura certa, o amarelo da marca aparece,
 * a peça não tem quadro preto. Quando o julgamento visual for indispensável
 * (composição, expressão, enquadramento), use --folha, que gera um contact
 * sheet pequeno em vez de frames grandes.
 *
 * Uso:
 *   node conferir.js --dir <pasta> [--video final.mp4]
 *   node conferir.js --dir <pasta> --folha 1.5,12,25,40
 */
const { execFileSync, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const ctx = require('./contexto').abrir();

const arg = (n, d) => {
  const i = process.argv.indexOf(n);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};

const VIDEO = path.resolve(arg('--video', ctx.caminho('final.mp4')));
const TMP = ctx.sub('tmp');
const estilo = ctx.lerJson('estilo-reel.json', false);
const visual = ctx.lerJson('plano-visual.json', false);

if (!fs.existsSync(VIDEO)) {
  console.error('vídeo não encontrado:', VIDEO);
  process.exit(1);
}

/**
 * Lê um frame como matriz de pixels RGB, em resolução reduzida.
 * Reduzir aqui não perde nada: as checagens são de presença e posição,
 * não de nitidez.
 */
function frame(segundo, largura = 216) {
  const raw = path.join(TMP, 'conferir.raw');
  execFileSync(ctx.vt.FFMPEG, ['-hide_banner', '-loglevel', 'error',
    '-ss', String(segundo), '-i', VIDEO,
    '-frames:v', '1', '-vf', `scale=${largura}:-1`,
    '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-y', raw]);
  const b = fs.readFileSync(raw);
  const altura = Math.round(b.length / (largura * 3));
  return {
    largura, altura,
    px: (x, y) => {
      const i = (y * largura + x) * 3;
      return { r: b[i], g: b[i + 1], b: b[i + 2] };
    }
  };
}

const perto = (c, alvo, tol = 46) =>
  Math.abs(c.r - alvo.r) < tol && Math.abs(c.g - alvo.g) < tol && Math.abs(c.b - alvo.b) < tol;

const hexParaRgb = h => ({
  r: parseInt(h.slice(1, 3), 16),
  g: parseInt(h.slice(3, 5), 16),
  b: parseInt(h.slice(5, 7), 16)
});

let falhas = 0, avisos = 0;
const ok = m => console.log('  ok    ' + m);
const falha = m => { falhas++; console.log('  FALHA ' + m); };
const aviso = m => { avisos++; console.log('  aviso ' + m); };

// ---------- 1. o arquivo é entregável? ----------
const info = JSON.parse(execFileSync(ctx.vt.FFPROBE,
  ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', VIDEO]).toString());
const v = info.streams.find(s => s.codec_type === 'video');
const a = info.streams.find(s => s.codec_type === 'audio');
const dur = parseFloat(info.format.duration);

console.log('formato');
if (v.width === 1080 && v.height === 1920) ok('1080x1920');
else falha(`resolução ${v.width}x${v.height}, esperado 1080x1920`);
if (v.pix_fmt === 'yuv420p') ok('yuv420p'); else falha(`pix_fmt ${v.pix_fmt}`);
if (a && a.channels === 2 && a.sample_rate === '48000') ok('áudio 48kHz estéreo');
else aviso('áudio fora do padrão 48kHz estéreo');
ok(`${dur.toFixed(2)}s`);
if (dur > 60) aviso(`${dur.toFixed(0)}s é longo para ad; o alvo é 35 a 50s`);

// ---------- 2. loudness ----------
console.log('\náudio');
// o loudnorm imprime o resumo em stderr mesmo quando dá certo, então spawnSync
const ln = spawnSync(ctx.vt.FFMPEG,
  ['-hide_banner', '-i', VIDEO, '-af', 'loudnorm=print_format=summary', '-f', 'null', '-'],
  { maxBuffer: 8 * 1024 * 1024 }).stderr.toString();
const lufs = parseFloat((ln.match(/Input Integrated:\s*(-?[\d.]+)/) || [])[1]);
const peak = parseFloat((ln.match(/Input True Peak:\s*(-?[\d.]+)/) || [])[1]);
if (lufs >= -17 && lufs <= -13) ok(`${lufs} LUFS`);
else falha(`${lufs} LUFS, fora da faixa de -17 a -13`);
if (peak <= -1) ok(`pico ${peak} dBTP`); else falha(`pico ${peak} dBTP, risco de clipping`);

// ---------- 3. nenhum quadro preto ----------
console.log('\nimagem');
let pretos = 0;
for (let t = 0.3; t < dur; t += Math.max(1, dur / 12)) {
  const f = frame(t, 64);
  let soma = 0;
  for (let y = 0; y < f.altura; y += 4) for (let x = 0; x < f.largura; x += 4) {
    const c = f.px(x, y); soma += c.r + c.g + c.b;
  }
  const media = soma / ((f.altura / 4) * (f.largura / 4) * 3);
  if (media < 12) pretos++;
}
if (!pretos) ok('nenhum quadro preto'); else falha(`${pretos} amostra(s) de quadro preto`);

// ---------- 4. overlays entraram ----------
/**
 * Confere peça por peça, comparando o PNG com o que saiu no vídeo.
 *
 * Procurar amarelo na tela não serve: quase toda peça é amarela, então uma
 * some e outra no ar no mesmo instante cobre a falta. Aqui a checagem é
 * específica: amostra pixels opacos do PNG e confere se aquela cor está
 * naquela coordenada do frame. Peça branca, amarela ou foto, tanto faz.
 */
if (visual && visual.overlays && estilo) {
  console.log('\noverlays declarados');
  const DIR_OV = ctx.caminho('overlays');
  const ESC = 4;                       // 270x480 basta e é rápido
  const W = Math.round(estilo.canvas.w / ESC), H = Math.round(estilo.canvas.h / ESC);
  const arqPartes = ctx.caminho('tmp', 'partes.json');
  const partes = fs.existsSync(arqPartes)
    ? JSON.parse(fs.readFileSync(arqPartes, 'utf8')) : null;

  visual.overlays.forEach(o => {
    const png = path.join(DIR_OV, o.arquivo);
    if (!fs.existsSync(png)) { falha(`${o.arquivo} não foi gerado`); return; }

    let quando = o.t_inicio;
    if (quando === undefined && partes && o.segmento_inicio !== undefined) {
      const p = partes.find(x => x.id === o.segmento_inicio);
      if (p) quando = p.inicio + 0.1;
    }
    if (quando === undefined) { aviso(`${o.arquivo}: não consegui situar no tempo`); return; }

    // meio da janela, já passado o fade de entrada
    const fim = o.t_fim !== undefined ? o.t_fim : quando + (o.duracao || 2);
    const t = Math.min(dur - 0.1, quando + (fim - quando) / 2);

    const rgba = path.join(TMP, 'conf-ov.raw');
    execFileSync(ctx.vt.FFMPEG, ['-hide_banner', '-loglevel', 'error', '-i', png,
      '-vf', `scale=${W}:${H}`, '-pix_fmt', 'rgba', '-f', 'rawvideo', '-y', rgba]);
    const P = fs.readFileSync(rgba);

    const f = frame(t, W);
    let testados = 0, batem = 0;
    // passo 2 amostra o suficiente sem varrer a peça inteira
    for (let y = 0; y < Math.min(H, f.altura); y += 2) for (let x = 0; x < W; x += 2) {
      const i = (y * W + x) * 4;
      if (P[i + 3] < 250) continue;    // borda com alpha parcial: cor não é confiável
      testados++;
      if (perto(f.px(x, y), { r: P[i], g: P[i + 1], b: P[i + 2] })) batem++;
    }

    if (!testados) { aviso(`${o.arquivo}: PNG sem área opaca para conferir`); return; }
    const pct = (batem / testados) * 100;
    if (pct >= 55) ok(`${o.arquivo} em ${t.toFixed(1)}s (${pct.toFixed(0)}% dos pixels conferem)`);
    else falha(`${o.arquivo} não aparece em ${t.toFixed(1)}s (só ${pct.toFixed(0)}% confere)`);
  });
}

// ---------- 5. legenda na altura certa ----------
if (estilo && estilo.legenda) {
  console.log('\nlegenda');
  const alvoPct = estilo.legenda.y_centro_px / estilo.canvas.h;
  const ass = ctx.caminho('legenda.ass');
  if (!fs.existsSync(ass)) {
    aviso('sem legenda.ass para conferir');
  } else {
    // renderiza a legenda sozinha sobre preto e mede onde o texto caiu
    const escapar = p => p.replace(/\\/g, '/').replace(/:/g, '\\:');
    const png = path.join(TMP, 'conf-leg.png');
    const meio = dur / 2;
    execFileSync(ctx.vt.FFMPEG, ['-hide_banner', '-loglevel', 'error',
      '-f', 'lavfi', '-i', `color=black:s=${estilo.canvas.w}x${estilo.canvas.h}:r=30`,
      '-t', String(Math.ceil(dur)),
      '-vf', `ass='${escapar(ass)}':fontsdir='${escapar(ctx.fontes)}'`,
      '-ss', String(meio), '-frames:v', '1', '-y', png]);
    const raw = path.join(TMP, 'conf-leg.raw');
    execFileSync(ctx.vt.FFMPEG, ['-hide_banner', '-loglevel', 'error',
      '-i', png, '-vf', 'format=gray', '-f', 'rawvideo', '-y', raw]);
    const b = fs.readFileSync(raw);
    const W = estilo.canvas.w, H = estilo.canvas.h;
    let minY = H, maxY = 0, minX = W, maxX = 0, n = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (b[y * W + x] > 180) {
        n++;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
      }
    }
    if (!n) {
      aviso(`sem legenda no instante ${meio.toFixed(1)}s (pode ser janela suprimida)`);
    } else {
      const centro = (minY + maxY) / 2;
      const desvio = Math.abs(centro / H - alvoPct) * 100;
      if (desvio < 2) ok(`centro em ${centro.toFixed(0)}px (alvo ${estilo.legenda.y_centro_px})`);
      else falha(`centro em ${centro.toFixed(0)}px, alvo ${estilo.legenda.y_centro_px}`);

      // caixa do texto, não altura de maiúscula: descendente de "g" e "p" entram
      // na conta. Serve para pegar erro grosseiro, como o corpo 60 que rendeu
      // 30px onde o DNA pedia 44.
      const alt = maxY - minY;
      const faixa = String(estilo.legenda.altura_maiuscula_px || '41 a 46').match(/\d+/g).map(Number);
      if (alt >= faixa[0] - 4 && alt <= faixa[1] + 14) ok(`caixa de texto ${alt}px, compatível com o DNA`);
      else falha(`caixa de texto ${alt}px, incompatível com maiúscula de ${faixa[0]} a ${faixa[1]}`);

      const margem = Math.min(minX, W - maxX);
      if (margem > 60) ok(`margem lateral ${margem}px`);
      else falha(`margem lateral ${margem}px, muito perto da borda`);

      const limite = estilo.canvas.h - (estilo.safe_zone_reels?.bottom_px || 618);
      if (maxY <= limite) ok(`dentro da safe zone (fim em ${maxY}px, limite ${limite})`);
      else falha(`legenda passa da safe zone: ${maxY}px contra ${limite}`);
    }
  }
}

// ---------- contact sheet, só quando pedido ----------
const folha = arg('--folha');
if (folha) {
  const ts = folha.split(',').map(Number).filter(x => !isNaN(x));
  const arquivos = ts.map((t, i) => {
    const f = path.join(TMP, `folha-${i}.jpg`);
    execFileSync(ctx.vt.FFMPEG, ['-hide_banner', '-loglevel', 'error',
      '-ss', String(t), '-i', VIDEO, '-frames:v', '1',
      '-vf', 'scale=190:-1', '-q:v', '6', '-y', f]);
    return f;
  });
  const saida = ctx.caminho('conferir.jpg');
  execFileSync(ctx.vt.FFMPEG, ['-hide_banner', '-loglevel', 'error']
    .concat(arquivos.flatMap(f => ['-i', f]))
    .concat(['-filter_complex', `${arquivos.map((_, i) => `[${i}]`).join('')}hstack=${arquivos.length}`,
      '-q:v', '6', '-y', saida]));
  const kb = (fs.statSync(saida).size / 1024).toFixed(0);
  console.log(`\ncontact sheet: ${saida} (${arquivos.length} frames, ${kb} KB)`);
  // o custo de uma imagem no contexto é por área, não por byte: 190px em vez de
  // 340px é cerca de um terço do custo, e o sheet é relido em toda chamada
  console.log('  190px por frame: cerca de 1/3 do custo de contexto de um sheet a 340px');
}

console.log(falhas ? `\n${falhas} falha(s), ${avisos} aviso(s)` : `\ntudo certo${avisos ? `, ${avisos} aviso(s)` : ''}`);
process.exit(falhas ? 1 : 0);
