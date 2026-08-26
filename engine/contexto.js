/**
 * contexto.js - Resolve caminhos e configuração do motor de reel.
 *
 * O motor mora aqui, em .scripts/reel. Cada vídeo tem sua pasta de trabalho,
 * que guarda só configuração e material: decupagem.json, plano-visual.json,
 * estilo-reel.json, mais as pastas de mídia.
 *
 * A pasta de trabalho vem, nesta ordem: argumento --dir, variável REEL_DIR,
 * ou o diretório atual.
 */
const path = require('path');
const fs = require('fs');

const RAIZ = __dirname;
const PROJETO = path.resolve(RAIZ, '..', '..');

const vt = require(path.join(PROJETO, '.scripts', 'video-tools.js'));

function resolverDir(argv = process.argv) {
  const i = argv.indexOf('--dir');
  if (i >= 0 && argv[i + 1]) return path.resolve(argv[i + 1]);
  if (process.env.REEL_DIR) return path.resolve(process.env.REEL_DIR);
  return process.cwd();
}

function abrir(dirTrabalho) {
  const dir = dirTrabalho ? path.resolve(dirTrabalho) : resolverDir();
  if (!fs.existsSync(dir)) throw new Error(`pasta de trabalho não existe: ${dir}`);

  const sub = nome => {
    const p = path.join(dir, nome);
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
    return p;
  };

  const lerJson = (nome, obrigatorio = true) => {
    const p = path.join(dir, nome);
    if (!fs.existsSync(p)) {
      if (obrigatorio) throw new Error(`falta ${nome} em ${dir}`);
      return null;
    }
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  };

  const gravarJson = (nome, dados) =>
    fs.writeFileSync(path.join(dir, nome), JSON.stringify(dados, null, 2), 'utf8');

  return {
    dir,
    projeto: PROJETO,
    fontes: path.join(RAIZ, 'fonts'),
    presets: path.join(RAIZ, 'presets'),
    vt,
    caminho: (...p) => path.join(dir, ...p),
    sub,
    lerJson,
    gravarJson,
    // escape que o ffmpeg exige em caminho do Windows dentro de filtro
    escapar: p => p.replace(/\\/g, '/').replace(/:/g, '\\:')
  };
}

module.exports = { abrir, resolverDir, RAIZ, PROJETO };
