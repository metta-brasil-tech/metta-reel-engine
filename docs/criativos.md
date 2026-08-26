# Entrega — Lote de criativos verticais

Anúncios verticais editados a partir de bruto de câmera, um criativo por pasta do Drive.
Pasta de trabalho: `video/work/criativos/`. Saída: `video/output/criativos/`.

## 1. O material

10 criativos, 12,6 GB. Sete gravados em vertical nativo (2160×3840 com rotação 90) e três em horizontal 16:9: `improvisado`, `ex-vendedores` e `varejo-copy-1`.

A orientação não aparece no `width`/`height` do ffprobe, porque a câmera grava sempre 3840×2160 e marca `rotation=90` nos verticais. Ler só as dimensões faz o pipeline montar o recorte errado.

## 2. Referência de estilo

O DNA foi extraído por medição de 4 peças finalizadas pelo editor da casa, não por descrição. Documento completo em `video/work/criativos/_ref/DNA-EDITOR.md`. O que governa a edição:

| Item | Valor medido |
|---|---|
| Legenda | Inter Bold, corpo 57px, branco, sombra difusa sem contorno nem caixa |
| Fatiamento | 1 linha, 2 a 4 palavras, troca a cada 0,7s, corte seco |
| Karaokê | não existe: zero pixel amarelo na faixa da legenda nas 4 peças |
| Altura da legenda | varia por peça entre 55,3% e 67,2%, fixa dentro da peça |
| Corte | jump cut a cada 2,6 a 3,3s, 3 escalas de recorte do mesmo bruto |
| Primeiro corte | só entre 4,0 e 4,8s |
| Trilha e SFX | **não usa nenhum dos dois** |
| Loudness | -15,5 LUFS, pico real abaixo de -0,3 dBTP |
| Pílula de CTA | 4 de 4 peças, amarelo #FFC531, últimos 4 a 9s |
| Cor | preto ancorado em 0, branco até 253, meios-tons quentes |
| Fecho | sem logo, sem vinheta, sem cartela: termina no apresentador com o CTA |

### Onde não segui o DNA, e por quê

**Saturação.** As referências medem SATAVG entre 21 e 31. Estas peças param em 13 a 17. Chegar ao número exigiria saturação 1,80, que deixa a pele alaranjada, comparado lado a lado. O índice mede o quadro inteiro, e o cenário destes criativos é uma sala neutra, então o alvo não se transfere. A saturação saiu dos critérios de falha do verificador de cor e ficou só como registro de deriva.

## 3. O pipeline

`.scripts/criativo-pipeline.sh <slug> <offset>` roda sete passos, da decupagem ao entregável colorido. Antes dele, duas coisas dependem de julgamento e ficam na mão de quem edita: achar o gancho e decidir o que descartar.

```
1. decupagem        corta pela fala, em fronteira real de palavra
2. base cortada     aplica a escala de plano de cada segmento
3. verificação      mede se algum corte comeu fala
4. transcrição      re-transcreve a base, para a legenda seguir o tempo já cortado
5. legenda          2 a 4 palavras por vez, com as correções da peça
6. acabamento       legenda, pílula de CTA e loudness
7. cor              grade medida, com conferência antes e depois
```

O passo 4 existe porque legenda gerada sobre o tempo do bruto dessincroniza assim que o primeiro corte entra.

### Peças novas escritas para este lote

| Script | Por quê |
|---|---|
| `.scripts/normalizar-vertical.js` | recorta 9:16 dos brutos horizontais, centrado no rosto e não no centro do quadro, antes do pipeline |
| `.scripts/reel/cor.js` | o motor não tinha tratamento de cor; mede antes e depois e avisa se sair da faixa |
| `.scripts/drive-arvore.js` | lista a árvore de pastas do Drive com tamanho, dimensão e duração |

Duas mudanças pequenas no motor, ambas retrocompatíveis: o alvo de loudness passou a vir do plano da peça (`audio.lufs`, padrão -14), e o bloco de efeito sonoro virou opcional, porque as peças do editor não usam.

## 4. Garantia contra fala atropelada

Era a exigência explícita do pedido, e é resolvida em duas camadas.

O corte nunca cai em timestamp de segmento do whisper, que é aproximado. Cada fronteira é uma fronteira real de palavra, cruzada com a energia do áudio, com dois limiares: -38 dB decide o que é pausa longa a apertar, -50 dB decide onde a fala de fato acaba. O segundo limiar existe porque palavra sussurrada vive a -40 dB e um limiar único a classificaria como silêncio.

Depois, `verificar.js` remede a base e responde duas coisas: se toda emenda caiu em silêncio, e se alguma palavra da transcrição original sumiu.

**Ele produz falso positivo** quando o whisper ouve diferente nas duas passadas. No `varejo-copy-3` acusou 5 palavras sumidas no fecho; a fala estava inteira, e a divergência era "Vem fazer parte" contra "Venha fazer parte". Toda acusação do verificador precisa ser conferida transcrevendo o trecho, não tratada como falha automática.

## 5. As peças

| Criativo | Bruto | Final | Gancho | Corte editorial |
|---|---|---|---|---|
| varejo-copy-3 | 55,6s | 36,7s | "Hoje está muito fácil ficar rico na internet" | nenhum, só pausas |
| improvisado | 71,1s (16:9) | 53,6s | "Os gurus falam: saia do operacional" | fecho redundante, 7,6s |
| jesus-liderar-2 | 73,6s | 62,6s | "Olha só, método de Jesus de liderar" | nenhum |
| varejo-copy-3-alt | 72,1s | 49,9s | "Todo dia na sua timeline do Instagram" | take falho, 5,3s |

### Correções de legenda que a transcrição exigiu

Sem elas o erro vai queimado na tela:

- `Thiago` para **Tiago**, o nome do apresentador
- `posto de piranga` para **Posto Ipiranga**
- `sabe a mais` e `seba mais` para **saiba mais**
- `sai a do operacional` para **saia do operacional**

## 6. Armadilhas deste lote

- **Rotação não está nas dimensões.** `rotation=90` distingue vertical de horizontal; `width`/`height` não.
- **`head` em pipe mata download.** `node drive-download.js | head -1` fecha o pipe, o processo morre por SIGPIPE e o arquivo fica truncado sem erro visível. Redirecione para arquivo.
- **A decupagem guarda o caminho da fonte.** Trocar o bruto no `decupagem-config.json` não basta: é preciso rodar `decupar.js` de novo, senão a montagem continua lendo o arquivo antigo.
- **`estilo-reel.json` é obrigatório** e não é gerado pelo `preparar.js`. O pipeline agora copia se faltar.
