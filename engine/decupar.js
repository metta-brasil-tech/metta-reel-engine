/**
 * decupar.js - Gera a decupagem usando fronteiras de PALAVRA.
 *
 * Timestamps de segmento do whisper são aproximados e fazem o corte cair dentro
 * de palavra. Aqui cada segmento começa e termina em fronteira real de palavra,
 * cruzada com a energia do áudio, e a margem nunca invade a palavra vizinha.
 *
 * Uso: node decupar.js --dir <pasta> [--tr <palavras.json>] [--offset <s>] [--wav <a.wav>]
 *
 * Lê da pasta de trabalho:  decupagem-config.json (opcional: descartes e papéis)
 * Escreve na pasta:         decupagem.json
 */
const fs = require('fs');
const path = require('path');
const ctx = require('./contexto').abrir();

const arg = (nome, padrao) => {
  const i = process.argv.indexOf(nome);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : padrao;
};

const entrada = path.resolve(arg('--tr', ctx.caminho('util_palavras.json')));
const OFFSET = parseFloat(arg('--offset', '0'));

// Respiro máximo que cada lado do corte pode ganhar. O que sobrar da pausa é
// descartado: é assim que o silêncio entre frases some sem soar cortado.
const MARGEM_ANTES = 0.12;
const MARGEM_DEPOIS = 0.18;

// Descartes e papéis vêm da pasta do vídeo. Sem o arquivo, nada é descartado e
// toda frase entra como "corpo": serve para uma primeira leitura do material.
const cfg = ctx.lerJson('decupagem-config.json', false) || {};
const DESCARTES = cfg.descartes || [];
// Papel casado pelo início do texto. Posicional não serve: o whisper quebra
// "Você garante resultado? Se eu não aumentar..." em duas frases.
const PAPEIS = cfg.papeis || [];
const FONTE = cfg.fonte || null;

// Silêncio real, medido no áudio. As fronteiras de palavra do whisper são
// esticadas (uma palavra "ocupa" até a próxima começar), então elas dizem onde
// NÃO cortar, mas não revelam a pausa. Quem revela a pausa é a energia do sinal.
// Dois limiares, porque servem a coisas diferentes:
// SILENCIO_DB decide o que é pausa longa a apertar.
// BORDA_DB decide onde a fala realmente acaba, e precisa ser bem mais baixo:
// ele fecha "suando frio" quase sussurrado, a -40 dB, e com limiar único
// a palavra "frio" era classificada como silêncio e cortada fora.
const SILENCIO_DB = -38;
const BORDA_DB = -50;
const PAUSA_MINIMA_CORTE = 0.45;   // abaixo disso é respiração, fica
const PAUSA_ALVO = 0.20;           // o que sobra da pausa depois do aperto

function mapaDeEnergia(wavPath, offset, janelaMs = 20) {
  const buf = fs.readFileSync(wavPath);
  let pos = 12, dataOffset = -1, dataLen = 0, sr = 16000;
  while (pos < buf.length - 8) {
    const id = buf.toString('ascii', pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    if (id === 'fmt ') sr = buf.readUInt32LE(pos + 12);
    if (id === 'data') { dataOffset = pos + 8; dataLen = size; break; }
    pos += 8 + size + (size % 2);
  }
  const porJanela = Math.round((sr * janelaMs) / 1000);
  const total = Math.floor(dataLen / 2);
  const cru = [];
  for (let w = 0; w * porJanela < total; w++) {
    let soma = 0, n = 0;
    for (let i = 0; i < porJanela; i++) {
      const idx = w * porJanela + i;
      if (idx >= total) break;
      const s = buf.readInt16LE(dataOffset + idx * 2) / 32768;
      soma += s * s; n++;
    }
    if (!n) break;
    const rms = Math.sqrt(soma / n);
    cru.push({ t: (w * porJanela) / sr + offset, db: rms > 0 ? 20 * Math.log10(rms) : -120 });
  }
  // média móvel: sem ela um estalo de respiração parte a pausa em duas e o
  // aperto não acontece (foi o que escondeu a maior parte do silêncio na v1)
  return cru.map((w, i) => {
    const viz = cru.slice(Math.max(0, i - 1), i + 2);
    return { t: w.t, db: viz.reduce((a, b) => a + b.db, 0) / viz.length };
  });
}

/**
 * Borda real da fala: onde o sinal cruza o limiar, não onde o whisper diz.
 * O whisper estica a palavra até a próxima começar, o que esconde a pausa.
 */
function bordasReais(janelas, iniPalavra, fimPalavra, limiteInf, limiteSup) {
  // a busca nunca ultrapassa a frase vizinha, senão a borda "encontra" a fala do lado
  const de = Math.max(iniPalavra - 0.45, limiteInf);
  const ate = Math.min(fimPalavra + 0.45, limiteSup);
  const dentro = janelas.filter(w => w.t >= de && w.t <= ate);
  const audiveis = dentro.filter(w => w.db >= BORDA_DB);
  if (!audiveis.length) return { ini: iniPalavra, fim: fimPalavra };
  // Trava nas fronteiras de palavra do whisper: como ele estica cada palavra até
  // a próxima começar, elas são o limite seguro. Sem essa trava a borda "encontra"
  // o começo da frase seguinte e traz junto um pedaço do que foi descartado.
  return {
    ini: Math.max(audiveis[0].t, iniPalavra),
    fim: Math.min(audiveis[audiveis.length - 1].t + 0.02, fimPalavra)
  };
}

/**
 * Regiões contínuas abaixo do limiar de silêncio
 */
function regioesDeSilencio(janelas) {
  const regioes = [];
  let ini = null;
  // usa o limiar de borda, não o de silêncio: apertar com o limiar alto
  // arriscaria comer a cauda de uma palavra falada baixo
  janelas.forEach((w, i) => {
    if (w.db < BORDA_DB && ini === null) ini = w.t;
    else if (w.db >= BORDA_DB && ini !== null) {
      if (w.t - ini >= PAUSA_MINIMA_CORTE) regioes.push({ ini, fim: w.t, dur: w.t - ini });
      ini = null;
    }
  });
  return regioes;
}

function tokensParaPalavras(tokens) {
  const palavras = [];
  tokens.forEach(t => {
    const bruto = t.text;
    if (!bruto || !bruto.trim()) return;
    const abre = /^\s/.test(bruto) || palavras.length === 0;
    const texto = bruto.trim();
    if (abre) {
      palavras.push({ texto, ini: t.offsets.from / 1000 + OFFSET, fim: t.offsets.to / 1000 + OFFSET });
    } else {
      const p = palavras[palavras.length - 1];
      p.texto += texto;
      p.fim = t.offsets.to / 1000 + OFFSET;
    }
  });
  return palavras;
}

function emFrases(palavras) {
  const frases = [];
  let atual = [];
  palavras.forEach(p => {
    atual.push(p);
    if (/[.!?]$/.test(p.texto)) { frases.push(atual); atual = []; }
  });
  if (atual.length) frases.push(atual);
  return frases.map(f => ({
    palavras: f,
    texto: f.map(p => p.texto).join(' '),
    ini: f[0].ini,
    fim: f[f.length - 1].fim
  }));
}

const j = JSON.parse(fs.readFileSync(entrada, 'utf8'));
const palavras = tokensParaPalavras(j.transcription || []);
const frases = emFrases(palavras);

console.log(`[decupagem] ${palavras.length} palavras, ${frases.length} frases\n`);

// Marca descartes. Duas formas: por início do texto, ou por janela de tempo.
// A janela resolve bloco longo de pré-produção, onde as falas se repetem e
// casar por texto fica frágil ("Isso vai estar escrito?" aparece duas vezes).
frases.forEach(f => {
  const d = DESCARTES.find(x => {
    if (x.chave) return f.texto.toLowerCase().startsWith(x.chave);
    if (x.de !== undefined || x.ate !== undefined) {
      const de = x.de !== undefined ? x.de : -Infinity;
      const ate = x.ate !== undefined ? x.ate : Infinity;
      return f.ini >= de && f.ini < ate;
    }
    return false;
  });
  if (d) { f.descartar = true; f.motivo = d.motivo; }
});

const mantidasCount = frases.filter(f => !f.descartar).length;
if (!mantidasCount) {
  console.error('todos os descartes casaram: sobrou nenhuma frase');
  process.exit(1);
}

const mantidas = frases.filter(f => !f.descartar);

// Bordas de cada frase medidas no áudio, com respiro fixo de cada lado.
// Assim a pausa entre duas frases fica sempre em MARGEM_ANTES + MARGEM_DEPOIS,
// independente de quão arrastado foi o original.
const WAV = path.resolve(arg('--wav', ctx.caminho('util.wav')));
const janelas = fs.existsSync(WAV) ? mapaDeEnergia(WAV, OFFSET) : null;

const segmentos = mantidas.map((f, i) => {
  let ini = f.ini, fim = f.fim;
  if (janelas) {
    const idx = frases.indexOf(f);
    const anterior = frases[idx - 1];
    const proxima = frases[idx + 1];
    const b = bordasReais(
      janelas, f.ini, f.fim,
      anterior ? anterior.fim : f.ini - 1,
      proxima ? proxima.ini : f.fim + 1
    );
    ini = b.ini; fim = b.fim;
  }

  const casado = PAPEIS.find(p => f.texto.toLowerCase().startsWith(p.chave));
  return {
    id: i + 1,
    de: +(ini - MARGEM_ANTES).toFixed(3),
    ate: +(fim + MARGEM_DEPOIS).toFixed(3),
    texto: f.texto,
    papel: casado ? casado.papel : 'corpo'
  };
});

// Frases faladas coladas não têm pausa para acomodar os dois respiros.
// Nesse caso a fronteira vira o ponto médio e os segmentos ficam contíguos.
segmentos.forEach((s, i) => {
  const prox = segmentos[i + 1];
  if (!prox || s.ate <= prox.de) return;
  const meio = +((s.ate + prox.de) / 2).toFixed(3);
  if (meio <= s.de || meio >= prox.ate) {
    throw new Error(`segmentos ${s.id} e ${prox.id} se sobrepõem sem solução: ${s.ate} > ${prox.de}`);
  }
  s.ate = meio;
  prox.de = meio;
});

// Cortes internos: trecho a remover de DENTRO da fala, para tirar gagueira ou
// tentativa abortada sem descartar a frase toda. Em tempo do bruto.
//
// Aplicados como subtração de intervalo, não como aperto de pausa: a repetição
// pode atravessar a fronteira de dois segmentos, e aí ela não está "dentro" de
// nenhum deles.
const CORTES_INTERNOS = cfg.cortes_internos || [];

if (CORTES_INTERNOS.length) {
  CORTES_INTERNOS.forEach(corte => {
    const novos = [];
    segmentos.forEach(s => {
      if (corte.ate <= s.de || corte.de >= s.ate) { novos.push(s); return; }  // não encosta
      if (corte.de <= s.de && corte.ate >= s.ate) return;                      // engole o segmento
      if (corte.de > s.de) novos.push({ ...s, de: s.de, ate: +corte.de.toFixed(3) });
      if (corte.ate < s.ate) novos.push({ ...s, de: +corte.ate.toFixed(3), ate: s.ate });
    });
    segmentos.length = 0;
    novos.filter(s => s.ate - s.de >= 0.15).forEach(s => segmentos.push(s));
  });
  segmentos.forEach((s, i) => { s.id = i + 1; });
  console.log(`[decupagem] ${CORTES_INTERNOS.length} corte(s) interno(s) aplicado(s)`);
}

// Aperta os silêncios: cada pausa longa dentro de um segmento vira um corte,
// partindo o segmento em dois pedaços e devolvendo o tempo morto.
let apertos = [];
if (janelas) {
  const silencios = regioesDeSilencio(janelas);
  const finais = [];

  segmentos.forEach(s => {
    // silêncios inteiramente dentro deste segmento, com folga das bordas
    const dentro = silencios.filter(z => z.ini > s.de + 0.05 && z.fim < s.ate - 0.05);
    if (!dentro.length) { finais.push(s); return; }

    let cursor = s.de;
    dentro.forEach(z => {
      // mantém PAUSA_ALVO no total, metade de cada lado do corte
      const fimPedaco = +(z.ini + PAUSA_ALVO / 2).toFixed(3);
      const iniProximo = +(z.fim - PAUSA_ALVO / 2).toFixed(3);
      if (fimPedaco <= cursor || iniProximo <= fimPedaco) return;
      finais.push({ ...s, de: cursor, ate: fimPedaco, parte: true });
      apertos.push({ de: fimPedaco, ate: iniProximo, ganho: +(iniProximo - fimPedaco).toFixed(3) });
      cursor = iniProximo;
    });
    if (cursor < s.ate) finais.push({ ...s, de: cursor, ate: s.ate, parte: true });
  });

  // Apertar uma pausa no fim de uma frase deixa um rabo sem fala nenhuma.
  // Esses pedaços viram um piscar de imagem sem áudio, então saem.
  const temFala = s => janelas.some(w => w.t >= s.de && w.t <= s.ate && w.db >= BORDA_DB + 6);
  const limpos = finais.filter(s => (s.ate - s.de) >= 0.25 && temFala(s));
  const removidos = finais.length - limpos.length;
  if (removidos) console.log(`[decupagem] ${removidos} fragmento(s) sem fala descartado(s)`);

  segmentos.length = 0;
  limpos.forEach((s, i) => segmentos.push({ ...s, id: i + 1 }));
}

const duracaoBruto = cfg.bruto && cfg.bruto.duracao ? cfg.bruto.duracao : segmentos[segmentos.length - 1].ate + 1;

const descartes = [
  { de: 0.0, ate: +(frases[0].ini - MARGEM_ANTES).toFixed(3), motivo: cfg.motivo_cabeca || 'cabeça: material antes da primeira fala aproveitável' },
  ...frases.filter(f => f.descartar).map(f => ({ de: +f.ini.toFixed(3), ate: +f.fim.toFixed(3), motivo: f.motivo, texto: f.texto })),
  { de: +(frases[frases.length - 1].fim + MARGEM_DEPOIS).toFixed(3), ate: duracaoBruto, motivo: 'silêncio final' }
];

const plano = {
  fonte: FONTE,
  bruto: cfg.bruto || null,
  marca: cfg.marca || 'Metta',
  formato: cfg.formato || 'Reels 1080x1920',
  _metodo: 'fronteiras de palavra (whisper medium, -ml 1) cruzadas com a energia do áudio; margem limitada a metade da pausa vizinha',
  segmentos,
  descartes
};

if (!FONTE) console.warn('  aviso: decupagem-config.json sem "fonte"; a montagem vai precisar dela');
ctx.gravarJson('decupagem.json', plano);

const total = segmentos.reduce((a, s) => a + (s.ate - s.de), 0);
let papelAnterior = null;
segmentos.forEach(s => {
  const marca = s.papel === papelAnterior ? '   (cont.)' : ` | ${s.papel}`;
  console.log(`  ${String(s.id).padStart(2)} | ${s.de.toFixed(2)} -> ${s.ate.toFixed(2)} (${(s.ate - s.de).toFixed(2)}s)${marca}`);
  if (s.papel !== papelAnterior) console.log(`     ${s.texto}`);
  papelAnterior = s.papel;
});
console.log(`\n[decupagem] ${segmentos.length} segmentos, ${total.toFixed(2)}s`);
if (apertos.length) {
  const ganho = apertos.reduce((a, x) => a + x.ganho, 0);
  console.log(`[decupagem] ${apertos.length} silêncios apertados, ${ganho.toFixed(2)}s devolvidos`);
}
console.log('[decupagem] descartes:');
descartes.forEach(d => console.log(`  ${d.de.toFixed(2)} -> ${d.ate.toFixed(2)} | ${d.motivo}`));
