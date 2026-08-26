#!/usr/bin/env bash
# Roda o pipeline de um criativo do corte ao entregavel colorido.
# Uso: bash .scripts/criativo-pipeline.sh <slug> <offset>
#
# Pressupoe que ja existem na pasta do criativo:
#   decupagem-config.json (com descartes e papeis)  plano-visual.json
# Ou seja: as decisoes editoriais ja foram tomadas. Daqui pra frente e mecanico.
set -e
cd "$(dirname "$0")/../.."

SLUG="$1"
OFFSET="$2"
D="video/$SLUG"
LOG="$D/pipeline.log"
: > "$LOG"

passo() { echo "[$SLUG] $1" | tee -a "$LOG"; }

# o estilo e o mesmo para toda a marca: copia se a pasta ainda nao tiver
[ -f "$D/estilo-reel.json" ] || cp exemplo/estilo-reel.json "$D/"

passo "1/8 decupagem"
node engine/decupar.js --dir "$D" --offset "$OFFSET" >> "$LOG" 2>&1

passo "2/8 base cortada"
node engine/montar.js --dir "$D" --base >> "$LOG" 2>&1

passo "3/8 verificando corte que come fala"
node engine/verificar.js --dir "$D" >> "$LOG" 2>&1 || echo "[$SLUG] verificador acusou, ver $LOG" | tee -a "$LOG"

passo "4/8 transcrevendo a base"
ffmpeg -i "$D/tmp/base.mp4" -ar 16000 -ac 1 -y "$D/tmp/base.wav" -v error
# O modelo medium pede 1,5 GB so para carregar. Quando a maquina esta apertada
# ele falha na alocacao e o pipeline morre no meio, deixando o final antigo em
# disco: parece que rodou, mas nao rodou. Cai para o small e segue, avisando.
if ! C:/whisper-cpp/main.exe -m C:/whisper-cpp/ggml-medium.bin -l pt -f "$D/tmp/base.wav" -oj -of "$D/base_tr" -ml 1 >> "$LOG" 2>&1; then
  passo "     medium falhou (provavel falta de memoria), tentando o modelo small"
  C:/whisper-cpp/main.exe -m C:/whisper-cpp/ggml-small.bin -l pt -f "$D/tmp/base.wav" -oj -of "$D/base_tr" -ml 1 >> "$LOG" 2>&1
fi
if [ ! -s "$D/base_tr.json" ]; then
  passo "ABORTADO: sem transcricao da base, a legenda sairia fora de sincronia"
  exit 1
fi

passo "5/8 legenda"
node engine/legendar.js --dir "$D" --tr "$D/base_tr.json" >> "$LOG" 2>&1

passo "6/8 pecas graficas"
# gera a pilula de CTA e demais pecas declaradas em plano-visual.pecas.
# Roda sozinho: dois puppeteer em paralelo se atropelam e a peca sai vazia.
if node -e "const v=require('./$D/plano-visual.json');process.exit(v.pecas&&v.pecas.length?0:1)" 2>/dev/null; then
  node engine/overlays.js --dir "$D" >> "$LOG" 2>&1
fi

passo "7/8 acabamento"
node engine/montar.js --dir "$D" --acabamento --out "$D/final-sem-cor.mp4" >> "$LOG" 2>&1

passo "8/8 tratamento de cor"
node engine/cor.js "$D/final-sem-cor.mp4" "$D/final.mp4" >> "$LOG" 2>&1

DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$D/final.mp4")
passo "pronto: ${DUR}s"
