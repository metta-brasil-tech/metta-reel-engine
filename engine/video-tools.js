/**
 * video-tools.js — Wrapper ffmpeg/ffprobe para pipeline de vídeo Metta
 *
 * Encapsula caminhos absolutos dos binários e expõe funções utilitárias.
 * Uso: const vt = require('./video-tools'); await vt.probe('video.mp4');
 */

const { execFile, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

/**
 * Resolve um binário na ordem: variável de ambiente, pacote npm instalado no
 * projeto, instalação npm global, e por fim o PATH do sistema. Assim o motor
 * roda em qualquer máquina sem editar caminho no código.
 */
function resolverBinario(nome, env, pacotes) {
  if (process.env[env] && fs.existsSync(process.env[env])) return process.env[env];

  for (const p of pacotes) {
    try {
      const achado = require.resolve(p);
      const dir = path.dirname(achado);
      const exe = process.platform === 'win32' ? `${nome}.exe` : nome;
      for (const tentativa of [
        path.join(dir, exe),
        path.join(dir, 'bin', exe),
        path.join(dir, 'bin', process.platform === 'win32' ? 'win32' : process.platform, 'x64', exe)
      ]) {
        if (fs.existsSync(tentativa)) return tentativa;
      }
      // alguns pacotes exportam o caminho direto
      const mod = require(p);
      if (typeof mod === 'string' && fs.existsSync(mod)) return mod;
      if (mod && typeof mod.path === 'string' && fs.existsSync(mod.path)) return mod.path;
    } catch (e) { /* pacote não instalado, tenta o próximo */ }
  }

  const globalNpm = path.join(process.env.APPDATA || '', 'npm/node_modules');
  for (const p of pacotes) {
    const exe = process.platform === 'win32' ? `${nome}.exe` : nome;
    for (const tentativa of [
      path.join(globalNpm, p, exe),
      path.join(globalNpm, p, 'bin', 'win32', 'x64', exe)
    ]) {
      if (fs.existsSync(tentativa)) return tentativa;
    }
  }

  return nome; // cai no PATH do sistema
}

const FFMPEG = resolverBinario('ffmpeg', 'FFMPEG_PATH', ['ffmpeg-static']);
const FFPROBE = resolverBinario('ffprobe', 'FFPROBE_PATH', ['ffprobe-static']);

// yt-dlp (instalado via winget), usado para baixar vídeo direto de URL
const YTDLP_WINGET = path.join(
  process.env.LOCALAPPDATA || '',
  'Microsoft/WinGet/Packages/yt-dlp.yt-dlp_Microsoft.Winget.Source_8wekyb3d8bbwe/yt-dlp.exe'
);

// Diretório da fonte Inter para legendas ASS
const FONTS_DIR = path.resolve(__dirname, '../output');
const SF_PRO_PATH = path.join(FONTS_DIR, 'fonts-legacy-removed-2026-05-27');

/* ------------------------------------------------------------------------ *
 * Encoder de vídeo: NVENC (GPU) quando disponível, libx264 (CPU) no resto
 *
 * Calibrado em 05/ago/2026 nesta máquina (GeForce GTX 1650), com clip real
 * de 1080x1920 a 30 fps e 20 s (video/clips/clip01-partA.mp4):
 *
 *   libx264 medium crf 23   19,7 s    7,7 MB   SSIM 0,9881
 *   h264_nvenc p6 cq 26      5,8 s   14,2 MB   SSIM 0,9899
 *
 * Ou seja: qualidade equivalente (SSIM levemente superior) em 1/3,4 do tempo,
 * com arquivo cerca de 1,8x maior. Para peça vertical de 30 a 60 s isso é
 * irrelevante no upload e libera a CPU da máquina.
 *
 * Forçar um modo: METTA_VIDEO_ENCODER=cpu|gpu|auto no ambiente,
 * ou { encoder: 'cpu' } na chamada da função.
 * ------------------------------------------------------------------------ */

const ENCODER_ENV = String(process.env.METTA_VIDEO_ENCODER || 'auto').toLowerCase();

// cq = crf + 3 é o ponto onde o NVENC empata com o libx264 em SSIM nesta GPU
const CQ_OFFSET = 3;

let nvencCache = null;
let lastEncoderUsed = null;

/**
 * Detecta se o ffmpeg em uso tem h264_nvenc (resultado fica em cache)
 */
async function hasNvenc() {
  if (nvencCache !== null) return nvencCache;
  try {
    const { stdout } = await execFileAsync(FFMPEG, ['-hide_banner', '-encoders'], {
      maxBuffer: 8 * 1024 * 1024
    });
    nvencCache = /\bh264_nvenc\b/.test(stdout);
  } catch (err) {
    nvencCache = false;
  }
  return nvencCache;
}

function cpuVideoArgs({ crf = 23, preset = 'medium' } = {}) {
  return ['-c:v', 'libx264', '-preset', preset, '-crf', String(crf), '-pix_fmt', 'yuv420p'];
}

function gpuVideoArgs({ crf = 23 } = {}) {
  return [
    '-c:v', 'h264_nvenc',
    '-preset', 'p6',
    '-rc', 'vbr',
    '-cq', String(crf + CQ_OFFSET),
    '-b:v', '0',
    '-multipass', 'fullres',
    '-spatial-aq', '1',
    '-pix_fmt', 'yuv420p'
  ];
}

/**
 * Resolve o modo de encode: 'gpu' ou 'cpu'
 */
async function resolveEncoderMode(requested) {
  const mode = String(requested || ENCODER_ENV || 'auto').toLowerCase();
  if (mode === 'cpu') return 'cpu';
  return (await hasNvenc()) ? 'gpu' : 'cpu';
}

/**
 * Flags de container: faststart deixa o mp4 pronto para streaming e upload
 */
function containerArgs(outputPath) {
  return /\.(mp4|mov|m4v)$/i.test(outputPath) ? ['-movflags', '+faststart'] : [];
}

/**
 * Executa um encode tentando GPU primeiro (quando disponível) e refazendo em
 * CPU se o NVENC falhar (acontece em notebook híbrido com a dGPU desligada).
 * buildArgs(videoArgs) devolve a linha de comando completa do ffmpeg.
 */
async function runEncode(buildArgs, outputPath, options = {}, timeout = 600000) {
  const mode = await resolveEncoderMode(options.encoder);
  const order = mode === 'gpu' ? ['gpu', 'cpu'] : ['cpu'];
  let lastErr;

  for (const attempt of order) {
    const videoArgs = attempt === 'gpu' ? gpuVideoArgs(options) : cpuVideoArgs(options);
    try {
      await execFileAsync(FFMPEG, buildArgs(videoArgs), {
        timeout,
        maxBuffer: 8 * 1024 * 1024
      });
      lastEncoderUsed = attempt;
      return outputPath;
    } catch (err) {
      lastErr = err;
      if (attempt === 'gpu') {
        console.warn(
          '[video-tools] NVENC falhou, refazendo em CPU:',
          String(err.message).split('\n')[0]
        );
        try {
          if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        } catch (cleanupErr) {
          // arquivo parcial não pôde ser removido, o -y do ffmpeg sobrescreve
        }
      }
    }
  }

  throw lastErr;
}

/**
 * Retorna qual encoder foi usado no último render ('gpu', 'cpu' ou null)
 */
function encoderUsed() {
  return lastEncoderUsed;
}

/**
 * Retorna metadata do vídeo via ffprobe (duração, resolução, fps, codec)
 */
async function probe(inputPath) {
  const { stdout } = await execFileAsync(FFPROBE, [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    inputPath
  ]);
  return JSON.parse(stdout);
}

/**
 * Extrai áudio do vídeo como WAV 16kHz mono (formato requerido pelo Whisper)
 */
async function extractAudio(inputPath, outputPath) {
  if (!outputPath) {
    outputPath = inputPath.replace(/\.[^.]+$/, '.wav');
  }
  await execFileAsync(FFMPEG, [
    '-i', inputPath,
    '-ar', '16000',
    '-ac', '1',
    '-c:a', 'pcm_s16le',
    '-y',
    outputPath
  ]);
  return outputPath;
}

/**
 * Baixa vídeo de URL (YouTube, Instagram, Vimeo, etc.) via yt-dlp
 *
 * @param {string} url - Link do vídeo
 * @param {string} outputDir - Pasta de destino (default: video/source)
 * @param {Object} options - { format, template, cookiesFromBrowser }
 * @returns {string} Caminho do arquivo baixado
 *
 * Conteúdo privado ou logado (Instagram, por exemplo) precisa de cookies:
 *   fetchFromUrl(url, null, { cookiesFromBrowser: 'chrome' })
 */
async function fetchFromUrl(url, outputDir, options = {}) {
  const {
    // prioriza H.264 em mp4, que é o que o resto do pipeline espera
    format = 'bv*[ext=mp4][vcodec^=avc1]+ba[ext=m4a]/bv*+ba/b',
    template = '%(title).60s [%(id)s].%(ext)s',
    cookiesFromBrowser = null
  } = options;

  const dir = path.resolve(outputDir || path.resolve(__dirname, '../video/source'));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const bin = fs.existsSync(YTDLP_WINGET) ? YTDLP_WINGET : 'yt-dlp';
  const args = [
    '-f', format,
    '--merge-output-format', 'mp4',
    '--no-playlist',
    '--no-simulate',
    '--print', 'after_move:filepath',
    '-o', path.join(dir, template),
    url
  ];
  if (cookiesFromBrowser) {
    args.push('--cookies-from-browser', cookiesFromBrowser);
  }

  const { stdout } = await execFileAsync(bin, args, {
    timeout: 1800000,
    maxBuffer: 16 * 1024 * 1024
  });

  const filePath = stdout.trim().split(/\r?\n/).filter(Boolean).pop();
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`yt-dlp não retornou um arquivo válido. Saída: ${stdout.trim()}`);
  }

  return filePath;
}

/**
 * Corta um trecho do vídeo (sem re-encode para velocidade, ou com re-encode para precisão)
 */
async function cut(inputPath, outputPath, startSec, endSec, options = {}) {
  const { reencode = true } = options;

  if (!reencode) {
    await execFileAsync(FFMPEG, [
      '-i', inputPath,
      '-ss', String(startSec),
      '-to', String(endSec),
      '-c', 'copy',
      ...containerArgs(outputPath),
      '-y', outputPath
    ], { timeout: 300000 });
    return outputPath;
  }

  return runEncode(
    videoArgs => [
      '-i', inputPath,
      '-ss', String(startSec),
      '-to', String(endSec),
      ...videoArgs,
      '-c:a', 'aac',
      ...containerArgs(outputPath),
      '-y', outputPath
    ],
    outputPath,
    options,
    300000
  );
}

/**
 * Detecta silêncios no áudio (pausas, respirações, momentos sem fala)
 * Retorna array de {start, end, duration}
 */
async function silenceDetect(inputPath, options = {}) {
  const { threshold = -30, minDuration = 0.5 } = options;

  const { stderr } = await execFileAsync(FFMPEG, [
    '-i', inputPath,
    '-af', `silencedetect=noise=${threshold}dB:d=${minDuration}`,
    '-f', 'null',
    '-'
  ], { timeout: 300000 });

  const silences = [];
  const startRegex = /silence_start: ([\d.]+)/g;
  const endRegex = /silence_end: ([\d.]+) \| silence_duration: ([\d.]+)/g;

  let starts = [];
  let match;
  while ((match = startRegex.exec(stderr))) {
    starts.push(parseFloat(match[1]));
  }

  let i = 0;
  while ((match = endRegex.exec(stderr))) {
    silences.push({
      start: starts[i] || 0,
      end: parseFloat(match[1]),
      duration: parseFloat(match[2])
    });
    i++;
  }

  return silences;
}

/**
 * Aplica legendas ASS no vídeo (burn subtitles)
 */
async function burnSubtitles(inputPath, assPath, outputPath, options = {}) {
  // Normalizar caminhos para ffmpeg no Windows (barras, dois-pontos)
  const normalizedAss = assPath.replace(/\\/g, '/').replace(/:/g, '\\:');
  const fontsDir = FONTS_DIR.replace(/\\/g, '/').replace(/:/g, '\\:');

  const vf = `ass='${normalizedAss}':fontsdir='${fontsDir}'`;

  return runEncode(
    videoArgs => [
      '-i', inputPath,
      '-vf', vf,
      ...videoArgs,
      '-c:a', 'aac',
      ...containerArgs(outputPath),
      '-y', outputPath
    ],
    outputPath,
    options,
    600000
  );
}

/**
 * Aplica overlay de imagem (watermark, lower third) no vídeo
 */
async function applyOverlay(inputPath, overlayPath, outputPath, options = {}) {
  const { x = 60, y = 60, opacity = 0.7, enableTime = null } = options;

  let overlayFilter = `[1:v]format=rgba,colorchannelmixer=aa=${opacity}[wm];[0:v][wm]overlay=${x}:${y}`;
  if (enableTime) {
    overlayFilter += `:enable='between(t,${enableTime.start},${enableTime.end})'`;
  }

  return runEncode(
    videoArgs => [
      '-i', inputPath,
      '-i', overlayPath,
      '-filter_complex', overlayFilter,
      ...videoArgs,
      '-c:a', 'aac',
      ...containerArgs(outputPath),
      '-y', outputPath
    ],
    outputPath,
    options,
    600000
  );
}

/**
 * Obtém duração do vídeo em segundos
 */
async function getDuration(inputPath) {
  const info = await probe(inputPath);
  return parseFloat(info.format.duration);
}

/**
 * Formata segundos em mm:ss ou hh:mm:ss
 */
function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

module.exports = {
  FFMPEG,
  FFPROBE,
  FONTS_DIR,
  SF_PRO_PATH,
  probe,
  extractAudio,
  fetchFromUrl,
  cut,
  silenceDetect,
  burnSubtitles,
  applyOverlay,
  getDuration,
  formatTime,
  hasNvenc,
  encoderUsed
};
