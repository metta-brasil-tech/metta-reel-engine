/**
 * baixar-trilhas.js - Baixa as trilhas aprovadas do Mixkit.
 *
 * Os arquivos não ficam no repositório: a licença free do Mixkit permite usar
 * a música em anúncio comercial, mas proíbe redistribuir os arquivos. Então o
 * repositório guarda a lista e o critério, e o download é feito por quem for
 * usar, direto da fonte.
 *
 * Uso: node scripts/baixar-trilhas.js [pasta-destino]
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const APROVADAS = [
  { id: 267, nome: 'em uso nas duas peças', banda: '5,4%' },
  { id: 723, nome: 'Other World', banda: '5,6%' },
  { id: 282, nome: 'Sweet September', banda: '6,9%' },
  { id: 281, nome: 'hip hop, família da 267', banda: '6,9%' },
  { id: 400, nome: 'hip hop, 99 BPM', banda: '8,0%' },
  { id: 685, nome: 'R&B vibes 1', banda: '9,5%' }
];

const destino = path.resolve(process.argv[2] || 'trilhas');
if (!fs.existsSync(destino)) fs.mkdirSync(destino, { recursive: true });

function baixar(url, arquivo) {
  return new Promise((ok, falha) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return baixar(res.headers.location, arquivo).then(ok, falha);
      }
      if (res.statusCode !== 200) return falha(new Error(`HTTP ${res.statusCode}`));
      const saida = fs.createWriteStream(arquivo);
      res.pipe(saida);
      saida.on('finish', () => saida.close(() => ok()));
    });
    req.on('error', falha);
    req.setTimeout(60000, () => req.destroy(new Error('tempo esgotado')));
  });
}

(async () => {
  console.log(`baixando ${APROVADAS.length} trilhas para ${destino}\n`);
  for (const t of APROVADAS) {
    const arquivo = path.join(destino, `mix-${t.id}.mp3`);
    if (fs.existsSync(arquivo)) { console.log(`  mix-${t.id}  já existe`); continue; }
    try {
      await baixar(`https://assets.mixkit.co/music/${t.id}/${t.id}.mp3`, arquivo);
      const mb = (fs.statSync(arquivo).size / 1048576).toFixed(1);
      console.log(`  mix-${String(t.id).padEnd(4)} ${mb.padStart(4)} MB  ${t.banda.padStart(5)} na banda da voz  ${t.nome}`);
    } catch (e) {
      console.log(`  mix-${t.id}  falhou: ${e.message}`);
    }
  }
  console.log('\nlicença: https://mixkit.co/license/ (uso comercial livre, redistribuição proibida)');
  console.log('critério de escolha e faixas reprovadas: docs/trilhas.md');
})();
