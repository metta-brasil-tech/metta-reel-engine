/**
 * criativo-galeria.js - Monta a pagina de revisao do lote de criativos.
 *
 * Cada peca aparece com o player ao lado do contexto necessario para julgar:
 * o gancho, quanto foi cortado e o motivo de cada corte. O feedback digitado
 * vai para o localStorage e pode ser copiado de uma vez.
 *
 * Uso: node .scripts/criativo-galeria.js <pastaDosVideos>
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const destino = process.argv[2];
if (!destino) { console.error('uso: node criativo-galeria.js <pastaDosVideos>'); process.exit(1); }

const dados = JSON.parse(fs.readFileSync('C:/tmp/gal.json', 'utf8'));

const TITULOS = {
  'varejo-copy-3': 'VAREJO COPY 3', 'improvisado': 'IMPROVISADO',
  'jesus-liderar-2': 'MÉTODO JESUS DE LIDERAR 2', 'varejo-copy-3-alt': 'VAREJO COPY 3 · ALTERNATIVA',
  'lula-ou-bolsonaro': 'LULA OU BOLSONARO', 'cansado-de-gurus': 'CANSADO DE GURUS',
  'anos-de-vida': 'ANOS DE VIDA', 'jesus-liderar-1': 'MÉTODO JESUS DE LIDERAR 1',
  'ex-vendedores': 'POR QUE EX-VENDEDORES FRACASSAM', 'varejo-copy-1': 'VAREJO COPY 1',
};
const RODADA2 = {
  'varejo-copy-3': 'fala errada "esse não êxodo" cortada',
  'improvisado': 'cartelas de citação, cliques e trilha ritmada',
  'jesus-liderar-2': 'sem feedback nesta rodada',
  'varejo-copy-3-alt': 'take falho removido, resposta recuperada',
  'lula-ou-bolsonaro': '"venha fazer parte" agora completo',
  'cansado-de-gurus': 'o "tá gente" removido',
  'anos-de-vida': 'gancho, premissa dos 75 anos e CTA recuperados',
  'jesus-liderar-1': 'refeito do zero: abre em "Você já refletiu?"',
  'ex-vendedores': '"gerir" repetido removido',
  'varejo-copy-1': 'refeito do zero: abre no gancho, sem trilha',
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const dur = (arq) => Number(execFileSync('ffprobe', [
  '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', arq,
]).toString().trim());

// carimbo de tempo no src: sem ele o navegador serve o mp4 antigo do cache e a
// revisao acontece em cima da versao errada
const v = Date.now();

const cards = dados.map((d, i) => {
  const arquivo = `metta-ad-${d.slug}.mp4`;
  const segundos = dur(path.join(destino, arquivo));
  const corte = Math.round((1 - segundos / d.bruto) * 100);
  const longo = segundos > 65;
  return `<article class="card" id="p${i + 1}">
  <div class="player"><video src="${arquivo}?v=${v}" controls preload="metadata"></video></div>
  <div class="info">
    <div class="topo"><span class="num">${String(i + 1).padStart(2, '0')}</span><h2>${TITULOS[d.slug]}</h2></div>
    <div class="rodada">${esc(RODADA2[d.slug])}</div>
    <div class="tags">
      <span class="tag">${d.bruto}s → <b>${segundos.toFixed(1)}s</b></span>
      <span class="tag forte">−${corte}%</span>
      <span class="tag">${d.segs} cortes</span>
      ${d.cartelas ? `<span class="tag">${d.cartelas} cartela(s)</span>` : ''}
      <span class="tag ${d.musica ? 'mus' : 'sem'}">${d.musica ? 'trilha ' + d.musica : 'sem trilha'}</span>
      ${longo ? '<span class="tag alerta">acima do alvo de 50s</span>' : ''}
    </div>
    <p class="gancho"><span>gancho</span>${esc(d.gancho)}</p>
    <details><summary>${d.decis.length} decisão(ões) de corte</summary><ul>
      ${d.decis.map((x) => `<li><code>${esc(x.j)}</code> <em>${x.t}</em> ${esc(x.m)}</li>`).join('')}
    </ul></details>
    ${d.corr.length ? `<details><summary>${d.corr.length} correção(ões) de legenda</summary><ul>${d.corr.map((c) => `<li><code>${esc(c)}</code></li>`).join('')}</ul></details>` : ''}
    <textarea placeholder="O que ajustar nesta peça..." data-slug="${d.slug}"></textarea>
  </div></article>`;
}).join('\n');

const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Anúncios Metta · revisão 2</title><style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0e0e10;color:#e8e8ea;font:16px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;padding:32px 20px 120px}
header{max-width:1180px;margin:0 auto 30px}
h1{font-size:26px;letter-spacing:-.02em;font-weight:800}
.sub{color:#9a9aa2;margin-top:7px;font-size:14px;max-width:760px}
.grid{max-width:1180px;margin:0 auto;display:flex;flex-direction:column;gap:22px}
.card{display:grid;grid-template-columns:270px 1fr;gap:22px;background:#17171a;border:1px solid #26262b;border-radius:14px;padding:18px}
.player video{width:270px;height:480px;border-radius:10px;background:#000;display:block;object-fit:contain}
.info{min-width:0;display:flex;flex-direction:column;gap:10px}
.topo{display:flex;align-items:baseline;gap:10px}
.num{color:#5a5a63;font-size:12px;font-weight:700;letter-spacing:.12em}
h2{font-size:19px;letter-spacing:-.01em;font-weight:700}
.rodada{font-size:12.5px;color:#e0b978;background:#2a2416;border:1px solid #4a3d1e;border-radius:6px;padding:4px 10px;align-self:flex-start}
.tags{display:flex;flex-wrap:wrap;gap:7px}
.tag{background:#232329;border:1px solid #303039;border-radius:100px;padding:3px 11px;font-size:12.5px;color:#b9b9c2}
.tag b{color:#fff}
.tag.forte{color:#8fd18f;border-color:#2f4630;background:#1c281d}
.tag.mus{border-color:#3a4a2e;background:#222a1c;color:#c3dba0}
.tag.sem{color:#77777f}
.tag.alerta{border-color:#5a4420;background:#2e2412;color:#e8b866}
.gancho{background:#1d1d21;border-left:3px solid #FFC531;border-radius:0 8px 8px 0;padding:10px 13px;font-size:14.5px}
.gancho span{display:block;font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:#8a8a93;margin-bottom:3px}
details{border-top:1px solid #26262b;padding-top:9px}
summary{cursor:pointer;font-size:13px;color:#9a9aa2;user-select:none}
summary:hover{color:#d5d5dc}
details ul{margin:9px 0 0 16px;display:flex;flex-direction:column;gap:8px}
details li{font-size:13px;color:#a8a8b1;line-height:1.5}
details em{color:#8a8a93;font-style:normal;font-size:11.5px;text-transform:uppercase;letter-spacing:.06em;margin-right:4px}
code{background:#232329;border-radius:4px;padding:1px 6px;font-size:12px;color:#e0b978;font-family:ui-monospace,Menlo,Consolas,monospace}
textarea{margin-top:auto;width:100%;min-height:62px;background:#101013;border:1px solid #2e2e36;border-radius:8px;color:#e8e8ea;padding:9px 11px;font:14px/1.5 inherit;resize:vertical}
textarea:focus{outline:none;border-color:#FFC531}
#barra{position:fixed;left:0;right:0;bottom:0;z-index:99;display:flex;align-items:center;gap:10px;background:#1b1b1f;border-top:1px solid #2e2e36;padding:11px 20px}
#status{flex:1;font-size:13px;color:#9a9aa2}
#barra button{background:#FFC531;color:#111;border:0;border-radius:7px;padding:8px 15px;font:600 13.5px inherit;cursor:pointer}
#barra button:hover{filter:brightness(1.08)}
#barra button.sec{background:#2a2a31;color:#9a9aa2}
@media(max-width:760px){.card{grid-template-columns:1fr}.player video{width:100%;height:auto;aspect-ratio:9/16}}
</style></head><body>
<header><h1>Anúncios Metta · revisão 2</h1>
<p class="sub">10 peças, verticais 1080×1920. As 9 correções do seu feedback foram aplicadas; o que mudou em cada uma está em amarelo. Cada corte tem o motivo registrado, para você conferir se concorda com a decisão.</p></header>
<div class="grid">${cards}</div>
<div id="barra">
  <span id="status">nada anotado ainda</span>
  <button onclick="copiar()">Copiar feedback</button>
  <button onclick="baixar()">Baixar .md</button>
  <button class="sec" onclick="if(confirm('Apagar todas as anotações?')){localStorage.removeItem(CHAVE);document.querySelectorAll('textarea').forEach(t=>t.value='');atualizar()}">Limpar</button>
</div>
<script>
// O feedback vive no localStorage: textarea sozinho nao guarda nada, e
// recarregar a pagina perdia tudo o que tinha sido escrito.
const CHAVE = 'metta-galeria-feedback-r2';
const salvos = JSON.parse(localStorage.getItem(CHAVE) || '{}');
const areas = [...document.querySelectorAll('textarea')];
areas.forEach(t => {
  if (salvos[t.dataset.slug]) t.value = salvos[t.dataset.slug];
  t.addEventListener('input', () => {
    const d = JSON.parse(localStorage.getItem(CHAVE) || '{}');
    if (t.value.trim()) d[t.dataset.slug] = t.value; else delete d[t.dataset.slug];
    localStorage.setItem(CHAVE, JSON.stringify(d));
    atualizar();
  });
});
const juntar = () => areas.filter(t => t.value.trim())
  .map(t => '### ' + t.dataset.slug + '\\n' + t.value.trim()).join('\\n\\n');
function atualizar() {
  const n = areas.filter(t => t.value.trim()).length;
  document.getElementById('status').textContent =
    n ? n + ' de 10 peças anotadas, salvo automaticamente' : 'nada anotado ainda';
}
function copiar() {
  const t = juntar();
  if (!t) return alert('Nada anotado ainda.');
  navigator.clipboard.writeText(t).then(() => alert('Copiado. Cole no chat.'),
    () => prompt('Copie manualmente:', t));
}
function baixar() {
  const t = juntar();
  if (!t) return alert('Nada anotado ainda.');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([t], {type:'text/markdown'}));
  a.download = 'feedback-r2.md'; a.click();
}
atualizar();
</script>
</body></html>`;

fs.writeFileSync(path.join(destino, 'galeria.html'), html, 'utf8');
console.log(`galeria com ${dados.length} peças em ${path.join(destino, 'galeria.html')}`);
