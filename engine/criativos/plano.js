/**
 * criativo-plano.js - Gera o plano-visual.json de um criativo a partir da
 * decupagem ja pronta e de um arquivo de peca com as decisoes editoriais.
 *
 * O que e decisao (gancho, chaves, correcoes, trilha) vem do arquivo de peca.
 * O que e mecanico (alternar escala, achar o segmento de CTA, calcular quanto
 * tempo a pilula fica no ar) sai daqui.
 *
 * Uso: node .scripts/criativo-plano.js <slug>
 * Espera: video/<slug>/peca.json
 */
const fs = require('fs');
const path = require('path');

const slug = process.argv[2];
if (!slug) { console.error('uso: node criativo-plano.js <slug>'); process.exit(1); }

const D = path.join('video', slug);
const peca = JSON.parse(fs.readFileSync(path.join(D, 'peca.json'), 'utf8'));
const d = JSON.parse(fs.readFileSync(path.join(D, 'decupagem.json'), 'utf8'));
const segs = Array.isArray(d) ? d : (d.segmentos || d);

// Escala alterna a cada corte dentro do mesmo papel: camera fixa, jump cut
// aparente se dois planos seguidos tiverem o mesmo recorte.
const FAIXA = { aberto: 1.12, fechado: 1.26 };
const TETO = peca.teto_zoom || 1.30;

const zoom = {};
const contador = {};
segs.forEach((s) => {
  const p = s.papel || 'corpo';
  contador[p] = contador[p] || 0;
  // papel de peso entra mais fechado ja na primeira aparicao
  const pesado = ['virada', 'reforco', 'ponte', 'picaretagem'].includes(p);
  const base = contador[p] % 2 === (pesado ? 1 : 0) ? FAIXA.aberto : FAIXA.fechado;
  zoom[String(s.id)] = {
    de: +Math.min(base, TETO).toFixed(2),
    papel: `${p}: ${s.texto.slice(0, 45)}`,
  };
  contador[p]++;
});

// A pilula acompanha a fala do CTA ate o fim da peca. As referencias mostram
// entre 4 e 9s; quando o CTA falado e muito curto, ela recua um segmento por
// vez ate ter presenca suficiente para ser lida.
const MIN_PILULA = 4.0;
const MAX_PILULA = 9.0;
const inicios = [];
let t = 0;
for (const s of segs) { inicios.push({ id: s.id, papel: s.papel, t }); t += s.ate - s.de; }

let idx = inicios.findIndex((x) => x.papel === 'cta');
if (idx === -1) idx = inicios.length - 1;
// recua enquanto a pilula ficar curta demais para ser lida
while (t - inicios[idx].t < MIN_PILULA && idx > 0) idx--;
// e avanca se o CTA falado comecar cedo demais e ela passar do tempo das referencias
while (t - inicios[idx].t > MAX_PILULA && idx < inicios.length - 1
       && t - inicios[idx + 1].t >= MIN_PILULA) idx++;
const alvo = inicios[idx];
const duracaoPilula = +(t - alvo.t).toFixed(2);
const cta = { id: alvo.id };

const plano = {
  _nota: 'Escala alterna a cada corte para disfarcar o jump cut de camera fixa.',
  _duracao_prevista: +t.toFixed(2),
  olhos_y_bruto_pct: peca.olhos_y || 0.32,
  olhos_y_alvo_pct: 0.33,
  zoom_por_segmento: zoom,
  legenda: {
    chaves: peca.chaves || [],
    correcoes: peca.correcoes || [],
    remover: peca.remover || [],
  },
  pecas: [{ nome: 'pilula-cta', tipo: 'cta', texto: peca.cta || 'Clique em saiba mais' }],
  overlays: [{
    arquivo: 'pilula-cta.png',
    segmento_inicio: cta ? cta.id : segs[segs.length - 1].id,
    duracao: duracaoPilula,
    fade: 0.2,
  }],
  audio: { lufs: -15.5, _medido: 'as referencias do editor medem -15,5 LUFS' },
};

// Trilha e opcional. Quando entra, entra baixa: e cama, nao acompanhamento.
// O ducking abre espaco para a voz, que continua sendo quem carrega o anuncio.
if (peca.musica) {
  plano.musica = {
    arquivo: peca.musica.arquivo,
    inicio: peca.musica.inicio || 0,
    volume: peca.musica.volume || 0.06,
    _volume: 'cama leve. O editor da casa nao usa trilha, entao este numero nao vem do DNA: veio de medir a peca pronta e conferir que a voz nao disputa.',
    fade_in: 0.4,
    fade_out: 2,
    ducking: { threshold: 0.03, ratio: 10, attack: 20, release: 300 },
  };
}

fs.writeFileSync(path.join(D, 'plano-visual.json'), JSON.stringify(plano, null, 2));
console.log(`${slug}: ${segs.length} segs, ${t.toFixed(1)}s, pilula ${duracaoPilula}s${peca.musica ? ', trilha ' + peca.musica.arquivo : ''}`);
