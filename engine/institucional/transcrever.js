// Transcreve os clipes com fala (acima de um limiar de duracao) para achar as falas aproveitaveis.
// Uso: node .scripts/institucional-transcrever.js <pastaSource> <pastaSaida> [duracaoMinima]
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const [source, saida, minArg] = process.argv.slice(2);
const minimo = Number(minArg || 25);
fs.mkdirSync(saida, { recursive: true });

// mesma convencao do motor de reel: da pra apontar outra instalacao por variavel
const WHISPER_DIR = process.env.WHISPER_DIR || 'C:/whisper-cpp';
const WHISPER = path.join(WHISPER_DIR, 'main.exe');
const MODELO = path.join(WHISPER_DIR, 'ggml-medium.bin');

function duracao(arq) {
  return Number(execFileSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', arq,
  ]).toString().trim());
}

const clipes = fs.readdirSync(source).filter((f) => /\.mp4$/i.test(f)).sort();

for (const nome of clipes) {
  const arq = path.join(source, nome);
  const base = nome.replace(/\.mp4$/i, '');
  const dur = duracao(arq);
  if (dur < minimo) continue;
  if (fs.existsSync(path.join(saida, `${base}.json`))) { console.log(`${base} ja transcrito`); continue; }

  const wav = path.join(saida, `${base}_16k.wav`);
  execFileSync('ffmpeg', ['-i', arq, '-ar', '16000', '-ac', '1', '-y', wav], { stdio: 'ignore' });
  console.log(`${base}  ${dur.toFixed(1)}s  transcrevendo...`);
  execFileSync(WHISPER, [
    '-m', MODELO, '-l', 'pt', '-f', wav, '-oj', '-otxt', '-of', path.join(saida, base),
  ], { stdio: 'ignore' });
  fs.unlinkSync(wav);
  console.log(`${base} ok`);
}

console.log('concluido');
