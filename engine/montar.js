/**
 * montar-final.js - Monta o reel finalizado.
 *
 * Etapas:
 *   1. corta cada segmento do bruto 4K já com a escala de plano (crop + scale)
 *   2. concatena
 *   3. queima a legenda ASS
 *   4. compõe cartela, pílulas e card de prova
 *   5. mistura os whooshes nos cortes onde a escala muda
 *
 * A escala é estática por segmento e muda no corte, como nas peças de
 * referência. Push contínuo exigiria zoompan, que treme em movimento lento.
 *
 * Uso: node montar-final.js [saida.mp4]
 */
const { execFile } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');

const execFileAsync = promisify(execFile);

const ctx = require('./contexto').abrir();
const vt = ctx.vt;
const DIR = ctx.dir;
// acervo compartilhado da marca, para efeito sonoro que não é exclusivo da peça
const RAIZ_ASSETS = path.resolve(__dirname, 'assets');
const plano = ctx.lerJson('decupagem.json');
const visual = ctx.lerJson('plano-visual.json');
const argm = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const saida = path.resolve(argm('--out', ctx.caminho('final.mp4')));

const W = 1080, H = 1920;
// O bruto nem sempre e 4K vertical: depoimento gravado no celular sai em
// 1080x1920, e recortar como se fosse 2160x3840 pede pixel que nao existe.
// A resolucao ja vem medida (com rotacao aplicada) por preparar.js.
const brutoCfg = (ctx.lerJson('decupagem-config.json', false) || {}).bruto || {};
const [BRUTO_W, BRUTO_H] = String(brutoCfg.resolucao || '2160x3840').split('x').map(Number);
const PARTES = path.join(DIR, 'partes-final');
const TMP = path.join(DIR, 'tmp');

[PARTES, TMP].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

const par = n => { const v = Math.round(n); return v % 2 ? v + 1 : v; };

// Grade de quadros da entrega. Corte fora dela deixa vídeo e áudio com durações
// diferentes na mesma parte, e o erro se soma a cada emenda.
const FRAME = 1001 / 30000;
const quantizar = t => Math.round(t / FRAME) * FRAME;

/**
 * Retângulo de recorte para uma escala, ancorado nos olhos
 */
function recorte(zoom) {
  const cw = Math.min(BRUTO_W, par(BRUTO_W / zoom));
  const ch = Math.min(BRUTO_H, par(BRUTO_H / zoom));
  const cx = par((BRUTO_W - cw) / 2);
  const olhosBruto = visual.olhos_y_bruto_pct * BRUTO_H;
  let cy = par(olhosBruto - visual.olhos_y_alvo_pct * ch);
  cy = Math.max(0, Math.min(BRUTO_H - ch, cy));
  return { cw, ch, cx, cy };
}

async function cortarSegmento(s) {
  const cfg = visual.zoom_por_segmento[String(s.id)] || { de: 1.0 };
  const zoom = cfg.de;
  const zAte = cfg.ate !== undefined ? cfg.ate : cfg.de;
  const movimento = Math.abs(zAte - zoom) > 0.001;
  const { cw, ch, cx, cy } = recorte(zoom);
  const out = path.join(PARTES, `seg-${String(s.id).padStart(2, '0')}.mp4`);

  let vf = `crop=${cw}:${ch}:${cx}:${cy},scale=${W}:${H}:flags=lanczos,setsar=1,fps=30000/1001`;

  // "ate" liga o movimento continuo: a escala caminha de "de" ate "ate" ao longo
  // do segmento em vez de ficar parada. O playbook (§4) desaconselha push
  // continuo porque zoompan treme em movimento lento, e o tremor vem de x e y
  // serem inteiros. Por isso o quadro entra no zoompan em dobro e sai reduzido:
  // o passo de um pixel la vira meio pixel na entrega, que o lanczos dissolve.
  if (movimento) {
    const n = Math.max(1, Math.round((s.ate - s.de) * 30000 / 1001));
    const z = `${zoom.toFixed(4)}+(${(zAte - zoom).toFixed(4)})*min(on/${n}\,1)`;
    const oy = `ih*${visual.olhos_y_bruto_pct}-${visual.olhos_y_alvo_pct}*ih/zoom`;
    vf = [
      'fps=30000/1001',
      `scale=${BRUTO_W * 2}:${BRUTO_H * 2}:flags=lanczos`,
      `zoompan=z='${z}':x='iw/2-(iw/zoom/2)':y='max(0\,min(ih-ih/zoom\,${oy}))'` +
        `:d=1:s=${W}x${H}:fps=30000/1001`,
      'setsar=1',
    ].join(',');
  }

  // Corte na grade de quadros. Pedir um corte no meio de um quadro faz o vídeo
  // sair com duração arredondada e o áudio com a duração exata, e a diferença
  // se acumula emenda a emenda até virar descompasso de lábio.
  const de = quantizar(s.de);
  const dur = Math.max(FRAME, quantizar(s.ate - s.de));

  const base = [
    '-ss', de.toFixed(4), '-i', plano.fonte, '-t', dur.toFixed(4),
    '-vf', vf,
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
    '-video_track_timescale', '30000', '-movflags', '+faststart', '-y', out
  ];
  const gpu = ['-c:v', 'h264_nvenc', '-preset', 'p6', '-rc', 'vbr', '-cq', '22', '-b:v', '0',
    '-multipass', 'fullres', '-spatial-aq', '1', '-pix_fmt', 'yuv420p'];
  const cpu = ['-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p'];
  const montar = v => base.slice(0, 6).concat(v, base.slice(6));

  try {
    await execFileAsync(vt.FFMPEG, montar(gpu), { timeout: 600000, maxBuffer: 16 * 1024 * 1024 });
  } catch (e) {
    await execFileAsync(vt.FFMPEG, montar(cpu), { timeout: 600000, maxBuffer: 16 * 1024 * 1024 });
  }

  // O áudio sai também em PCM, cortado do bruto com o mesmo par (início, duração).
  // É esse que vira a trilha da base; o AAC de dentro do .mp4 serve só para quem
  // for ouvir a parte isolada. Ver o comentário da concatenação.
  //
  // A duração pedida não é a que sai: o vídeo termina no quadro seguinte ao corte
  // e fica alguns milissegundos mais longo que o áudio. Com bruto a 60 fps e
  // entrega a 29,97, isso deu 8 ms por parte nos depoimentos de agosto/2026, e as
  // 8 partes somaram 68 ms de áudio adiantado no fim. Por isso o corte de áudio
  // usa a duração medida do vídeo, com apad cobrindo a diferença em silêncio: o
  // que se ouve a mais é meio quadro de sala, e o lábio fica no lugar.
  const durV = await duracao(out);
  const wav = path.join(PARTES, `seg-${String(s.id).padStart(2, '0')}.wav`);
  const fade = 0.012;
  await execFileAsync(vt.FFMPEG, [
    '-ss', de.toFixed(4), '-i', plano.fonte, '-t', durV.toFixed(4), '-vn',
    '-af', `afade=t=in:st=0:d=${fade},afade=t=out:st=${(durV - fade).toFixed(4)}:d=${fade},apad`,
    '-t', durV.toFixed(4),
    '-c:a', 'pcm_s16le', '-ar', '48000', '-ac', '2', '-y', wav
  ], { timeout: 600000, maxBuffer: 16 * 1024 * 1024 });

  return { arquivo: out, wav, zoom, zoomFim: zAte };
}

async function duracao(f) {
  const info = await vt.probe(f);
  return parseFloat(info.format.duration);
}

/**
 * Segundo passo do loudnorm, sobre o arquivo já montado.
 *
 * O loudnorm de uma passada só mede enquanto processa e sempre para antes do
 * alvo: medido no C7185, pediu -14 LUFS e entregou -16,9, quase 3 dB abaixo do
 * que o feed toca. O segundo passo mede o arquivo inteiro primeiro e devolve os
 * valores medidos para o filtro, que aí acerta.
 *
 * Só o áudio é refeito: o vídeo passa em cópia, sem recompressão.
 */
async function corrigirLoudness(arquivo, alvo = -14, tolerancia = 0.7) {
  const medir = ['-i', arquivo, '-af', `loudnorm=I=${alvo}:TP=-1.5:LRA=11:print_format=json`, '-f', 'null', '-'];
  let medida;
  try {
    const { stderr } = await execFileAsync(vt.FFMPEG, medir, { timeout: 600000, maxBuffer: 32 * 1024 * 1024 });
    const bloco = stderr.slice(stderr.lastIndexOf('{'));
    medida = JSON.parse(bloco.slice(0, bloco.indexOf('}') + 1));
  } catch (e) {
    console.warn('[final] não deu para medir o loudness; fica o passo único');
    return;
  }

  const atual = parseFloat(medida.input_i);
  if (!isFinite(atual) || Math.abs(atual - alvo) <= tolerancia) {
    console.log(`[final] loudness ${atual.toFixed(1)} LUFS, dentro da tolerância`);
    return;
  }

  const temp = arquivo.replace(/\.mp4$/, '.ln.mp4');
  const filtro = `loudnorm=I=${alvo}:TP=-1.5:LRA=11`
    + `:measured_I=${medida.input_i}:measured_TP=${medida.input_tp}`
    + `:measured_LRA=${medida.input_lra}:measured_thresh=${medida.input_thresh}`
    + `:offset=${medida.target_offset}:linear=true`;

  await execFileAsync(vt.FFMPEG, [
    '-i', arquivo, '-af', filtro, '-c:v', 'copy',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
    '-movflags', '+faststart', '-y', temp
  ], { timeout: 600000, maxBuffer: 32 * 1024 * 1024 });

  fs.renameSync(temp, arquivo);
  console.log(`[final] loudness corrigido em dois passos: ${atual.toFixed(1)} -> alvo ${alvo} LUFS`);
}

// A legenda tem que ser gerada a partir da base já cortada, senão os tempos
// não batem. Por isso o processo tem duas etapas: --base e --acabamento.
const ETAPA = process.argv.includes('--acabamento') ? 'acabamento'
  : process.argv.includes('--base') ? 'base' : 'tudo';

(async () => {
  const t0 = Date.now();
  const segs = plano.segmentos;

  const concatenado = path.join(TMP, 'base.mp4');
  const mapaPartes = path.join(TMP, 'partes.json');
  let partes = [];

  if (ETAPA !== 'acabamento') {
    // 1. Corta com escala de plano
    console.log(`[final] cortando ${segs.length} segmentos com escala de plano`);
    for (const s of segs) {
      const r = await cortarSegmento(s);
      partes.push({ ...r, id: s.id, papel: s.papel });
      process.stdout.write(`  seg ${String(s.id).padStart(2)} zoom ${r.zoom.toFixed(2)}\n`);
    }

    // 2. Posição de cada segmento na linha do tempo final
    let acc = 0;
    for (const p of partes) {
      p.inicio = acc;
      p.dur = await duracao(p.arquivo);
      acc += p.dur;
      p.fim = acc;
    }
    console.log(`[final] linha do tempo: ${acc.toFixed(2)}s`);

    // 3. Concatena. Vídeo em cópia, áudio a partir dos PCM.
    //
    // Colar as partes em AAC parece funcionar e não funciona: o codec trabalha em
    // quadros de 1024 amostras (21ms), então a trilha de cada parte nunca tem a
    // duração exata do vídeo dela, e a sobra se acumula. Medido no C7185 antes da
    // correção: 175ms no total, com o áudio já 120ms adiantado no segundo 47, que
    // é onde o descompasso de lábio começa a aparecer.
    const lista = path.join(PARTES, 'concat.txt');
    fs.writeFileSync(lista, partes.map(p => `file '${p.arquivo.replace(/\\/g, '/')}'`).join('\n'));

    const listaAudio = path.join(PARTES, 'concat-audio.txt');
    fs.writeFileSync(listaAudio, partes.map(p => `file '${p.wav.replace(/\\/g, '/')}'`).join('\n'));
    // Tratamento de voz, quando a captação pede. Entra aqui e não no acabamento
    // porque o ducking e o loudnorm precisam trabalhar sobre a voz já limpa; e
    // roda sobre a trilha inteira, não parte a parte, para o compressor não
    // recomeçar em cada emenda. A cadeia calibrada para celular sem lapela está
    // no playbook §8.0. Declare em plano-visual.json:
    //   "audio": "highpass=f=85,afftdn=nr=18:nf=-30,..."
    const audioBase = path.join(TMP, 'base.wav');
    const cadeiaVoz = visual.audio;
    await execFileAsync(vt.FFMPEG, ['-f', 'concat', '-safe', '0', '-i', listaAudio]
      .concat(cadeiaVoz ? ['-af', cadeiaVoz] : [])
      .concat(['-c:a', 'pcm_s16le', '-ar', '48000', '-ac', '2', '-y', audioBase]),
      { timeout: 600000, maxBuffer: 16 * 1024 * 1024 });
    if (cadeiaVoz) console.log(`[final] voz tratada antes do acabamento: ${cadeiaVoz}`);

    await execFileAsync(vt.FFMPEG, ['-f', 'concat', '-safe', '0', '-i', lista, '-i', audioBase,
      '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
      '-ar', '48000', '-ac', '2', '-movflags', '+faststart', '-y', concatenado],
      { timeout: 600000, maxBuffer: 16 * 1024 * 1024 });
    fs.writeFileSync(mapaPartes, JSON.stringify(partes, null, 2));

    const dv = await execFileAsync(vt.FFPROBE || 'ffprobe', ['-v', 'error', '-select_streams', 'v:0',
      '-show_entries', 'stream=duration', '-of', 'csv=p=0', concatenado]).then(r => parseFloat(r.stdout));
    const da = await execFileAsync(vt.FFPROBE || 'ffprobe', ['-v', 'error', '-select_streams', 'a:0',
      '-show_entries', 'stream=duration', '-of', 'csv=p=0', concatenado]).then(r => parseFloat(r.stdout));
    console.log(`[final] sincronia da base: vídeo ${dv.toFixed(3)}s, áudio ${da.toFixed(3)}s, diferença ${((da - dv) * 1000).toFixed(0)}ms`);

    if (ETAPA === 'base') {
      console.log(`\n[final] base pronta: ${concatenado}`);
      console.log('[final] agora transcreva a base, gere a legenda e rode com --acabamento');
      return;
    }
  } else {
    partes = JSON.parse(fs.readFileSync(mapaPartes, 'utf8'));
  }

  // 4. Legenda + overlays numa passada
  const ass = ctx.escapar(path.resolve(argm('--ass', ctx.caminho('legenda.ass'))));
  const fontsdir = ctx.escapar(ctx.fontes);

  const entradas = ['-i', concatenado];
  const filtros = [];

  // Legenda antes dos overlays: assim o card de prova, que é tela cheia, cobre
  // a legenda em vez de brigar com ela por espaço.
  filtros.push(`[0:v]ass='${ass}':fontsdir='${fontsdir}'[vleg]`);
  let cadeia = '[vleg]';

  const duracaoTotal = partes[partes.length - 1].fim;

  // Um overlay pode ser ancorado num segmento (pílulas, cartela) ou num tempo
  // absoluto (os números da prova, que precisam cair na palavra exata).
  const overlaysUsados = visual.overlays.map(o => {
    if (o.t_inicio !== undefined) {
      return { ...o, ini: o.t_inicio, fim: Math.min(o.t_fim, duracaoTotal - 0.02) };
    }
    const p = partes.find(x => x.id === o.segmento_inicio);
    if (!p) {
      console.warn(`  aviso: overlay ${o.arquivo} aponta para segmento ${o.segmento_inicio} inexistente`);
      return null;
    }
    const ini = p.inicio + 0.1;
    // não limita ao fim do segmento: uma frase partida pelo aperto de silêncio
    // vira dois segmentos, e a pílula precisa atravessar os dois
    return { ...o, ini, fim: Math.min(ini + o.duracao, duracaoTotal - 0.05) };
  }).filter(Boolean);

  overlaysUsados.forEach((o, i) => {
    const { ini, fim } = o;

    // -loop 1 é obrigatório: sem ele o PNG entra como um único frame em t=0,
    // o fade com st>0 zera o alpha desse frame e o overlay nunca aparece.
    entradas.push('-loop', '1', '-framerate', '30000/1001', '-t', fim.toFixed(2),
      '-i', path.join(DIR, 'overlays', o.arquivo));

    const idx = i + 1;
    const rotulo = `ov${idx}`;
    // overlay que vai até o fim do vídeo não some: um CTA que desaparece no
    // último instante deixa o quadro final sem chamada
    const ateOFim = fim >= duracaoTotal - 0.2;
    const saida = ateOFim ? '' : `,fade=t=out:st=${(fim - o.fade).toFixed(2)}:d=${o.fade}:alpha=1`;
    // sem_fade_in: overlay que já faz parte do primeiro frame não pode surgir
    const entrada = o.sem_fade_in ? '' : `,fade=t=in:st=${ini.toFixed(2)}:d=${o.fade}:alpha=1`;
    filtros.push(`[${idx}:v]format=rgba${entrada}${saida}[${rotulo}]`);

    // Entrada subindo: anima a camada inteira, que é transparente fora do bloco.
    // Evita ter que renderizar a animação quadro a quadro.
    const dur = Math.max(0.01, o.fade);
    const y = o.subir
      ? `'if(lt(t,${(ini + dur).toFixed(2)}), ${o.subir}*(1-(t-${ini.toFixed(2)})/${dur.toFixed(2)}), 0)'`
      : '0';

    const saidaRot = `v${idx}`;
    filtros.push(`${cadeia}[${rotulo}]overlay=0:${y}:enable='between(t,${ini.toFixed(2)},${fim.toFixed(2)})'[${saidaRot}]`);
    cadeia = `[${saidaRot}]`;
  });

  filtros.push(`${cadeia}null[vout]`);

  // 5. Whoosh nos cortes com mudança de escala.
  // Bloco opcional: as peças do editor não usam efeito de corte, e nesse caso
  // o plano simplesmente não declara "sfx".
  const regra = visual.sfx;
  const sfxEntradas = [];
  const sfxFiltros = [];
  let nSfx = 0;
  for (let i = 1; regra && i < partes.length; i++) {
    const anterior = partes[i - 1].zoomFim !== undefined ? partes[i - 1].zoomFim : partes[i - 1].zoom;
    const delta = partes[i].zoom - anterior;
    if (Math.abs(delta) < regra.delta_minimo) continue;
    const sobe = delta > 0;
    const nome = sobe ? (regra.arquivo_in || 'whoosh-in.wav') : (regra.arquivo_out || 'whoosh-out.wav');
    const arquivo = path.join(DIR, 'sfx', nome);
    // antecipa pelo pico do próprio arquivo, para o impacto cair no corte
    const antecipacao = sobe
      ? (regra.antecipacao_in_s !== undefined ? regra.antecipacao_in_s : 0.06)
      : (regra.antecipacao_out_s !== undefined ? regra.antecipacao_out_s : 0.06);
    const quando = Math.max(0, partes[i].inicio - antecipacao);
    const idx = entradas.filter(x => x === '-i').length + sfxEntradas.filter(x => x === '-i').length;
    sfxEntradas.push('-i', arquivo);
    sfxFiltros.push(`[${idx}:a]adelay=${Math.round(quando * 1000)}|${Math.round(quando * 1000)},volume=${regra.volume}[s${nSfx}]`);
    nSfx++;
  }

  // Efeito sonoro em tempo absoluto da peça, independente de corte de zoom.
  // O bloco `sfx` acima só dispara em mudança de escala; um clique que precisa
  // bater junto com a entrada de uma cartela não tem corte para se pendurar.
  //   "sfx_pontuais": [{ "arquivo": "clique.wav", "t": 1.62, "volume": 0.5 }]
  // O arquivo é procurado na pasta sfx/ da peça e, se não estiver lá, no acervo.
  for (const p of (visual.sfx_pontuais || [])) {
    let arquivo = path.join(DIR, 'sfx', p.arquivo);
    if (!fs.existsSync(arquivo)) arquivo = path.join(RAIZ_ASSETS, 'sfx', p.arquivo);
    if (!fs.existsSync(arquivo)) {
      console.warn(`  aviso: efeito ${p.arquivo} não encontrado, ignorado`);
      continue;
    }
    const idx = entradas.filter(x => x === '-i').length + sfxEntradas.filter(x => x === '-i').length;
    const ms = Math.max(0, Math.round(p.t * 1000));
    sfxEntradas.push('-i', arquivo);
    sfxFiltros.push(`[${idx}:a]adelay=${ms}|${ms},volume=${p.volume !== undefined ? p.volume : 0.5}[s${nSfx}]`);
    nSfx++;
  }
  if ((visual.sfx_pontuais || []).length) {
    console.log(`[final] ${visual.sfx_pontuais.length} efeito(s) em tempo absoluto`);
  }

  // Normalização de loudness: o lapela cru sai em torno de -26 LUFS e as redes
  // trabalham perto de -14. Sem isso o anúncio toca sensivelmente mais baixo
  // que o conteúdo ao redor no feed.
  //
  // Este é o primeiro passo, que mede em fluxo e por isso erra o alvo para
  // baixo. Quem fecha a conta é corrigirLoudness(), depois de o arquivo existir.
  const NORMALIZA = 'loudnorm=I=-14:TP=-1.5:LRA=11';

  // Voz e efeitos primeiro, música por cima com ducking
  const mixEntradas = ['[0:a]'].concat(Array.from({ length: nSfx }, (_, i) => `[s${i}]`)).join('');
  const cadeiaVoz = nSfx
    ? sfxFiltros.join(';') + `;${mixEntradas}amix=inputs=${nSfx + 1}:duration=first:normalize=0[vozmix]`
    : `[0:a]anull[vozmix]`;

  let filtroAudio;
  const mus = visual.musica;

  if (mus && fs.existsSync(path.join(DIR, 'musica', mus.arquivo))) {
    const idxMus = entradas.filter(x => x === '-i').length + sfxEntradas.filter(x => x === '-i').length;
    sfxEntradas.push('-i', path.join(DIR, 'musica', mus.arquivo));

    const d = mus.ducking || {};
    const fadeOutIni = Math.max(0, duracaoTotal - (mus.fade_out || 1.5));

    // Onde entrar na faixa. Toda trilha de banco tem intro rala: a batida cheia
    // só aparece depois de 10 a 15s, e começar em 0 dá abertura sem energia
    // justamente no gancho. `inicio` pula para o trecho já desenvolvido.
    const ini = mus.inicio || 0;
    if (ini) console.log(`[final] trilha entrando em ${ini}s da faixa`);

    filtroAudio = [
      cadeiaVoz,
      // a voz alimenta o sidechain e também vai para o mix, por isso é duplicada
      `[vozmix]asplit=2[vozmix1][vozchave]`,
      `[${idxMus}:a]atrim=${ini}:${(ini + duracaoTotal).toFixed(2)},asetpts=PTS-STARTPTS,aresample=48000,` +
        `volume=${mus.volume},` +
        `afade=t=in:st=0:d=${mus.fade_in || 0.5},` +
        `afade=t=out:st=${fadeOutIni.toFixed(2)}:d=${mus.fade_out || 1.5}[mus]`,
      `[mus][vozchave]sidechaincompress=threshold=${d.threshold || 0.04}:ratio=${d.ratio || 8}:` +
        `attack=${d.attack || 20}:release=${d.release || 350}:makeup=1[musduck]`,
      `[vozmix1][musduck]amix=inputs=2:duration=first:normalize=0,${NORMALIZA}[aout]`
    ].join(';');
  } else {
    filtroAudio = cadeiaVoz + `;[vozmix]${NORMALIZA}[aout]`;
    if (mus) console.warn(`  aviso: música ${mus.arquivo} não encontrada, seguindo sem trilha`);
  }

  console.log(`[final] ${overlaysUsados.length} overlays, ${nSfx} whooshes`);

  const filtroCompleto = filtros.join(';') + (filtroAudio ? ';' + filtroAudio : '');

  const args = entradas.concat(sfxEntradas, [
    '-filter_complex', filtroCompleto,
    '-map', '[vout]',
    '-map', filtroAudio ? '[aout]' : '0:a',
    '-c:v', 'h264_nvenc', '-preset', 'p6', '-rc', 'vbr', '-cq', '23', '-b:v', '0',
    '-multipass', 'fullres', '-spatial-aq', '1', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
    '-movflags', '+faststart', '-y', saida
  ]);

  try {
    await execFileAsync(vt.FFMPEG, args, { timeout: 1800000, maxBuffer: 32 * 1024 * 1024 });
  } catch (err) {
    console.warn('[final] NVENC falhou, refazendo em CPU');
    const i = args.indexOf('h264_nvenc');
    const cpuArgs = args.slice(0, i - 1).concat(
      ['-c:v', 'libx264', '-preset', 'medium', '-crf', '21', '-pix_fmt', 'yuv420p'],
      args.slice(args.indexOf('-c:a')));
    await execFileAsync(vt.FFMPEG, cpuArgs, { timeout: 1800000, maxBuffer: 32 * 1024 * 1024 });
  }

  // O alvo pode vir do plano da peça. O default -14 é o que as peças anteriores
  // usaram; as referências do editor medem -15,5.
  await corrigirLoudness(saida, (visual.audio && visual.audio.lufs) || -14);

  const info = await vt.probe(saida);
  console.log(`\n[final] pronto em ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`[final] ${saida}`);
  console.log(`[final] ${parseFloat(info.format.duration).toFixed(2)}s | ${info.streams[0].width}x${info.streams[0].height} | ${(fs.statSync(saida).size / 1048576).toFixed(1)} MB`);
})().catch(err => {
  console.error('[final] erro:', err.message.split('\n').slice(0, 5).join(' | '));
  process.exit(1);
});
