/**
 * mapear-tr.js - Escreve a transcricao em tempo da BASE sem transcrever de novo.
 *
 * O caminho normal e retranscrever tmp/base.mp4 (playbook §1, etapa 6). Ele
 * funciona quando o whisper alinha bem, e falha quando a fala vai ate o ultimo
 * quadro: no depoimento-02 as quatro palavras de "o anuncio forte." sairam todas
 * carimbadas em 35,41s numa base de 35,42s, e com 0,7s de silencio no fim ele
 * apenas empurrou as mesmas palavras para 36,11s, depois do fim do arquivo. A
 * legenda da ultima frase simplesmente nao aparecia.
 *
 * Aqui os tempos vem da transcricao do bruto, que e onde o whisper tem contexto
 * dos dois lados de cada palavra, e sao convertidos para a linha do tempo da
 * base pela propria decupagem:
 *
 *   t_base = inicio_da_parte + (t_bruto - segmento.de)
 *
 * Palavra que cai em trecho descartado sai fora, e palavra que atravessa a borda
 * do segmento e truncada nela. Como nenhuma palavra vem de cima de uma emenda,
 * isso tambem elimina por construcao a alucinacao de §3.6.
 *
 * Uso: node .scripts/reel/mapear-tr.js --dir <pasta> [--out <arquivo.json>]
 */
const fs = require('fs');
const path = require('path');
const ctx = require('./contexto').abrir();

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };

const cfg = ctx.lerJson('decupagem-config.json');
const plano = ctx.lerJson('decupagem.json');
const tr = ctx.lerJson('util_palavras.json');
const partes = JSON.parse(fs.readFileSync(path.join(ctx.dir, 'tmp', 'partes.json'), 'utf8'));
const saida = path.resolve(arg('--out', ctx.caminho('base_tr.json')));
const OFFSET = cfg.offset_transcricao || 0;

if (partes.length !== plano.segmentos.length) {
  console.error(`partes.json tem ${partes.length} partes e a decupagem tem ${plano.segmentos.length} segmentos: remonte a base`);
  process.exit(1);
}

const trechos = plano.segmentos.map((s, i) => ({ de: s.de, ate: s.ate, inicio: partes[i].inicio }));

// Gap de aperto nao e descarte. Entre dois segmentos vizinhos sobra o resto de
// uma pausa que o motor comeu, e o whisper as vezes carimba ali uma palavra que
// continua no ar: no depoimento-02 o 'isso' de 'a equipe acatou isso e seguiu'
// caia no gap de 0,26s e sumia da legenda, com o audio dizendo a palavra. Esses
// gaps sao recuperaveis; ja a cabeca, a cauda e as janelas declaradas em
// descartes ou cortes_internos sao decisao editorial e ficam de fora.
const declarados = [].concat(cfg.cortes_internos || [], plano.descartes || []);
const gapsApertados = [];
for (let i = 0; i < trechos.length - 1; i++) {
  const g = { de: trechos[i].ate, ate: trechos[i + 1].de, antes: trechos[i], depois: trechos[i + 1] };
  if (g.ate - g.de <= 0) continue;
  const declarado = declarados.some(d => d.de < g.ate && d.ate > g.de);
  if (!declarado) gapsApertados.push(g);
}

let dentro = 0, fora = 0, truncadas = 0, recuperadas = 0;
const tokens = [];
(tr.transcription || []).forEach(t => {
  const ini = t.offsets.from / 1000 + OFFSET;
  const fim = t.offsets.to / 1000 + OFFSET;
  let trecho = trechos.find(x => ini >= x.de && ini < x.ate);
  if (!trecho) {
    const g = gapsApertados.find(x => ini >= x.de && ini < x.ate);
    if (g) {
      // encosta na borda mais proxima: pontuacao de fim de frase fica com o
      // segmento que fecha, palavra que continua abre o proximo
      const daBorda = (ini - g.de) <= (g.ate - ini);
      trecho = daBorda ? g.antes : g.depois;
      const t0 = daBorda ? Math.max(trecho.de, trecho.ate - 0.05) : trecho.de;
      tokens.push({ text: t.text, offsets: {
        from: Math.round((trecho.inicio + (t0 - trecho.de)) * 1000),
        to: Math.round((trecho.inicio + Math.min(t0 + (fim - ini), trecho.ate) - trecho.de) * 1000) } });
      recuperadas++; dentro++;
      return;
    }
    fora++; return;
  }
  const fimCortado = Math.min(fim, trecho.ate);
  if (fimCortado < fim) truncadas++;
  dentro++;
  tokens.push({
    text: t.text,
    offsets: {
      from: Math.round((trecho.inicio + (ini - trecho.de)) * 1000),
      to: Math.round((trecho.inicio + (fimCortado - trecho.de)) * 1000)
    }
  });
});

fs.writeFileSync(saida, JSON.stringify({ transcription: tokens }, null, 1));
console.log(`[mapear] ${dentro} tokens em tempo da base (${recuperadas} recuperados de gap de aperto), ` +
  `${fora} em trecho descartado, ${truncadas} truncados na borda`);
console.log(`[mapear] ${saida}`);
