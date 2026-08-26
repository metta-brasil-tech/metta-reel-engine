/**
 * gerar-overlays.js - Gera os overlays PNG do reel com o design system Metta.
 *
 * Produz, em 1080x1920 com fundo transparente:
 *   cartela-abertura.png   duas caixas empilhadas (amarela + branca), DNA da PP-SE-1038
 *   pilula-1/2/3.png       pílula amarela numerando as perguntas
 *   card-prova.png         números canônicos do banco de provas
 *   pilula-cta.png         pílula de fecho
 *
 * Tipografia: Zalando Sans Expanded (display). Cores: tokens de estilo-reel.json.
 *
 * Uso: node gerar-overlays.js
 */
const fs = require('fs');
const path = require('path');
let puppeteer;
try {
  puppeteer = require('puppeteer');
} catch (e) {
  console.error('falta o puppeteer, que é quem renderiza as peças gráficas.');
  console.error('rode "npm install" na raiz do projeto e tente de novo.');
  process.exit(1);
}

const ctx = require('./contexto').abrir();
const DIR = ctx.dir;
const OUT = ctx.sub('overlays');
const estilo = ctx.lerJson('estilo-reel.json');

const C = {
  amarelo: estilo.cores.amarelo.hex,
  charcoal: estilo.cores.charcoal.hex,
  branco: estilo.cores.branco.hex
};
const W = estilo.canvas.w, H = estilo.canvas.h;

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

// Fonte embutida como data URI: file:// dentro do puppeteer falhou silenciosamente
// e a página caiu no serif padrão, o que passaria despercebido no PNG.
const fonte = f => {
  const b64 = fs.readFileSync(path.join(ctx.fontes, f)).toString('base64');
  return `data:font/ttf;base64,${b64}`;
};

const CSS = `
@font-face { font-family: 'Zalando'; src: url('${fonte('ZalandoSansExpanded-Bold.ttf')}') format('truetype'); font-weight: 700; }
@font-face { font-family: 'Zalando'; src: url('${fonte('ZalandoSansExpanded-ExtraBold.ttf')}') format('truetype'); font-weight: 800; }
@font-face { font-family: 'ZalandoBlack'; src: url('${fonte('ZalandoSansExpanded-Black.ttf')}') format('truetype'); }
@font-face { font-family: 'InterLegenda'; src: url('${fonte('Inter-Bold.ttf')}') format('truetype'); font-weight: 700; }

* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: ${W}px; height: ${H}px; background: transparent; }
body { position: relative; font-family: 'Zalando', sans-serif; -webkit-font-smoothing: antialiased; }
.camada { position: absolute; inset: 0; }
`;

/**
 * Cartela de abertura: faixa vertical 62.8%, largura útil ~800px, caixa amarela,
 * medida da PP-SE-1038.
 *
 * A caixa branca de subtítulo saiu: com a caixinha de pergunta no topo, ela
 * virava a terceira linha de texto dizendo quase a mesma coisa.
 */
function cartela(headline) {
  return `
  <div class="camada" style="display:flex; flex-direction:column; justify-content:flex-start; align-items:center; padding-top:${Math.round(H * 0.628)}px;">
    <div style="width:800px; background:${C.amarelo}; color:${C.charcoal}; border-radius:24px;
                padding:28px 40px; font-weight:800; font-size:58px; line-height:1.04;
                letter-spacing:-0.02em; text-align:center;">
      ${headline}
    </div>
  </div>`;
}

/**
 * Caixinha de pergunta do Instagram, no espaço acima da cabeça.
 *
 * O bruto foi gravado no formato de resposta a caixinha: ele olha para cima
 * durante a primeira fala. A imagem entra ali, na direção do olhar, e sai
 * quando ele volta o olhar para a câmera.
 *
 * A cabeça começa em 634px no plano de abertura, então a caixinha tem que
 * caber entre a safe zone (226px) e essa marca.
 */
const CX_PROPORCAO = 399 / 575;          // altura sobre largura da imagem original
const CX_CENTRO_Y = 451;                 // centro vertical que ficou definido no vídeo

function caixaPergunta(largura = 640, centroY = CX_CENTRO_Y, arquivo = 'cx-pergunta.png') {
  const b64 = fs.readFileSync(path.join(DIR, 'assets', arquivo)).toString('base64');
  // o topo é derivado do centro, para mudar a largura sem a caixinha subir ou descer
  const altura = Math.round(largura * CX_PROPORCAO);
  const topo = Math.round(centroY - altura / 2);
  return `
  <div class="camada" style="display:flex; justify-content:center; align-items:flex-start; padding-top:${topo}px;">
    <img src="data:image/png;base64,${b64}" style="width:${largura}px; height:auto;
         border-radius:18px; box-shadow:0 18px 50px rgba(0,0,0,0.45); display:block;" />
  </div>`;
}

/**
 * Pílula de palavra-chave: retângulo arredondado amarelo, caixa alta.
 * Fica acima da cabeça (16% da altura): em 30% caía sobre o rosto.
 * A safe zone do Reels começa em 226px (11.8%), então 16% é seguro.
 */
function pilula(texto, topoPct = 0.16) {
  return `
  <div class="camada" style="display:flex; justify-content:center; align-items:flex-start; padding-top:${Math.round(H * topoPct)}px;">
    <div style="background:${C.amarelo}; color:${C.charcoal}; border-radius:80px;
                padding:18px 44px; font-weight:800; font-size:44px; letter-spacing:0.04em;
                text-transform:uppercase; white-space:nowrap;">
      ${texto}
    </div>
  </div>`;
}

/**
 * Número de destaque sobre a imagem, no lugar da legenda.
 *
 * Substitui o card em tela cheia: cortar para uma tela separada tirava o Tiago
 * de cena bem no momento da prova. Aqui o número entra na frente dele, junto
 * com a fala: numeral grande em amarelo e o complemento logo abaixo, menor.
 *
 * Faixa vertical 975 a 1200px, dentro da safe zone e na região da legenda,
 * que é suprimida enquanto o número está no ar.
 */
function numeroDestaque(numero, complemento, topo = 960) {
  return `
  <div class="camada" style="display:flex; flex-direction:column; justify-content:flex-start;
              align-items:center; padding-top:${topo}px; gap:6px;">
    <div style="font-family:'ZalandoBlack'; font-size:150px; color:${C.amarelo};
                line-height:0.92; letter-spacing:-0.03em; text-align:center;
                text-shadow:0 6px 28px rgba(0,0,0,0.55);">
      ${numero}
    </div>
    <div style="font-family:'Zalando'; font-weight:800; font-size:52px; color:${C.branco};
                line-height:1.1; letter-spacing:0.01em; text-align:center; max-width:900px;
                text-shadow:0 3px 18px rgba(0,0,0,0.6);">
      ${complemento}
    </div>
  </div>`;
}

/**
 * Card de prova em tela cheia. Mantido no arquivo mas fora da lista de peças:
 * foi substituído pelos números sobre a imagem.
 */
function cardProva(itens) {
  const linhas = itens.map(i => `
    <div style="display:flex; flex-direction:column; align-items:center; gap:10px;">
      <div style="font-family:'ZalandoBlack'; font-size:132px; color:${C.amarelo}; line-height:0.92; letter-spacing:-0.03em;">${i.numero}</div>
      <div style="font-family:'InterLegenda'; font-weight:700; font-size:34px; color:${C.branco}; text-align:center; line-height:1.25; max-width:760px;">${i.rotulo}</div>
    </div>`).join('<div style="height:96px;"></div>');

  return `
  <div class="camada" style="background:${C.charcoal}; display:flex; flex-direction:column;
              justify-content:center; align-items:center; padding:0 110px;">
    ${linhas}
  </div>`;
}

/**
 * CTA de fecho: fica logo abaixo da legenda e aponta para baixo, na direção do
 * botão do anúncio. No topo do quadro ele lia como um rótulo solto, longe do
 * texto e apontando para lugar nenhum.
 *
 * Faixa vertical: 1207 a 1292px, entre a legenda (centro em 1152) e o limite
 * da safe zone (1302).
 */
function cta(texto, topo = 1207) {
  return `
  <div class="camada" style="display:flex; justify-content:center; align-items:flex-start; padding-top:${topo}px;">
    <div style="background:${C.amarelo}; color:${C.charcoal}; border-radius:80px;
                padding:16px 42px; font-weight:800; font-size:42px; letter-spacing:0.03em;
                text-transform:uppercase; white-space:nowrap; display:flex; align-items:center; gap:20px;">
      <span>${texto}</span>
      <span style="width:0; height:0; border-left:15px solid transparent;
                   border-right:15px solid transparent; border-top:20px solid ${C.charcoal};
                   display:block; margin-top:4px;"></span>
    </div>
  </div>`;
}

/**
 * As peças vêm da seção "pecas" do plano-visual.json da pasta do vídeo.
 * Cada uma declara um tipo e os campos que aquele tipo usa:
 *
 *   cartela  texto
 *   pilula   texto, topo_pct
 *   numero   numero, complemento, topo
 *   cta      texto, topo
 *   imagem   arquivo (em assets/), largura, centro_y
 */
/**
 * Citação em tela cheia: a frase que o vídeo está citando, grande, entre aspas.
 *
 * Serve para carimbar a fala de terceiro que a peça vai contestar ("os gurus
 * falam: saia do operacional"). Entra em duas partes para acompanhar a fala:
 * a primeira palavra bate junto com ela, o resto entra logo depois, e cada
 * entrada leva um clique no som.
 *
 * `parte` diz o que renderizar: "1" só o começo, "2" a frase inteira. Como o
 * segundo PNG contém o primeiro, basta trocar um pelo outro na linha do tempo.
 */
function citacao(inicio, resto, parte, topoPct = 0.06) {
  const cinza = 'rgba(255,255,255,0.35)';
  const visivel = parte === 2;
  return `
  <div class="camada" style="display:flex; flex-direction:column; justify-content:flex-start;
              align-items:center; padding:${Math.round(H * topoPct)}px 90px 0;">
    <div style="font-family:'ZalandoBlack'; font-size:82px; line-height:1.04; color:${C.branco};
                text-align:center; letter-spacing:-0.02em; text-transform:uppercase;
                text-shadow:0 6px 34px rgba(0,0,0,0.75);">
      <span style="color:${cinza};">&ldquo;</span>${inicio}${
        visivel ? ` ${resto}<span style="color:${cinza};">&rdquo;</span>` : ''
      }
    </div>
  </div>`;
}

/**
 * Passo numerado: o numeral grande em amarelo e o rótulo embaixo, para marcar
 * enumeração falada ("o segundo passo é...").
 */
function passo(numero, texto, topoPct = 0.05) {
  return `
  <div class="camada" style="display:flex; flex-direction:column; justify-content:flex-start;
              align-items:center; padding:${Math.round(H * topoPct)}px 90px 0; gap:10px;">
    <div style="font-family:'ZalandoBlack'; font-size:104px; line-height:0.9; color:${C.amarelo};
                letter-spacing:-0.04em; text-shadow:0 6px 30px rgba(0,0,0,0.6);">${numero}</div>
    <div style="font-family:'ZalandoBlack'; font-size:62px; line-height:1.06; color:${C.branco};
                text-align:center; text-transform:uppercase; letter-spacing:-0.015em;
                text-shadow:0 5px 28px rgba(0,0,0,0.7);">${texto}</div>
  </div>`;
}

const CONSTRUTORES = {
  cartela: p => cartela(p.texto),
  pilula: p => pilula(p.texto, p.topo_pct),
  numero: p => numeroDestaque(p.numero, p.complemento, p.topo),
  cta: p => cta(p.texto, p.topo),
  imagem: p => caixaPergunta(p.largura, p.centro_y, p.arquivo),
  citacao: p => citacao(p.inicio, p.resto, p.parte || 1, p.topo_pct),
  passo: p => passo(p.numero, p.texto, p.topo_pct)
};

const visual = ctx.lerJson('plano-visual.json');
const declaradas = visual.pecas || [];

if (!declaradas.length) {
  console.error('plano-visual.json não declara nenhuma peça em "pecas"');
  process.exit(1);
}

const PECAS = declaradas.map(p => {
  const construtor = CONSTRUTORES[p.tipo];
  if (!construtor) throw new Error(`tipo de peça desconhecido: ${p.tipo} (em ${p.nome})`);
  return { nome: p.nome, html: construtor(p) };
});

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--font-render-hinting=none'] });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });

  for (const p of PECAS) {
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${p.html}</body></html>`, { waitUntil: 'load' });
    await page.evaluateHandle('document.fonts.ready');
    const arquivo = path.join(OUT, `${p.nome}.png`);
    await page.screenshot({ path: arquivo, omitBackground: true });
    console.log(`  ${p.nome}.png`);
  }

  await browser.close();
  console.log(`\n[overlays] gerados em ${OUT}`);
})().catch(err => {
  console.error('[overlays] erro:', err.message);
  process.exit(1);
});
