// Lista a arvore de uma pasta do Drive: subpastas e arquivos, com tamanho e duracao.
// Uso: node .scripts/drive-arvore.js <folderId> [profundidade]
const { google } = require('googleapis');
const path = require('path');

const KEYFILE = path.join(__dirname, '..', 'google-service-account.json');
const PASTA = 'application/vnd.google-apps.folder';

async function main() {
  const [raiz, profArg] = process.argv.slice(2);
  const profMax = Number(profArg || 3);

  const auth = new google.auth.GoogleAuth({
    keyFile: KEYFILE,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  const drive = google.drive({ version: 'v3', auth });

  async function listar(id) {
    let token = null;
    let itens = [];
    do {
      const r = await drive.files.list({
        q: `'${id}' in parents and trashed = false`,
        fields: 'nextPageToken, files(id,name,size,mimeType,videoMediaMetadata)',
        pageSize: 200,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        pageToken: token,
        orderBy: 'name',
      });
      itens = itens.concat(r.data.files);
      token = r.data.nextPageToken;
    } while (token);
    return itens;
  }

  let totalBytes = 0;
  let totalArquivos = 0;

  async function andar(id, prof, prefixo) {
    if (prof > profMax) return;
    const itens = await listar(id);
    for (const f of itens) {
      if (f.mimeType === PASTA) {
        console.log(`${prefixo}[${f.name}]  ${f.id}`);
        await andar(f.id, prof + 1, prefixo + '  ');
      } else {
        const mb = Number(f.size || 0) / 1048576;
        totalBytes += Number(f.size || 0);
        totalArquivos++;
        const v = f.videoMediaMetadata || {};
        const dim = v.width ? `${v.width}x${v.height}` : '';
        const dur = v.durationMillis ? `${(v.durationMillis / 1000).toFixed(1)}s` : '';
        console.log(`${prefixo}${f.name}\t${f.id}\t${mb.toFixed(0)}MB\t${dim}\t${dur}`);
      }
    }
  }

  await andar(raiz, 0, '');
  console.log(`\nTOTAL: ${totalArquivos} arquivos, ${(totalBytes / 1073741824).toFixed(1)} GB`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
