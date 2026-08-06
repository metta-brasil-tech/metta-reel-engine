---
title: "Playbook — Reel vertical editado (bruto de câmera para Reels)"
aliases:
  - "playbook-reel"
  - "Playbook de Reel"
  - "Como editar reel Metta"
tags:
  - marca/metta
  - marca/tiago
  - tema/video
  - tipo/playbook
  - tipo/instrucao
  - usado-por/skill-editar-video
formato_consumo: instrucao
prioridade_carregamento: alta
versao: "1.0"
sucedido_por: null
complementar_com: "[[playbook-ad]] · [[ESTILO-EDICAO]] · [[metta-tokens]]"
summary: "Pipeline medido de edição de reel vertical a partir de bruto de câmera: decupagem por fronteira de palavra, legenda calibrada, escala de plano, efeitos, números de prova e trilha com ducking. Registra as armadilhas que custaram retrabalho e os números já calibrados. Escrito a partir da edição do C7179 (Tiago, mentoria de vendas é golpe), 05/ago/2026."
created: 2026-08-05
updated: 2026-08-05
---

# Playbook — Reel vertical editado

Pipeline validado na edição do bruto `C7179.MP4` (Tiago, resposta a caixinha de pergunta, 76s de bruto para 46s de entrega). Os números aqui não são estimativa: saíram de medição no material.

## §1. Ordem das etapas

A ordem importa porque cada etapa depende do arquivo da anterior, não do bruto.

```
1. probe            metadados e rotação do bruto
2. transcrever      whisper.cpp medium, PT, timestamps por palavra (-ml 1)
3. decupar          fronteira de palavra + energia do áudio, gera decupagem.json
4. [aprovação]      nenhum corte sem o Renan ver
5. montar base      corta cada segmento do bruto 4K já com a escala de plano
6. retranscrever    a base cortada, para a legenda bater com o novo tempo
7. legenda          gera .ass a partir da transcrição da base
8. acabamento       legenda + overlays + efeitos + trilha, uma passada só
```

**A etapa 6 não é opcional.** Legenda gerada com os tempos do bruto não bate com o corte.

## §2. Decupagem

### §2.0 Achar onde a fala principal começa

Limiar absoluto não serve: voz de direção fora do lapela também passa dele, e o trecho aproveitável começaria na claquete (no C7179 isso apontava 6,3s em vez dos 18,0s corretos).

O que funciona é limiar **relativo ao nível da própria fala**:

1. nível típico da fala = percentil 90 das janelas com som
2. limiar = esse nível menos 12 dB
3. unir regiões acima do limiar separadas por menos de 0,6s
4. só então filtrar as que duram 0,5s ou mais

O passo 3 não é detalhe. Sem ele, o fecho da fala (mais baixo e entrecortado por pausas) não sustenta meio segundo seguido, e o fim do trecho aproveitável cai antes da hora: 69,6s em vez de 73,9s.

### §2.1 Dois limiares, não um

O erro que mais custou tempo. São medidas diferentes e precisam de limiares diferentes:

| Uso | Limiar | Por quê |
|---|---|---|
| Achar pausa longa a apertar | -38 dB | acima disso é fala |
| Achar onde a fala acaba | **-50 dB** | fim de frase sai quase sussurrado |

Com limiar único em -38 dB, a palavra "frio" no fim de "deixam o cara suando frio" foi classificada como silêncio e cortada fora. Ele fecha a frase a -40 dB.

### §2.2 Fronteira de palavra é teto, não posição

O whisper estica cada palavra até a próxima começar. Isso torna o fim da palavra um **limite superior seguro** (não invade a próxima), mas não indica onde o som realmente acabou. A regra que funciona:

```
borda = clamp(borda medida por energia, início da palavra, fim da palavra)
```

Sem o clamp, a borda "encontra" o começo da frase seguinte e traz junto um pedaço do que foi descartado.

### §2.3 Travas obrigatórias

- Segmentos não podem se sobrepor. Quando duas frases são faladas coladas, a fronteira vira o ponto médio.
- Fragmento sem fala nenhuma (sobra do aperto de silêncio) é descartado: vira um piscar de imagem mudo.
- Depois de montar, **transcrever de novo e comparar o texto** com o esperado. Foi essa checagem que revelou três cortes errados que passariam despercebidos.

### §2.4 Quanto apertar

Pausa mínima para cortar: **0,45s**, deixando 0,20s. Abaixo disso é respiração e deve ficar. No C7179, as pausas acima de 0,45s coincidiram quase todas com fronteiras de frase, que já eram pontos de corte: apertar ali não criou nenhum salto novo.

## §3. Legenda

### §3.1 Tamanho é calibração, não conta

O corpo declarado no ASS não vira pixel na mesma proporção. Medir renderizando sobre preto:

| Corpo no ASS | Altura renderizada |
|---|---|
| 60 | 30px |
| 80 | 40px |
| **86** | **44px** ✓ |

O DNA (`video/ESTILO-EDICAO.md`) pede maiúscula entre 41 e 46px. **86 é o valor certo**, não 60.

### §3.2 Posição

O DNA mediu 54% da altura, mas nos planos fechados a legenda cai no queixo. **60% (1152px)** resolve e ainda deixa a faixa 1207 a 1292 livre para o CTA, dentro da safe zone que termina em 1302px.

### §3.3 Quebra por programação dinâmica

Quebra gulosa produz órfão de uma palavra e corta em preposição ("te ofertar alguma coisa as"). O custo que funciona, aplicado por frase:

- penaliza distância do alvo de 20 caracteres, ao quadrado
- penaliza +260 terminar em palavra funcional (de, que, as, para, você...)
- premia -90 terminar em vírgula
- premia -120 quebrar onde há pausa real de fala

Limites: 2 a 5 palavras, máximo 26 caracteres, uma linha.

### §3.4 Amarelo

Seis a sete destaques em 46s. O amarelo perde força repetido: só as palavras que carregam a tese. Não destacar o que já aparece num overlay na mesma cena.

### §3.5 Correção obrigatória

O whisper erra termos de marca e cita nomes de botão entre aspas. Limpar aspas de toda a legenda e manter um dicionário de correções. Revisar antes de queimar.

## §4. Escala de plano

Bruto 4K vertical (2160x3840) entrega 1080x1920, então **zoom até 2.0 é recorte, não ampliação**.

- Escala **estática por segmento**, mudando no corte. É o padrão medido nas peças de referência e não treme. Push contínuo exigiria `zoompan`, que treme em movimento lento.
- Alternar aberto e fechado a cada corte é o que disfarça o jump cut de câmera fixa.
- Faixa usada: 1.00 a 1.34.
- Âncora: crop centralizado na horizontal, e na vertical mantendo os olhos a 33% do quadro.

## §5. Efeitos de zoom

- Um por corte vira tique nervoso. Com limiar de contraste em 0,10 saíram 14 em 46s. **0,21 deixa 6**, só nos cortes de maior mudança de escala.
- **Antecipar pelo pico do arquivo**, não por um valor fixo, para o impacto cair no corte. Medir onde está o pico de energia de cada som.
- Pacote com só um som resolve: o de aproximação é o mesmo arquivo invertido no tempo.

### §5.1 Calibrar volume por comparação

Medir o pico no corte **não serve**: o que aparece ali é a voz. O método certo compara os cortes que têm efeito com os cortes secos. A curva satura porque o `loudnorm` do fim compensa o que se baixa:

| Volume | Soma acima dos cortes secos |
|---|---|
| 0,22 | +0,3 dB (inaudível) |
| 0,35 | +2,0 dB |
| 0,50 | +2,7 dB |
| **0,70** | **+3,1 dB** ✓ |

## §6. Números de prova

Cartela em tela cheia tira quem fala de cena bem no momento da prova. O que funciona: **número sobre a imagem**, no lugar da legenda, sincronizado com a palavra falada.

- Numeral grande em amarelo (Zalando Sans Expanded Black, 150px), complemento abaixo em branco (52px)
- Faixa 975 a 1200px
- Entrada com fade curto mais subida de 30px, animando a camada inteira (transparente fora do bloco). Não precisa animar quadro a quadro.
- **Suprimir a legenda na janela**, e não só os blocos que começam nela: um bloco que começou antes continua no ar e aparece por trás do número. Truncar quem invade.
- Dado na tela só de fonte canônica (`Banco de Provas`), nunca da fala sozinha.

## §7. Trilha

- Escolher a faixa medindo **quanta energia cai na banda da voz**. No C7179: 2,8% contra 6,9% e 8,0% das concorrentes.
- **Ducking por sidechain**: a voz controla o ganho da música. Threshold 0,035, ratio 8, attack 20ms, release 350ms.
- Alvo: cama de **-13 a -18 dB sob a voz**. Medir comparando as janelas de silêncio e de fala entre a versão com e sem música.
- Mixkit tem licença free que cobre anúncio online sem exigir atribuição.

## §8. Áudio final

Lapela cru sai perto de **-26 LUFS** e as redes trabalham perto de -14. Sem normalizar, o anúncio toca mais baixo que o conteúdo ao redor no feed. Alvo: `loudnorm=I=-14:TP=-1.5:LRA=11`, chegando a -15,6 LUFS e -1,2 dBTP.

## §9. Armadilhas técnicas

| Sintoma | Causa | Correção |
|---|---|---|
| Overlay PNG nunca aparece | imagem entra como frame único em t=0 e o fade zera o alpha | `-loop 1 -t <fim>` na entrada |
| Fonte vira serifada no overlay | `file://` falha silencioso no puppeteer | embutir a fonte como data URI base64 |
| ffmpeg estoura a RAM | vários `trim` paralelos do mesmo 4K num filter_complex | cortar segmento a segmento e concatenar |
| Palavra some no corte | limiar de silêncio único | ver §2.1 |
| CTA some no último instante | fade de saída em overlay que vai até o fim | não aplicar fade out quando termina no fim |

## §10. Ferramental

Motor em `.scripts/reel/`, compartilhado por todos os vídeos. Ver o `README.md` de lá para o fluxo completo de comandos.

| Arquivo | Papel |
|---|---|
| `preparar.js` | lê o bruto, acha onde a fala começa, transcreve por palavra |
| `decupar.js` | decupagem por fronteira de palavra e aperto de silêncio (§2) |
| `legendar.js` | legenda ASS, quebra por programação dinâmica, amarelo (§3) |
| `overlays.js` | peças PNG via HTML e puppeteer, fiéis aos tokens |
| `sfx.js` | gera os dois sentidos do efeito a partir de um som só (§5) |
| `montar.js` | corte com escala de plano, overlays, efeitos e trilha (§4 a §7) |
| `verificar.js` | confere emenda em silêncio e integridade do texto |
| `calibrar-sfx.js`, `medir-legenda.js` | bancada, rodam uma vez e alimentam este playbook |

A pasta de cada vídeo guarda só configuração e mídia: `decupagem-config.json`, `decupagem.json`, `plano-visual.json`, `estilo-reel.json`, mais `assets/`, `musica/`, `sfx/`.

Presets de formato em `.scripts/reel/presets/`. Hoje existe `caixinha-pergunta`, validado no C7179.

### §10.1 Sobre o verificador

Roda sobre `tmp/base.mp4`, **não** sobre o final: no final a música preenche os silêncios e toda emenda dá falso positivo.

Perder uma palavra isolada é ruído do whisper entre execuções, não corte errado. O que denuncia corte comendo fala é perder palavras **seguidas**, e é assim que o verificador decide entre aviso e falha.

Uma implementação paralela em Python, escrita no mesmo dia para o mesmo vídeo, foi descartada em 05/ago/2026 por decisão do Renan. Os verificadores dela foram reescritos em JS e estão em `verificar.js`.
