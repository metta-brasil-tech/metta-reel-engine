/**
 * institucional-decupar.js - Gera a decupagem encaixando as janelas curadas
 * na grade ritmica da trilha.
 *
 * O roteiro descreve blocos (quantos compassos dura, que tipo de cena entra,
 * de quantas batidas e cada plano). O script resolve quais clipes ocupam cada
 * slot, sem repetir clipe perto de si mesmo.
 *
 * Uso: node .scripts/institucional-decupar.js --dir <pasta> --roteiro <arquivo.json> --saida plano.json
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const pega = (n, padrao) => { const i = args.indexOf(n); return i === -1 ? padrao : args[i + 1]; };
const dir = pega('--dir');
const roteiroArq = pega('--roteiro');
const saidaArq = pega('--saida', 'plano.json');
if (!dir || !roteiroArq) {
  console.error('uso: node institucional-decupar.js --dir <pasta> --roteiro <arquivo> [--saida plano.json]');
  process.exit(1);
}

const roteiro = JSON.parse(fs.readFileSync(roteiroArq, 'utf8'));

// Janelas gastas em pecas anteriores. Nao sao proibidas, so vao pro fim da fila:
// com 3 pecas de 42 planos e menos janelas que isso, excluir de vez travaria a
// montagem. Penalizar diversifica enquanto ha material e degrada suave quando acaba.
const gastas = new Set();
const evitarArgs = args.reduce((acc, a, i) => (a === '--evitar' ? [...acc, args[i + 1]] : acc), []);
for (const p of evitarArgs) {
  const anterior = JSON.parse(fs.readFileSync(p, 'utf8'));
  for (const c of anterior.cortes) gastas.add(`${c.clipe}:${c.de}`);
}
if (evitarArgs.length) console.log(`evitando ${gastas.size} janelas de ${evitarArgs.length} peca(s) anterior(es)`);
const catalogo = JSON.parse(fs.readFileSync(path.join(dir, 'curadoria/catalogo.json'), 'utf8'));
const grade = JSON.parse(fs.readFileSync(path.join(dir, roteiro.grade), 'utf8'));
const indice = JSON.parse(fs.readFileSync(path.join(dir, 'folhas/indice.json'), 'utf8'));
const duracaoDe = Object.fromEntries(indice.map((i) => [i.nome, i.duracao]));
// sem duracao conhecida o corte pode passar do fim do clipe e sair curto,
// entao falta de dado e erro, nao um default generoso
const semDuracao = indice.filter((i) => !(i.duracao > 0)).map((i) => i.nome);
if (semDuracao.length) {
  console.error(`indice sem duracao para ${semDuracao.length} clipe(s): ${semDuracao.slice(0, 8).join(' ')}`);
  console.error('rode institucional-folhas.js de novo pra regravar o indice');
  process.exit(1);
}

const BATIDA = grade.periodo;
// peca muda ainda segue a grade: o corte casa quando a musica entrar no editor
const inicioTrilha = roteiro.trilha ? roteiro.trilha.de : 0;

// --- monta o acervo de janelas -----------------------------------------------
const janelas = [];
for (const c of catalogo) {
  if (c.uso === 'descartar') continue;
  if ((roteiro.bloquear || []).includes(c.id)) continue;
  for (const m of c.melhores || []) {
    janelas.push({
      clipe: c.id, de: m.de, ate: m.ate, porque: m.porque,
      energia: c.energia, plano: c.plano, uso: c.uso,
      especialista: c.especialista, movimento: c.movimento,
      duracaoClipe: duracaoDe[c.id],
    });
  }
}
console.log(`acervo: ${janelas.length} janelas de ${new Set(janelas.map((j) => j.clipe)).size} clipes`);

// --- selecao ------------------------------------------------------------------
const usadas = new Set();
const historicoClipe = [];
const DISTANCIA = 6; // nao repetir o mesmo clipe dentro de 6 planos

function combina(j, filtro) {
  for (const [chave, valor] of Object.entries(filtro || {})) {
    const alvo = Array.isArray(valor) ? valor : [valor];
    if (!alvo.includes(j[chave])) return false;
  }
  return true;
}

function escolher(filtro, duracaoSlot) {
  const recentes = historicoClipe.slice(-DISTANCIA);
  const candidatas = janelas
    .filter((j) => !usadas.has(`${j.clipe}:${j.de}`))
    .filter((j) => !recentes.includes(j.clipe))
    .filter((j) => combina(j, filtro))
    // a janela precisa caber no clipe a partir do inicio dela
    .filter((j) => j.de + duracaoSlot <= j.duracaoClipe);

  if (!candidatas.length) return null;
  // ordena por: nao gasta em peca anterior primeiro, depois pela janela cuja
  // duracao original mais se aproxima do slot, porque foi escolhida por ter
  // aquele tamanho de acao
  const custo = (j) => (gastas.has(`${j.clipe}:${j.de}`) ? 1000 : 0) + Math.abs((j.ate - j.de) - duracaoSlot);
  candidatas.sort((a, b) => custo(a) - custo(b));
  return candidatas[0];
}

// --- percorre os blocos --------------------------------------------------------
const cortes = [];
let t = 0;
const relatorio = [];

for (const bloco of roteiro.blocos) {
  const slot = +(BATIDA * bloco.batidas).toFixed(4);
  const n = bloco.planos;
  let colocados = 0;
  for (let i = 0; i < n; i++) {
    let j = escolher(bloco.filtro, slot);
    if (!j) j = escolher(bloco.alternativo || {}, slot);   // afrouxa o filtro
    if (!j) j = escolher({}, slot);                         // ultimo recurso
    if (!j) { console.warn(`  bloco ${bloco.nome}: acabou material no plano ${i + 1}`); break; }

    usadas.add(`${j.clipe}:${j.de}`);
    historicoClipe.push(j.clipe);
    cortes.push({
      clipe: j.clipe,
      de: +j.de.toFixed(3),
      ate: +(j.de + slot).toFixed(3),
      zoom: bloco.zoom || 1.0,
      bloco: bloco.nome,
      _t: +t.toFixed(3),
      _porque: j.porque,
      _energia: j.energia,
      _plano: j.plano,
    });
    t += slot;
    colocados++;
  }
  relatorio.push({ nome: bloco.nome, planos: colocados, slot, fim: +t.toFixed(2) });
}

const duracaoTotal = +t.toFixed(3);

const plano = {
  saida: roteiro.saida,
  source: roteiro.source || 'source',
  trilha: roteiro.trilha ? { ...roteiro.trilha, de: inicioTrilha } : null,
  cartelas: (roteiro.cartelas || []).map((c) => ({ ...c })),
  marcas: (roteiro.marcas || []).map((m) => ({ ...m })),
  cortes: cortes.map(({ _t, _porque, _energia, _plano, ...c }) => c),
};

fs.writeFileSync(path.join(dir, saidaArq), JSON.stringify(plano, null, 2));

// decupagem legivel, que e o que vai pra aprovacao
const origemGrade = roteiro.trilha
  ? `Trilha ${path.basename(roteiro.trilha.arquivo)} a partir de ${inicioTrilha}s`
  : `Peca muda, cortada sobre a grade de ${grade.arquivo}`;
const linhas = ['# Decupagem', '', `${origemGrade}, batida de ${BATIDA.toFixed(4)}s (${grade.bpm} BPM).`, `${cortes.length} planos, ${duracaoTotal.toFixed(2)}s.`, ''];
linhas.push('| t | bloco | clipe | trecho | dur | cena |');
linhas.push('|---|---|---|---|---|---|');
for (const c of cortes) {
  linhas.push(`| ${c._t.toFixed(2)}s | ${c.bloco} | ${c.clipe} | ${c.de}-${c.ate} | ${(c.ate - c.de).toFixed(2)}s | ${c._energia}, ${c._plano}, ${c._porque || ''} |`);
}
linhas.push('', '## Blocos', '');
linhas.push('| bloco | planos | plano dura | termina |');
linhas.push('|---|---|---|---|');
relatorio.forEach((r) => linhas.push(`| ${r.nome} | ${r.planos} | ${r.slot.toFixed(2)}s | ${r.fim}s |`));
fs.writeFileSync(path.join(dir, saidaArq.replace('.json', '.md')), linhas.join('\n'));

console.log(`\n${cortes.length} planos, ${duracaoTotal.toFixed(2)}s`);
relatorio.forEach((r) => console.log(`  ${r.nome.padEnd(14)} ${String(r.planos).padStart(2)} planos x ${r.slot.toFixed(2)}s  ate ${r.fim}s`));
console.log(`\nplano: ${path.join(dir, saidaArq)}`);
console.log(`decupagem: ${path.join(dir, saidaArq.replace('.json', '.md'))}`);
