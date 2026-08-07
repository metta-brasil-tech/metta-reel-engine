// Baixa todos os arquivos de uma pasta do Drive em paralelo, direto pra disco.
// Uso: node .scripts/drive-baixar-pasta.js <folderId> <pastaDestino> [concorrencia]
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const KEYFILE = path.join(__dirname, '..', 'google-service-account.json');

async function main() {
  const [folderId, destino, conc] = process.argv.slice(2);
  if (!folderId || !destino) {
    console.error('uso: node drive-baixar-pasta.js <folderId> <destino> [concorrencia]');
    process.exit(1);
  }
  const paralelo = Number(conc || 4);

  const auth = new google.auth.GoogleAuth({
    keyFile: KEYFILE,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  const drive = google.drive({ version: 'v3', auth });

  let token = null;
  let arquivos = [];
  do {
    const r = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id,name,size)',
      pageSize: 200,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      pageToken: token,
    });
    arquivos = arquivos.concat(r.data.files);
    token = r.data.nextPageToken;
  } while (token);

  arquivos.sort((a, b) => a.name.localeCompare(b.name));
  fs.mkdirSync(destino, { recursive: true });

  // pula o que ja esta em disco com o tamanho certo
  const pendentes = arquivos.filter((f) => {
    const alvo = path.join(destino, f.name);
    if (!fs.existsSync(alvo)) return true;
    return fs.statSync(alvo).size !== Number(f.size || 0);
  });

  const total = pendentes.reduce((s, f) => s + Number(f.size || 0), 0);
  console.log(`[drive] ${pendentes.length} de ${arquivos.length} pendentes, ${(total / 1073741824).toFixed(1)} GB`);

  let indice = 0;
  let prontos = 0;

  async function baixarUm(f) {
    const alvo = path.join(destino, f.name);
    const parcial = alvo + '.parcial';
    const res = await drive.files.get(
      { fileId: f.id, alt: 'media', supportsAllDrives: true },
      { responseType: 'stream' }
    );
    await new Promise((resolve, reject) => {
      const out = fs.createWriteStream(parcial);
      res.data.on('error', reject);
      out.on('error', reject);
      out.on('finish', resolve);
      res.data.pipe(out);
    });
    fs.renameSync(parcial, alvo);
    prontos++;
    console.log(`[${prontos}/${pendentes.length}] ${f.name} ${(Number(f.size || 0) / 1048576).toFixed(0)}MB`);
  }

  async function worker() {
    while (indice < pendentes.length) {
      const f = pendentes[indice++];
      try {
        await baixarUm(f);
      } catch (e) {
        console.error(`[falha] ${f.name}: ${e.message}`);
      }
    }
  }

  await Promise.all(Array.from({ length: paralelo }, worker));
  console.log('[drive] concluido');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
