# Motor de vídeo Metta

Três pipelines de edição vertical 9:16, por linha de comando. Nenhum deles abre
editor gráfico: tudo roda em ffmpeg e o resultado é conferido por medição.

| Pipeline | Entra | Sai | O corte se ancora em |
|---|---|---|---|
| **Reel** (`engine/`) | bruto de câmera com fala | reel com legenda, grafismo, efeito e trilha | a fala, transcrita palavra a palavra |
| **Institucional** (`engine/institucional/`) | vários clipes de B-roll | montagem com música, sem locução | a batida da trilha |
| **Criativos** (`engine/criativos/`) | bruto de anúncio, um por peça | anúncio vertical com legenda, pílula de CTA e cor | a fala, com a decupagem revisada por ouvido |

O pipeline de criativos é o de reel embalado em um comando só, para produzir lote.
Está documentado em **[docs/criativos.md](docs/criativos.md)**, junto com o DNA de
edição medido nas peças do editor da casa e a lista de armadilhas que a produção
de 10 anúncios revelou.

São separados porque o problema é diferente. No reel, a transcrição diz onde a frase
começa e termina, e a decupagem nasce daí. No institucional não há fala nenhuma para
ancorar nada, então quem manda no ponto de emenda é a grade rítmica da música, e o
material é escolhido por olho, registrado num catálogo de janelas.

Institucional em **[docs/institucional.md](docs/institucional.md)**, criativos em **[docs/criativos.md](docs/criativos.md)**.
O resto deste README trata do reel.

Feito para rodar dentro do **Claude Code**: os scripts fazem o trabalho pesado e
determinístico, e o Claude faz a leitura do material e as decisões editoriais.
Também funciona sozinho, chamando os scripts na mão.

Duas peças de reel foram produzidas com ele. A segunda levou **21 minutos** de ponta a
ponta, dos quais 8 foram só transcrição. No institucional, três peças de 55s saíram de
76 clipes de reunião, com a curadoria feita em lote sobre folhas de contato.

## Antes de tudo

```bash
npm install
node scripts/checar-ambiente.js
```

O verificador testa Node, ffmpeg, os filtros específicos que o motor usa, as fontes e o
whisper, e diz exatamente o que fazer com cada coisa que faltar.

---

# Motor de reel

> **Abra uma sessão nova do Claude Code para cada peça.** É a medida de maior
> efeito no custo e não custa nada. Medido na segunda peça: cada uma das 78
> chamadas ao modelo carregou 611.620 tokens de contexto, dos quais 586.797 já
> existiam antes de o vídeo entrar em pauta. 96% do que foi relido 78 vezes não
> tinha relação com o vídeo. A conta inteira está em §11 do `docs/playbook.md`.

---

## O que você precisa instalar

O motor não reimplementa nada de mídia: ele orquestra quatro ferramentas.

| Ferramenta | Para quê | Como instalar (Windows) |
|---|---|---|
| **Node 18+** | roda os scripts | [nodejs.org](https://nodejs.org) |
| **FFmpeg** | corte, filtro, mixagem | `winget install Gyan.FFmpeg` |
| **whisper.cpp** | transcrição local, sem custo | ver abaixo |
| **yt-dlp** (opcional) | baixar bruto de URL | `winget install yt-dlp.yt-dlp` |

### whisper.cpp

É o único passo chato. Precisa do binário e do modelo `medium` em português.

```bash
# a forma mais simples é pelo pacote do Remotion, que baixa e compila
npm i -g @remotion/install-whisper-cpp
node -e "const w=require('@remotion/install-whisper-cpp'); w.installWhisperCpp({to:'C:/whisper-cpp',version:'1.5.5'}).then(()=>w.downloadWhisperModel({model:'medium',folder:'C:/whisper-cpp'}))"
```

O modelo tem cerca de 1,5 GB e só é baixado uma vez. Se instalar em outro lugar,
aponte com a variável `WHISPER_DIR`.

### Depois

```bash
git clone <este repositório>
cd metta-reel-engine
npm install
node scripts/baixar-trilhas.js trilhas    # baixa as 6 trilhas aprovadas
```

---

## Como usar

Cada peça tem uma pasta de trabalho. O motor nunca é copiado para ela: só
configuração e mídia ficam lá.

```bash
D=work/MINHA-PECA
mkdir -p $D
```

### 1. Preparar

```bash
node engine/preparar.js --dir $D --bruto "C:/caminho/BRUTO.MP4" --preset caixinha-pergunta
```

Lê o bruto, descobre onde a fala começa de fato (ignorando claquete e direção
fora do microfone), e transcreve palavra por palavra. Leva alguns minutos.

### 2. Decidir o que sai

Abra `$D/decupagem-config.json` e escreva os descartes. Três formas:

```jsonc
"descartes": [
  { "ate": 38.0, "motivo": "pré-produção e claquete" },          // por tempo
  { "chave": "se der certo", "motivo": "alonga sem acrescentar" } // por texto
],
"cortes_internos": [
  { "de": 97.0, "ate": 99.63, "motivo": "frase recomeçada" }      // pedaço de dentro da fala
]
```

Depois:

```bash
node engine/decupar.js --dir $D --offset <offset_transcricao>
```

### 3. Aprovar

**Pare aqui e assista.** Decidir o que sai do vídeo é curadoria, não
processamento. Só depois:

```bash
node engine/montar.js --dir $D --base
node engine/verificar.js --dir $D
```

O verificador confere que nenhuma emenda comeu fala. Não pule.

### 4. Legenda

A base cortada precisa ser transcrita **de novo**: depois de tirar trechos do
meio, todo timestamp mudou.

```bash
ffmpeg -i $D/tmp/base.mp4 -ar 16000 -ac 1 -y $D/tmp/base.wav
C:/whisper-cpp/main.exe -m C:/whisper-cpp/ggml-medium.bin -l pt -f $D/tmp/base.wav -oj -of $D/base_tr -ml 1
node engine/legendar.js --dir $D
```

### 5. Grafismo, efeito e acabamento

```bash
node engine/overlays.js --dir $D
node engine/sfx.js --dir $D --fonte $D/sfx/origem.wav
node engine/montar.js --dir $D --acabamento --out $D/final.mp4
```

### 6. Conferir

```bash
node engine/conferir.js --dir $D
```

Confere o entregável por medição, sem abrir frame: formato, loudness, quadro
preto, cada overlay declarado e a posição da legenda. A checagem de overlay
amostra os pixels opacos do PNG e compara com a coordenada equivalente no vídeo,
então pega peça que não entrou mesmo quando outra peça amarela está no ar
(medido: presente rende 95 a 100% de acerto, ausente rende 3 a 6%).

Quando faltar julgamento visual mesmo, tipo enquadramento e expressão:

```bash
node engine/conferir.js --dir $D --folha 1.5,12,25,40
```

Monta um contact sheet a 190px por frame. Editando dentro do Claude, frame é o
item mais caro do pipeline: uma imagem lida cedo é reenviada em toda chamada
seguinte, e três delas viraram 2,3 milhões de tokens numa peça só.

---

## A pasta de uma peça

```
work/MINHA-PECA/
  decupagem-config.json   o que sai e por quê      (você escreve)
  decupagem.json          os cortes calculados     (decupar.js escreve)
  plano-visual.json       escala de plano, peças, efeito, trilha
  estilo-reel.json        cores, fontes, métricas  (copie de exemplo/)
  assets/                 imagens usadas em overlay
  musica/                 a trilha escolhida
  sfx/origem.wav          o som de zoom, um só (o motor gera os dois sentidos)
```

---

## Leia antes de editar

**`docs/playbook.md`** é a parte que mais vale. Traz o método, os números já
calibrados e as armadilhas que custaram remontagem: por que um limiar de silêncio
não basta, por que o tamanho da legenda é calibração e não conta, por que overlay
de PNG precisa de `-loop 1`.

- `docs/skill-editar-video.md` — a skill do Claude Code que orquestra o fluxo
- `docs/dna-edicao.md` — o padrão visual medido em peças de referência
- `docs/trilhas.md` — o critério para escolher trilha e as faixas já medidas

---

## Rodando dentro do Claude Code

Dois arquivos entram na sua instalação do Claude, não no projeto:

```bash
cp docs/skill-editar-video.md ~/.claude/commands/editar-video.md
cp agents/video-mecanico.md   ~/.claude/agents/video-mecanico.md
```

A skill vira o comando `/editar-video` e orquestra o fluxo. O subagent
`video-mecanico` (Haiku) roda as fases mecânicas com contexto próprio, que é de
onde vem a economia: as mesmas vinte chamadas custam US$ 6,11 arrastando o
histórico da sessão e US$ 0,06 num subagent limpo. Trocar o modelo, sozinho,
economizaria bem menos.

A divisão é simples: **se a etapa produz um arquivo a partir de um JSON que já
existe, é mecânica e vai para o subagent.** Se ela escreve o JSON (o que cortar,
o que a legenda diz, qual trilha), é editorial e fica na sessão principal. A
tabela completa está em §11.3 do playbook.

A skill traz regras de marca da Metta. Adapte o §10 ("regras invioláveis") para
a sua operação; o resto do fluxo é agnóstico.

---

## Bancada

Rodam uma vez, entregam um número e alimentam o playbook.

```bash
node engine/medir-legenda.js  --dir $D 15.2      # altura real da legenda
node engine/calibrar-sfx.js   --dir $D 0.35 0.7  # volume do efeito
node engine/avaliar-musica.js trilhas            # trilha que cabe sob a voz
```

---

## Licenças

**Fontes** (`engine/fonts/`): Inter e Zalando Sans Expanded, ambas sob
[SIL Open Font License 1.1](https://openfontlicense.org). Redistribuíveis. Os
arquivos Inter foram renomeados para `Inter Legenda` porque o libass não
instancia eixo variável, e a OFL exige nome distinto para versão modificada.

**Trilhas**: não estão no repositório. A licença free do
[Mixkit](https://mixkit.co/license/) permite usar em anúncio comercial sem
atribuição, mas **proíbe redistribuir os arquivos**. Por isso o repositório
guarda a lista, a medição e o critério, e o download é feito da fonte por
`scripts/baixar-trilhas.js`.

**Vídeos e material de marca** não vão para cá. O `.gitignore` bloqueia mídia.
