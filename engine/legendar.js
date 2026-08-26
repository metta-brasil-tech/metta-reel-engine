/**
 * gerar-legenda.js - Gera a legenda ASS do reel a partir da transcrição por token.
 *
 * Segue o DNA medido em video/ESTILO-EDICAO.md:
 *   branco puro, sem caixa, halo escuro suave, centralizado,
 *   centro do texto a 54% da altura, corpo 60px, 2 a 5 palavras por vez, uma linha.
 *
 * Palavras-chave saem em amarelo Metta (#FFBE18), conforme pedido.
 *
 * Uso: node gerar-legenda.js <transcricao.json> [saida.ass]
 */
const fs = require('fs');
const path = require('path');

const ctx = require('./contexto').abrir();
const estilo = ctx.lerJson('estilo-reel.json');

// Destaque e correção são do vídeo, não do motor: cada peça tem as suas palavras
// de tese e os seus erros de transcrição. Ficam em plano-visual.json, bloco
// "legenda". Sem o bloco, valem os defaults abaixo, que vieram do C7182.
const visual = ctx.lerJson('plano-visual.json', false) || {};
const cfgLegenda = visual.legenda || {};

// Duracao da base, para nao deixar bloco comecando depois do ultimo quadro.
let DURACAO = 0;
try {
  const base = path.join(ctx.dir, 'tmp', 'base.mp4');
  if (fs.existsSync(base)) {
    DURACAO = parseFloat(require('child_process').execFileSync(ctx.vt.FFPROBE || 'ffprobe',
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', base]).toString().trim());
  }
} catch (e) { DURACAO = 0; }

const W = estilo.canvas.w;
const H = estilo.canvas.h;
const Y = estilo.legenda.y_centro_px;      // 1037
const CORPO = estilo.legenda.corpo_equivalente_px; // 60

// ASS usa BGR, não RGB
const hexParaAss = hex => {
  const h = hex.replace('#', '');
  return '&H00' + h.slice(4, 6) + h.slice(2, 4) + h.slice(0, 2) + '&';
};
const BRANCO = hexParaAss(estilo.cores.branco.hex);
const AMARELO = hexParaAss(estilo.cores.amarelo.hex);

// Palavras que ganham amarelo. Poucas e certeiras: o destaque perde força se
// repetido. Ficaram só as que carregam a tese (a objeção, a garantia, a prova).
// "mil" e "empresas" saíram porque o card de prova já mostra o mesmo número,
// e "devolvemos" saiu porque "devolve" já apareceu na pergunta.
const CHAVES = cfgLegenda.chaves || [
  'golpe', 'golpe?', 'golpista',
  'garante',
  'devolve',
  'contrato',
  'antigolpe',
  '82', 'bilhões'   // "8,2" chega aqui sem a vírgula, pela normalização
];

const MAX_PALAVRAS = 5;
const MIN_PALAVRAS = 2;
const MAX_CHARS = 26;
const PAUSA_QUEBRA = 0.35;

// Correções de transcrição. O whisper erra nomes e expressões da marca, e o
// /legendar exige revisão antes de queimar. Aplicadas sobre a palavra já montada.
// Substituem as padrão em vez de somar: a correção de um vídeo estraga o outro.
// "sabe" vira "Saiba" faz sentido no C7182, onde é o nome do botão, e quebra
// "Sabe o que acontece?" em qualquer peça que faça a pergunta.
const CORRECOES = cfgLegenda.correcoes
  ? cfgLegenda.correcoes.map(([de, para]) => [new RegExp(`^${de}$`, 'i'), para])
  : [
    [/^sabe$/i, 'Saiba'],
    [/^saiba$/i, 'Saiba'],
    [/^antigolpe$/i, 'Antigolpe'],
    [/^metta$/i, 'Metta'],
    [/^mentoria$/i, 'Mentoria']
  ];

// Janelas de tempo da base onde a transcrição inventou palavra. Ver o filtro
// no fim de tokensParaPalavras.
const REMOVER = cfgLegenda.remover || [];

// Sequências inteiras que precisam ser reescritas, não só palavra a palavra.
// Como as correções de palavra, as do vídeo substituem as padrão.
const FRASES_CORRIGIDAS = cfgLegenda.frases
  ? cfgLegenda.frases.map(([de, para]) => [new RegExp(de, 'i'), para])
  : [
    // as aspas saem: o whisper cita o nome do botão, na legenda elas só sujam
    [/clique em ["“]?sabe a mais["”]?/i, 'clique em Saiba mais'],
    [/clique em ["“]saiba mais["”]/i, 'clique em Saiba mais'],
    [/clique e saiba mais/i, 'clique em Saiba mais']
  ];

/**
 * Junta tokens do whisper em palavras. Token iniciado por espaço abre palavra nova.
 */
function tokensParaPalavras(tokens) {
  let palavras = [];
  tokens.forEach(t => {
    const bruto = t.text;
    if (!bruto || !bruto.trim()) return;
    const abreNova = /^\s/.test(bruto) || palavras.length === 0;
    const texto = bruto.trim();
    if (abreNova) {
      palavras.push({ texto, ini: t.offsets.from / 1000, fim: t.offsets.to / 1000 });
    } else {
      const p = palavras[palavras.length - 1];
      p.texto += texto;
      p.fim = t.offsets.to / 1000;
    }
  });

  // Aspas fora antes de qualquer correção. O whisper põe aspas na fala citada, e
  // uma palavra que começa com aspa não casa nem com padrão de frase nem com
  // correção de palavra: o núcleo separado da pontuação sai vazio. Medido no
  // Dia dos Pais, onde "Caí, e "Felio, ficaram sem correção possível.
  palavras.forEach(p => { p.texto = p.texto.replace(/["“”]/g, ''); });

  // Correção de frase: reescreve a sequência mantendo os tempos das palavras
  const linha = palavras.map(p => p.texto).join(' ');
  FRASES_CORRIGIDAS.forEach(([re, certo]) => {
    const achado = linha.match(re);
    if (!achado) return;
    const erradas = achado[0].split(/\s+/);
    const certas = certo.split(/\s+/);
    for (let i = 0; i <= palavras.length - erradas.length; i++) {
      const trecho = palavras.slice(i, i + erradas.length).map(p => p.texto).join(' ');
      if (trecho.toLowerCase() !== achado[0].toLowerCase()) continue;
      const bloco = palavras.slice(i, i + erradas.length);
      const novas = certas.map((txt, k) => ({
        texto: txt + (k === certas.length - 1 && /[.,!?]$/.test(bloco[bloco.length - 1].texto) ? bloco[bloco.length - 1].texto.slice(-1) : ''),
        ini: bloco[Math.min(k, bloco.length - 1)].ini,
        fim: bloco[Math.min(k, bloco.length - 1)].fim
      }));
      palavras.splice(i, erradas.length, ...novas);
      break;
    }
  });

  // Correção palavra a palavra, preservando a pontuação que veio junto
  palavras.forEach(p => {
    const m = p.texto.match(/^([^.,!?;:"]*)(.*)$/);
    const nucleo = m[1], resto = m[2];
    const regra = CORRECOES.find(([re]) => re.test(nucleo));
    if (regra) p.texto = nucleo.replace(regra[0], regra[1]) + resto;
  });

  // Aspas fora. O whisper cita o nome do botão entre aspas e, na legenda,
  // elas só sujam. Feito aqui e não por regex de frase porque a pontuação
  // final gruda na última palavra e quebra o casamento.
  palavras.forEach(p => { p.texto = p.texto.replace(/["“”]/g, ''); });

  // Janelas de alucinação. Na emenda de dois planos o whisper às vezes completa
  // a frase com o que seria natural dizer e carimba o tempo em cima do silêncio:
  // no C7185 ele escreveu "sabe por quê?" sobre 0,2s de pausa medida a -68 dB.
  // Some do áudio não some da transcrição, então a janela é declarada à mão, em
  // tempo da base, depois de conferir que ali não há fala.
  if (REMOVER.length) {
    const antes = palavras.length;
    palavras = palavras.filter(p => !REMOVER.some(r => p.ini >= r.de && p.fim <= r.ate));
    const fora = antes - palavras.length;
    if (fora) console.log(`[legenda] ${fora} palavra(s) removida(s) por janela declarada`);
  }

  // Cauda amassada. Quando a fala vai ate o ultimo quadro, o whisper as vezes
  // carimba as palavras finais todas no mesmo instante, com duracao zero, e
  // ainda joga a pontuacao para depois do fim do arquivo. No depoimento-02 as
  // quatro palavras de 'o anuncio forte.' sairam todas em 35,41s numa base de
  // 35,42s: o bloco comecava depois do fim e a ultima frase ficava sem legenda.
  // Diferente de §3.6, aqui a fala existe - o que falta e o tempo dela. Entao
  // as palavras sao reespalhadas entre a ultima com tempo bom e o fim do video.
  const zeradas = palavras.filter(p => p.fim - p.ini < 0.001).length;
  if (zeradas && DURACAO) {
    let i = 0;
    while (i < palavras.length) {
      if (palavras[i].fim - palavras[i].ini >= 0.001) { i++; continue; }
      let j = i;
      while (j < palavras.length && palavras[j].fim - palavras[j].ini < 0.001) j++;
      const de = i > 0 ? palavras[i - 1].fim : 0;
      const ate = j < palavras.length ? palavras[j].ini : DURACAO;
      const passo = (ate - de) / (j - i);
      if (passo > 0) {
        for (let k = i; k < j; k++) {
          palavras[k].ini = +(de + passo * (k - i)).toFixed(3);
          palavras[k].fim = +(de + passo * (k - i + 1)).toFixed(3);
        }
      }
      i = j;
    }
    console.log(`[legenda] ${zeradas} palavra(s) sem duracao reespalhadas ate ${DURACAO.toFixed(2)}s`);
  }

  // Nada pode passar do ultimo quadro: legenda depois do fim nao aparece.
  if (DURACAO) palavras.forEach(p => { p.ini = Math.min(p.ini, DURACAO); p.fim = Math.min(p.fim, DURACAO); });

  return palavras;
}

// Terminar um bloco nestas palavras deixa a leitura pendurada
const FUNCIONAIS = new Set([
  'a', 'o', 'as', 'os', 'um', 'uma', 'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na',
  'nos', 'nas', 'que', 'e', 'ou', 'para', 'pra', 'pro', 'por', 'com', 'se', 'ao', 'à',
  'seu', 'sua', 'meu', 'minha', 'mais', 'muito', 'você', 'eu', 'te', 'me'
]);

const CHARS_ALVO = 20;

/**
 * Agrupa palavras em blocos de legenda.
 *
 * Quebra gulosa produz órfão de uma palavra e corta em preposição, então a
 * divisão é resolvida por programação dinâmica dentro de cada frase: o custo
 * penaliza bloco fora do tamanho alvo e quebra em palavra funcional, e premia
 * quebra em vírgula ou pausa real da fala.
 */
function agrupar(palavras) {
  // 1. Divide em frases pela pontuação forte
  const frases = [];
  let atual = [];
  palavras.forEach(p => {
    atual.push(p);
    if (/[.!?]$/.test(p.texto)) { frases.push(atual); atual = []; }
  });
  if (atual.length) frases.push(atual);

  // 2. Dentro de cada frase, escolhe a divisão de menor custo
  const grupos = [];
  frases.forEach(frase => {
    const n = frase.length;
    const custo = new Array(n + 1).fill(Infinity);
    const anterior = new Array(n + 1).fill(-1);
    custo[0] = 0;

    for (let fim = 1; fim <= n; fim++) {
      for (let ini = Math.max(0, fim - MAX_PALAVRAS); ini <= fim - 1; ini++) {
        const bloco = frase.slice(ini, fim);
        if (custo[ini] === Infinity) continue;
        // bloco de uma palavra só é aceito quando a frase inteira tem uma palavra
        if (bloco.length < MIN_PALAVRAS && n > 1) continue;

        const texto = bloco.map(p => p.texto).join(' ');
        if (texto.length > MAX_CHARS) continue;

        let c = Math.pow(texto.length - CHARS_ALVO, 2);

        const ultima = bloco[bloco.length - 1];
        const limpa = ultima.texto.toLowerCase().replace(/[.,!?;:"]/g, '');
        if (FUNCIONAIS.has(limpa) && fim < n) c += 260;      // não termina pendurado
        if (/,$/.test(ultima.texto)) c -= 90;                 // vírgula é quebra natural

        const prox = frase[fim];
        if (prox) {
          const pausa = prox.ini - ultima.fim;
          if (pausa >= PAUSA_QUEBRA) c -= 120;                // respiro real da fala
          else if (pausa < 0.05) c += 40;                     // colado, evita cortar aqui
        }

        if (custo[ini] + c < custo[fim]) {
          custo[fim] = custo[ini] + c;
          anterior[fim] = ini;
        }
      }
    }

    // 3. Reconstrói a divisão escolhida
    const cortes = [];
    let i = n;
    while (i > 0 && anterior[i] >= 0) { cortes.unshift([anterior[i], i]); i = anterior[i]; }
    if (!cortes.length) cortes.push([0, n]);   // frase que não coube em nenhuma divisão
    cortes.forEach(([a, b]) => grupos.push(frase.slice(a, b)));
  });

  return grupos;
}

const seg = s => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${sec.toFixed(2).padStart(5, '0')}`;
};

/**
 * Aplica amarelo nas palavras-chave dentro do grupo
 */
function pintar(grupo) {
  return grupo.map(p => {
    const limpo = p.texto.toLowerCase().replace(/[.,!?;:"]/g, '');
    const chave = CHAVES.includes(limpo);
    return chave ? `{\\c${AMARELO}}${p.texto}{\\c${BRANCO}}` : p.texto;
  }).join(' ');
}

// Janelas em que a legenda não entra, para não competir com um overlay que já
// carrega o mesmo texto
const visualPath = ctx.caminho('plano-visual.json');
const SUPRIMIR = fs.existsSync(visualPath)
  ? (JSON.parse(fs.readFileSync(visualPath, 'utf8')).suprimir_legenda || [])
  : [];

function gerar(tokens) {
  const palavras = tokensParaPalavras(tokens);
  const grupos = agrupar(palavras);

  const cab = `[Script Info]
Title: C7179 Reels Metta
ScriptType: v4.00+
PlayResX: ${W}
PlayResY: ${H}
WrapStyle: 2
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Legenda,Inter Legenda,${CORPO},${BRANCO},${BRANCO},&H00000000&,&H80000000&,-1,0,0,0,100,100,0,0,1,3,0,5,60,60,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  let suprimidos = 0, truncados = 0;

  const linhas = grupos.map((g, i) => {
    let ini = g[0].ini;
    const proximo = grupos[i + 1];
    // estende até o próximo grupo para a legenda não piscar entre blocos
    let fim = g[g.length - 1].fim;
    if (proximo) fim = Math.min(proximo[0].ini, fim + 0.6);
    if (fim <= ini) fim = ini + 0.3;

    // Janela de overlay: não basta descartar o bloco que começa dentro dela.
    // Um bloco que começou antes e ainda está no ar aparece por trás do número.
    for (const j of SUPRIMIR) {
      if (fim <= j.de || ini >= j.ate) continue;          // não encosta
      if (ini >= j.de && fim <= j.ate) { suprimidos++; return null; }  // inteiro dentro
      if (ini < j.de) { fim = j.de; truncados++; }         // entra pela esquerda: corta antes
      else { ini = j.ate; truncados++; }                   // sai pela direita: começa depois
    }
    if (fim - ini < 0.12) { suprimidos++; return null; }

    // halo escuro difuso em vez de contorno duro, conforme o DNA
    const override = `{\\pos(${Math.round(W / 2)},${Y})\\blur4\\3c&H000000&\\bord3\\shad0}`;
    return `Dialogue: 0,${seg(ini)},${seg(fim)},Legenda,,0,0,0,,${override}${pintar(g)}`;
  }).filter(Boolean);

  if (suprimidos || truncados) {
    console.log(`[legenda] ${suprimidos} bloco(s) suprimido(s) e ${truncados} truncado(s) por sobreposição com overlay`);
  }

  return { ass: cab + linhas.join('\n') + '\n', grupos };
}

// CLI
const argl = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const entrada = path.resolve(argl('--tr', ctx.caminho('base_tr.json')));
const saida = path.resolve(argl('--out', ctx.caminho('legenda.ass')));

const j = JSON.parse(fs.readFileSync(entrada, 'utf8'));
const { ass, grupos } = gerar(j.transcription || []);
fs.writeFileSync(saida, ass, 'utf8');

console.log(`[legenda] ${grupos.length} blocos`);
const chars = grupos.map(g => g.map(p => p.texto).join(' ').length);
console.log(`[legenda] palavras por bloco: min ${Math.min(...grupos.map(g => g.length))}, max ${Math.max(...grupos.map(g => g.length))}`);
console.log(`[legenda] caracteres por bloco: min ${Math.min(...chars)}, max ${Math.max(...chars)}`);
console.log(`[legenda] ${saida}`);
console.log('\nprimeiros blocos:');
grupos.slice(0, 10).forEach(g => console.log(`  ${g[0].ini.toFixed(2)}s  ${g.map(p => p.texto).join(' ')}`));
