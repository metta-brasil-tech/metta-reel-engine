# Pipeline institucional

Montagem de B-roll sem locução, cortada na batida da trilha. É o segundo pipeline do motor, e existe porque o problema é diferente do reel.

No reel há fala para ancorar o corte: a transcrição diz onde a frase começa e termina, e a decupagem nasce daí. Num institucional de B-roll não há fala nenhuma. Quem define o ponto de emenda é a música, e o material é escolhido por olho, não por texto.

Os scripts ficam em `engine/institucional/`.

---

## As duas metades

O pipeline cruza duas coisas que se produzem em separado.

**A grade rítmica** sai da trilha, medida por `batidas.js`. Ela dá o andamento, onde está cada batida e como a energia se distribui ao longo da faixa, o que revela onde a música abre e onde recolhe.

**O acervo de janelas** sai da curadoria. Cada clipe é reduzido a uma folha de contato, alguém olha e registra quais trechos valem e por quê. Esse é o passo que decide a qualidade da peça, e é o único que não dá para automatizar sem perder.

Um **roteiro** descreve a peça em blocos, no formato "aqui entram 10 planos de um compasso cada, com gente escutando". O decupador resolve quais janelas ocupam quais slots.

A consequência prática: mudar o ritmo da peça inteira é mudar um número no roteiro e rodar de novo. Não se mexe em código nem se refaz curadoria.

---

## Fluxo

```bash
D=video/minha-peca
mkdir -p $D/source

# 1. bruto para $D/source, do Drive ou na mão
node scripts/baixar-pasta-drive.js <ID_DA_PASTA> "$PWD/$D/source" 6

# 2. uma folha de contato por clipe, com o timestamp queimado em cada frame
node engine/institucional/folhas.js $D/source $D/folhas

# 3. CURADORIA: escrever $D/curadoria/catalogo.json a partir das folhas

# 4. grade rítmica da trilha
node engine/institucional/batidas.js trilhas/faixa.mp3 $D/grade.json

# 5. escrever o roteiro, copiando de exemplo/roteiro-institucional.json

# 6. encaixar as janelas na grade
node engine/institucional/decupar.js --dir $D --roteiro $D/roteiro.json --saida plano.json

# 7. APROVAÇÃO da decupagem, que sai legível em $D/plano.md

# 8. render
node engine/institucional/montar.js --dir $D --plano plano.json
```

`transcrever.js` é opcional e serve para os clipes longos, quando é preciso saber quem fala o quê para escolher as cenas.

---

## Passo 2, as folhas de contato

```bash
node engine/institucional/folhas.js <pastaSource> <pastaSaida>
```

Gera um JPG por clipe, com 6 a 12 frames lado a lado e o tempo em segundos queimado em cada um. É o que permite julgar 76 clipes sem abrir um player.

Grava também `indice.json`, com a duração real de cada clipe. **O decupador depende desse arquivo** e recusa rodar se faltar duração, porque sem saber o tamanho do clipe ele aceitaria cortes que passam do fim do material.

## Passo 3, a curadoria

O catálogo é o cérebro do pipeline. Um objeto por clipe:

```json
{
  "id": "C6898",
  "cena": "Mulher sorrindo e falando em mesa de reunião",
  "pessoas": "2, mulher de blazer branco em primeiro plano",
  "plano": "medio",
  "energia": "riso",
  "movimento": "camera parada",
  "especialista": "nao",
  "uso": "hero",
  "qualidade": 4,
  "melhores": [
    { "de": 1.6, "ate": 3.1, "porque": "sorriso abre em risada natural" }
  ],
  "obs": ""
}
```

| Campo | Valores | Para que serve |
|---|---|---|
| `plano` | primeirissimo, close, medio, conjunto, detalhe | filtro de bloco, e é o que permite montar escada de escala |
| `energia` | riso, conversa, concentracao, escuta, gesto, neutro | filtro de bloco, define o clima de cada trecho da peça |
| `especialista` | sim, provavel, nao, indeterminado | isola os planos de quem fala pela empresa |
| `uso` | hero, apoio, transicao, descartar | `descartar` sai do acervo inteiro |
| `melhores` | janelas de 0,8 a 2,5s | os trechos que de fato entram, com o motivo registrado |

`obs` é onde ficam os problemas: tela com dado interno, gesto que lê como cansaço, enquadramento cortando cabeça. Vale reler antes de montar.

**Conte as janelas antes de montar.** Uma peça de 55s consome de 40 a 50 planos. Três peças pedem cerca de 140 janelas distintas. Com menos que isso elas repetem trechos entre si, por aritmética, e nenhuma esperteza de algoritmo resolve. Numa produção de referência, 76 clipes de reunião renderam 99 janelas na primeira passada e 227 depois de uma segunda varredura só do que tinha sobrado.

O decupador aceita `--evitar plano-anterior.json`, quantas vezes for preciso, para penalizar o que já foi usado em outras peças. Penaliza, não proíbe: com material escasso, proibir travaria a montagem no meio.

## Passo 4, a grade

```bash
node engine/institucional/batidas.js <audio> [saida.json]
```

Devolve o andamento, a lista de batidas, grades prontas de corte a cada 1, 2, 4 e 8 batidas, e a energia média de cada compasso. Os compassos de energia baixa mostram onde a música respira, que é onde cabe uma cartela ou um plano longo; os cheios mostram onde o corte aguenta acelerar.

Para casar com uma faixa de BPM conhecido, dá para escrever a grade à mão em vez de medir:

```json
{ "bpm": 140, "periodo": 0.428571, "primeiraBatida": 0, "batidas": [0, 0.428571, 0.857142], "compassos": [] }
```

Isso é útil quando a peça sai muda e a música entra depois, em outro editor.

## Passo 5, o roteiro

Cada bloco diz quantos planos, de quantas batidas cada, e que material entra:

```json
{
  "nome": "riso",
  "_papel": "pico humano, cortes na metade do compasso",
  "batidas": 2, "planos": 4,
  "filtro": { "energia": "riso" },
  "alternativo": { "energia": ["riso", "conversa"] }
}
```

`batidas` multiplica o período da grade: a 140 BPM, 4 batidas dão um compasso de 1,71s e 1 batida dá 0,43s. `filtro` casa contra qualquer campo do catálogo, com valor único ou lista. `alternativo` é o filtro de segunda tentativa, e existe para a montagem não travar quando o principal esgota o material.

O roteiro aceita ainda `trilha`, `cartelas`, `marcas` (logo ou assinatura em PNG) e `bloquear`, que é a lista de clipes que não devem entrar de jeito nenhum.

Uma estrutura que funciona bem em 55s: um plano longo de respiro na intro, uma rajada de abertura fechando a escala do plano a cada corte, corpo a um plano por compasso, um pico curto, um bloco mais respirado, uma rajada final de um plano por batida e um fecho de dois planos longos.

## Passo 8, o render

```bash
node engine/institucional/montar.js --dir $D --plano plano.json [--base]
```

`--base` para só na emenda, sem cartela nem trilha, e serve para conferir a decupagem rápido.

O zoom é recorte, não ampliação: o bruto vertical 4K tem 2160 de largura contra 1080 da saída, então dá para fechar até 2,0x sem perder nitidez. `zoomAte` faz rampa dentro do plano.

---

## O que já custou caro

- **Arredondamento de quadro acumula.** A 140 BPM e 30 fps uma batida dá 12,857 quadros. Se cada plano arredondar a própria duração, o erro se soma: em 49 cortes a peça saiu 0,31s fora da batida, quase 10 quadros no fim. O montador calcula a fronteira de cada plano em quadros absolutos sobre a linha do tempo inteira, e o erro nunca passa de meio quadro.
- **Duração de clipe ausente não pode virar valor padrão.** Enquanto o decupador assumia duração generosa para clipe sem dado no índice, cortes passavam do fim do material e a parte saía mais curta que o slot, tirando o corte da batida sem avisar. Hoje falta de duração interrompe a execução.
- **`drawtext` não acha fonte por nome no Windows.** Vai o caminho do arquivo, com os dois-pontos escapados.
- **`-pattern_type glob` não existe** no build Windows do ffmpeg. Sequência numerada resolve.
- **`concat` resolve caminho relativo a partir do arquivo de lista.** Caminhos absolutos.
- **`overlay` não aceita alfa variável no tempo.** Para logo que entra e sai, o `fade` age no canal alfa do próprio PNG, com o stream em `-loop 1`.
- **Download do Drive aborta com muita concorrência.** Acima de 6 conexões as transferências começam a cair; arquivos acima de 1 GB só passam com 3.

---

## Licença de trilha

Faixa que viralizou em rede social costuma ser comercial e não estar em Epidemic, Artlist ou Envato. Usar o áudio pela biblioteca do próprio Instagram é um caminho, com catálogo restrito para conta comercial; qualquer uso fora dali pede licença de sincronização com o selo.

Uma saída prática: montar sobre uma faixa licenciada de BPM equivalente, ou entregar a peça muda cortada na grade do BPM da faixa desejada, para o áudio entrar na finalização.
