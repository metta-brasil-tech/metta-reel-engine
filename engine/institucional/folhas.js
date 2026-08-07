// Gera uma folha de contato por clipe, para curadoria visual em lote.
// Uso: node .scripts/institucional-folhas.js <pastaSource> <pastaSaida>
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const [source, saida] = process.argv.slice(2);
if (!source || !saida) {
  console.error('uso: node institucional-folhas.js <source> <saida>');
  process.exit(1);
}
fs.mkdirSync(saida, { recursive: true });

function duracao(arq) {
  const out = execFileSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', arq,
  ]).toString().trim();
  return Number(out);
}

// libass e drawtext nao acham fonte padrao no Windows, entao aponta a do projeto.
// No filtro, os dois-pontos do caminho tem que ser escapados.
const FONTE = path.resolve(__dirname, '..', 'fonts/Inter-Bold.ttf')
  .replace(/\\/g, '/')
  .replace(/:/g, '\\:');

const clipes = fs.readdirSync(source).filter((f) => /\.mp4$/i.test(f)).sort();
const indice = [];

for (const nome of clipes) {
  const arq = path.join(source, nome);
  const base = nome.replace(/\.mp4$/i, '');
  const alvo = path.join(saida, `${base}.jpg`);
  // mesmo pulando a folha, a duracao vai pro indice: e dela que a decupagem
  // depende pra saber se um corte cabe no clipe
  if (fs.existsSync(alvo)) {
    indice.push({ nome: base, folha: `${base}.jpg`, duracao: +duracao(arq).toFixed(1), pulado: true });
    continue;
  }

  const dur = duracao(arq);
  // 6 frames para clipe curto, ate 12 para clipe longo
  const n = dur <= 20 ? 6 : Math.min(12, Math.round(dur / 15) + 4);
  const cols = 6;
  const linhas = Math.ceil(n / cols);
  const passo = dur / (n + 1);
  const marcas = Array.from({ length: n }, (_, i) => +(passo * (i + 1)).toFixed(2));

  // extrai os frames com carimbo de tempo, depois empilha em grade
  const tmp = path.join(saida, `_tmp_${base}`);
  fs.mkdirSync(tmp, { recursive: true });
  marcas.forEach((t, i) => {
    execFileSync('ffmpeg', [
      '-ss', String(t), '-i', arq, '-frames:v', '1',
      '-vf', `scale=270:-1,drawtext=fontfile='${FONTE}':text='${t.toFixed(1)}s':x=6:y=6:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=4`,
      '-q:v', '4', '-y', path.join(tmp, `f${String(i).padStart(2, '0')}.jpg`),
    ], { stdio: 'ignore' });
  });

  // o build de Windows do ffmpeg nao tem pattern_type glob, entao usa sequencia numerada
  execFileSync('ffmpeg', [
    '-start_number', '0', '-i', path.join(tmp, 'f%02d.jpg').replace(/\\/g, '/'),
    '-filter_complex', `tile=${cols}x${linhas}:padding=4:color=0x111111`,
    '-q:v', '4', '-y', alvo,
  ], { stdio: 'ignore' });

  fs.rmSync(tmp, { recursive: true, force: true });
  indice.push({ nome: base, folha: `${base}.jpg`, duracao: +dur.toFixed(1), frames: marcas });
  console.log(`${base}  ${dur.toFixed(1)}s  ${n} frames`);
}

fs.writeFileSync(path.join(saida, 'indice.json'), JSON.stringify(indice, null, 2));
console.log(`\n${indice.length} folhas em ${saida}`);
