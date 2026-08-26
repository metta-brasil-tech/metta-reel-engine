# DNA de edição — 4 anúncios verticais finalizados por editor profissional

Extraído por medição direta (ffmpeg/ffprobe + análise de pixel em numpy) sobre as 4 peças em `source/`, cruzada com as folhas de contato em `folhas/`. Data da análise: 08/ago/2026.

Cada linha marca a origem do dado:
- **MEDIDO** — número tirado do arquivo (pixel, dB, timecode).
- **ESTIMATIVA** — inferência a partir do que foi medido ou leitura visual.

## 0. Corpus

| Peça | Arquivo | Duração | fps | Bitrate vídeo | Cenário |
|---|---|---|---|---|---|
| 1113 | `ref-1113-ou-aumento-resultado.mp4` | 46,03s | 30,00 | 24,9 Mbps | escritório claro, mesa e notebook |
| 1115 | `ref-1115-mentoria-golpe.mp4` | 43,93s | 30,00 | 18,9 Mbps | estúdio escuro, poltrona |
| 1116 | `ref-1116-assim-como-voce.mp4` | 42,78s | 29,97 | 11,7 Mbps | estante de livros, plano frontal |
| 1127 | `ref-1127-audio-resposta.mp4` | 33,87s | 30,00 | 25,0 Mbps | mesa, celular na mão, perfil |

Tudo MEDIDO. Todas 1080×1920, H.264 + AAC 48 kHz estéreo.

A 1116 é a peça fora da curva em três eixos ao mesmo tempo (fps 29,97, bitrate 11,7 Mbps, pretos levantados). É compatível com re-encode/reexport, não com um tratamento editorial diferente.

---

## 1. Legenda queimada

O elemento mais constante do conjunto. **4 de 4 peças têm legenda queimada, em quase toda a duração.**

### 1.1 Presença e cadência

| Parâmetro | 1113 | 1115 | 1116 | 1127 | Origem |
|---|---|---|---|---|---|
| % do tempo com legenda na tela | 98% | 94% | 92% | 100% | MEDIDO |
| Trocas de fatia na peça | 58 | 53 | 35 | 52 | MEDIDO |
| Intervalo entre trocas, mediana | 0,77s | 0,73s | 1,22s | 0,67s | MEDIDO |
| Intervalo p10 / p90 | 0,42 / 1,18s | 0,43 / 1,19s | 0,56 / 1,57s | 0,27 / 1,07s | MEDIDO |
| Palavras por fatia (contagem nas folhas) | 1 a 6, moda 3 | 2 a 5, moda 3 | 3 a 4, moda 3 | 1 a 3, moda 2 | MEDIDO |
| Linhas por fatia | 1 | 1 | 1 | 1 | MEDIDO |

**Regra do fatiamento:** uma linha só, 2 a 4 palavras, trocando a cada 0,7 a 0,8 segundo. A quebra respeita fronteira de fala e pontuação (as folhas mostram fatias como "mas nunca comprova,", "Se você não", "seu dinheiro de volta."). A legenda troca em corte seco, sem fade e sem animação de escala: em 6 quadros consecutivos numa troca da 1113 o bloco de texto aparece já em opacidade e tamanho finais (MEDIDO).

### 1.2 Karaokê

**Não é karaokê. 4 de 4.** Contagem de pixels amarelos dentro da faixa da legenda, quadro a quadro: 0 na 1113, máx. 20px na 1115, máx. 113px na 1116, e na 1127 o amarelo detectado é a parede amarela do cenário atrás do texto, não a legenda (MEDIDO). Não há palavra ativa destacada, nem em cor nem em peso. A frase inteira entra e sai de uma vez.

Exceção de estilo, não de mecânica: a 1113 usa **uma** fatia em itálico pesado (39,3s, "Supere a Meta Todo Mês.") para carimbar o nome da promessa. É a única fatia itálica das 4 peças (MEDIDO).

### 1.3 Posição

| Parâmetro | 1113 | 1115 | 1116 | 1127 | Origem |
|---|---|---|---|---|---|
| Centro vertical do texto | 62,7% | 55,3% | 60,1% | 67,2% | MEDIDO |
| Linha de base (baseline) | y≈1225 | y≈1080 | y≈1176 | y≈1307 | MEDIDO |
| Centro horizontal | 540 (50,0%) | 540 (50,0%) | 539 (49,9%) | **323 (29,9%)** | MEDIDO |
| Largura máxima da linha | 732px | 738px | 887px | 457px | MEDIDO |

Duas leituras importantes:

1. **A altura não é fixa entre peças.** Varia de 55,3% a 67,2%, uma amplitude de 12 pontos, ou seja 230px. Dentro de cada peça ela é fixa (desvio de ±5px em 68 a 90 amostras). A altura é escolhida por peça, em função de onde o sujeito e os grafismos estão: a 1115 tem legenda alta porque a barra branca e o gesto ocupam a metade de baixo; a 1127 tem legenda baixa porque o mock de WhatsApp toma os 32% de cima.
2. **A centralização horizontal também é por peça.** 3 de 4 centralizam em 50%. A 1127, em que o apresentador está do lado direito do quadro, centraliza o bloco em 29,9% da largura, ou seja joga a legenda para o lado vazio. O texto continua centralizado entre si, não é alinhado à esquerda (MEDIDO: em 6 fatias distintas o centro fica em 322-323px enquanto as bordas variam).

Largura útil máxima ≈ 820px (76% da largura) nas peças centralizadas, o que dá margem lateral de ~12% de cada lado. ESTIMATIVA a partir da maior linha medida (887px na 1116).

### 1.4 Tipografia da legenda

| Parâmetro | Valor | Origem |
|---|---|---|
| Cor do texto | branco puro, RGB medido 253/253/253 | MEDIDO |
| Caixa de fundo | não existe, em nenhuma das 4 | MEDIDO |
| Contorno duro | não existe | MEDIDO |
| Sombra | sim, sombra escura suave em volta de todo o glifo | MEDIDO |
| Altura da maiúscula | 38 a 41px | MEDIDO |
| Altura de x | 28 a 31px | MEDIDO |
| Descendente abaixo da base | 9 a 10px | MEDIDO |
| Corpo equivalente | 56 a 58px | ESTIMATIVA (cap ÷ 0,7275 do Inter) |
| Família | grotesca neutra tipo Inter / Helvetica Now | ESTIMATIVA |
| Peso | Bold a ExtraBold (700–800) | ESTIMATIVA |
| Largura | normal, nem condensada nem expandida | MEDIDO |
| Caixa | sentença (só a primeira letra maiúscula) | MEDIDO |

Prova da métrica: a fatia "eu vi muito empresário" da 1113 mede **610px de largura** e 54px de caixa de bbox. Inter Bold a **58px** renderiza a mesma string com **606px** e 55px. Erro de 0,7% (MEDIDO). Inter ExtraBold a 56px dá 598px, também dentro da faixa. A relação altura-de-x sobre maiúscula medida no vídeo é 0,74–0,76, e a do Inter é 0,750.

**Perfil da sombra** (luminância média por anel de dilatação em torno do glifo, MEDIDO):

| Distância do glifo | 1113 | 1115 | 1116 | 1127 |
|---|---|---|---|---|
| +1px (antialias) | 170 | 167 | 131 | 172 |
| +2px | 80 | 65 | 29 | 51 |
| +3px | 82 | 60 | 38 | 31 |
| +5px | 119 | 81 | 89 | 34 |
| +9px (fundo) | 152 | 104 | 149 | 38 |

A queda é abrupta em +2px e a recuperação é gradual até +8/+10px. Isso é **sombra difusa (glow escuro)**, não contorno: um contorno daria platô constante e volta brusca ao fundo. O perfil direcional é quase simétrico nos quatro lados, com o lado de baixo 5 a 15 unidades mais escuro que o de cima (MEDIDO), ou seja há um deslocamento vertical pequeno.

Parâmetros para reproduzir: sombra preta, opacidade ~55%, desfoque ~8px, deslocamento 0 a 2px para baixo. ESTIMATIVA calibrada pelo perfil acima.

---

## 2. Ritmo de corte

| Parâmetro | 1113 | 1115 | 1116 | 1127 | Origem |
|---|---|---|---|---|---|
| Cortes | 16 | 16 | 12 | **0** | MEDIDO |
| Planos | 17 | 17 | 13 | 1 | MEDIDO |
| Duração média de plano | 2,71s | 2,58s | 3,29s | 33,87s | MEDIDO |
| Duração mediana | 2,57s | 2,03s | 2,90s | — | MEDIDO |
| Plano mais curto | 0,57s | 0,80s | 0,77s | — | MEDIDO |
| Plano mais longo | 6,90s | 5,67s | 7,00s | — | MEDIDO |
| Cortes por minuto | 20,9 | 21,9 | 16,8 | 0 | MEDIDO |

**3 de 4 peças cortam a cada 2,5 a 3,3 segundos. 1 de 4 é plano único de ponta a ponta.**

Método: o detector de cena do ffmpeg não serve sozinho aqui, porque a maioria dos cortes é jump cut no mesmo cenário. A contagem acima veio de diferença quadro a quadro restrita à faixa de fundo estático de cada peça (topo 28% na 1113/1115/1116), o que isola a mudança de enquadramento do movimento do apresentador. Na 1127 a mesma medida na faixa 35–62% dá diferença máxima de 10,3 contra limiar 13,4: zero corte confirmado.

**O ritmo não acelera nem desacelera.** Sequência de durações da 1113: 4,8 · 2,2 · 6,9 · 2,9 · 0,7 · 2,9 · 1,9 · 0,6 · 2,6 · 3,2 · 1,1 · 3,4 · 3,9 · 0,7 · 6,7 · 0,8 · 0,6. Primeira metade média 2,86s, segunda metade 2,56s (MEDIDO). O padrão é irregularidade proposital: blocos longos de 4 a 7s intercalados com batidas curtas de 0,6 a 1,7s. Não existe rampa de aceleração para o fim.

**Todos os cortes são jump cut.** Nas 3 peças com corte, o fundo, a luz e o ângulo são idênticos antes e depois: só muda a escala do recorte. Não há segunda câmera, não há transição, não há dissolve (MEDIDO nas folhas de contato e nos pares de quadros vizinhos a cada corte).

---

## 3. Escala de plano e zoom

| Parâmetro | Valor | Origem |
|---|---|---|
| Escalas distintas por peça | 3 (plano médio, meio-primeiro, primeiríssimo) | ESTIMATIVA por leitura das folhas e das tiras de plano |
| Fonte da variação | recorte digital do mesmo bruto | MEDIDO (fundo e ângulo idênticos entre planos) |
| Corte por zoom | sim, é o mecanismo principal de corte | MEDIDO |
| Zoom animado dentro do plano | sim, lento, nas 3 peças com corte | MEDIDO, com ressalva |
| Velocidade do zoom animado | 0,3% a 1,5% de escala por segundo | MEDIDO |
| Direção | entra e sai; há push in e pull out | MEDIDO |

Casos com medição limpa (erro residual baixo, alinhamento por faixa de fundo estático):

| Peça | Plano | Escala relativa ao início do plano | Erro |
|---|---|---|---|
| 1115 | 26,93–31,37s | 1,000 → 1,035 → 1,055 → 1,065 | 6 a 9 |
| 1116 | 26,57–32,97s | 1,000 → 1,010 → 1,020 → 1,030 | 10 a 20 |
| 1116 | 10,37–14,23s | 1,180 → 1,145 → 1,120 → 1,110 (pull out) | 10 a 18 |
| 1127 | plano único 0–33,9s | 1,000 em 8s, 16s, 24s e 33s | — |

A 1127 é estritamente estática: escala 1,000 e deslocamento 0 em quatro pontos ao longo de 33 segundos. Ou seja, **o zoom lento é opcional; o que é obrigatório é a alternância de escala entre planos.**

Ressalva de método: a estimativa de escala é ruidosa quando o apresentador ocupa muito do quadro, porque o gesto domina o erro. Os valores acima são os de erro residual baixo; descartei as janelas com erro alto.

---

## 4. Cor

Medido em amostragem de 2 quadros por segundo, quadro inteiro, em RGB.

| Parâmetro | 1113 | 1115 | 1116 | 1127 | Origem |
|---|---|---|---|---|---|
| Luma p5 | 0 | 0 | 15 | 0 | MEDIDO |
| Luma p50 | 132 | 45 | 96 | 76 | MEDIDO |
| Luma p95 | 253 | 190 | 204 | 236 | MEDIDO |
| Contraste (p95−p5) | 253 | 190 | 189 | 236 | MEDIDO |
| % pixels com Y<25 | 17,5% | 31,3% | 9,3% | 34,3% | MEDIDO |
| % pixels com Y>235 | 5,5% | 1,9% | 0,1% | 6,3% | MEDIDO |
| Saturação média | 24,9% | 24,8% | 21,4% | 30,8% | MEDIDO |
| Saturação p90 | 50,4% | 52,9% | 50,5% | 95,2% | MEDIDO |
| R−B nos meios-tons | +14,5 | +28,4 | +28,0 | +55,4 | MEDIDO |

Leitura:

- **Sombras fechadas, não levantadas.** 3 de 4 têm p5 de luma em 0, ou seja preto colado no zero, com 17% a 34% do quadro abaixo de Y=25. Só a 1116 tem preto levantado (p5=15) e alta cortada em 204, que é o perfil de uma reexportação, não de uma escolha.
- **Temperatura quente em 4 de 4.** R−B positivo nos meios-tons em todas, de +14 a +55. Parte disso é cenário (madeira, parede amarela na 1127), mas a direção é consistente.
- **Saturação contida.** 21% a 31% de média, ou seja não é look saturado. A 1127 puxa a média para cima por causa da parede amarela.
- **Contraste alto.** Faixa p5–p95 de 189 a 253 numa escala de 255.

ESTIMATIVA de tratamento: contraste alto com preto ancorado no zero, temperatura levemente quente, saturação natural. Não há look estilizado, nem viragem cruzada, nem preto lavado.

---

## 5. Grafismo e inserções

Nenhuma peça tem cartela de abertura em tela cheia, B-roll de arquivo, seta, emoji, contador ou barra de progresso. **Não há logo animado, não há assinatura de fecho, não há vinheta.** As 4 terminam com o apresentador em quadro e a pílula de CTA (MEDIDO nos quadros finais).

### 5.1 Inventário por peça

| Elemento | 1113 | 1115 | 1116 | 1127 |
|---|---|---|---|---|
| Barra branca de qualificação | 0–45,8s (peça inteira) | 25,6–36,8s | não | não |
| Mock de rede social | não | sticker "Faça uma pergunta" 0–4,0s | não | conversa de WhatsApp 0–33,8s |
| Cartela de gancho | não | não | 0,2–3,05s | não |
| Cartela de número | não | não | 2 delas | não |
| Pílula de CTA | 44,6–46,0s | 40,4–43,9s | 34,0–42,8s | 28,9–33,9s |
| Legenda em itálico | 1 fatia (39,3s) | não | não | não |

Tudo MEDIDO por presença de pixel branco/amarelo em faixa, amostrado a 5 Hz.

### 5.2 Geometria de cada elemento

**Barra branca de qualificação** (1113 e 1115, 2 de 4):

| Parâmetro | Valor | Origem |
|---|---|---|
| Faixa vertical | y 1354–1513, ou 70,5% a 78,8% | MEDIDO |
| Largura | 1080px, sangra de borda a borda | MEDIDO |
| Altura | 160px (8,3% da altura) | MEDIDO |
| Fundo | branco puro, opaco | MEDIDO |
| Conteúdo | texto escuro à esquerda, pílula amarela ao centro-direita, símbolo Metta no canto direito | MEDIDO |
| Pílula interna | y 1392–1479, x 456–911, 456×88px | MEDIDO |
| Tipografia | Zalando Sans Expanded Bold, caixa alta, preta | ESTIMATIVA por comparação de renderização |

**Pílula de CTA** (4 de 4):

| Parâmetro | 1113 | 1115 | 1116 | 1127 | Origem |
|---|---|---|---|---|---|
| Faixa vertical | 72,5–77,0% | 63,6–68,2% | 62,9–67,1% | 70,6–74,0% | MEDIDO |
| Largura × altura | 779×88 | 778×89 | 776×82 | 584×66 | MEDIDO |
| Amarelo (mediana RGB) | 254/197/49 | 254/197/49 | 255/185/14 | 254/197/49 | MEDIDO |
| Raio | pílula completa (raio = metade da altura) | ESTIMATIVA |
| Texto | "CLIQUE EM SAIBA MAIS", caixa alta, preto | MEDIDO |
| Altura da maiúscula do texto | 32px | MEDIDO |
| Posição relativa à legenda | logo abaixo, mesma coluna | MEDIDO |

Largura fixa de **777px ±2** em 3 de 4 peças, o que indica componente de largura travada, não caixa que se ajusta ao texto. A 1127 usa 584px, coerente com a legenda mais estreita daquela peça. A 1116 acrescenta um "▼" ao fim do texto.

Os dois amarelos medidos batem com dois tokens do design system: 254/197/49 ≈ **#FEC531** (token `#FFC531`) e 255/185/14 ≈ **#FFB90E** (token `#FFBE18`). A divergência entre peças é de exportação/gamma, não de escolha.

**Cartela de gancho** (só 1116, 1 de 4):

| Parâmetro | Valor | Origem |
|---|---|---|
| Faixa vertical | y 1206–1441, ou 62,8% a 75,1% | MEDIDO |
| Largura | 800px (x 140–939), margem lateral de 13% | MEDIDO |
| Fundo | amarelo #FFB90E, canto arredondado | MEDIDO |
| Texto | preto, 3 linhas, caixa de sentença | MEDIDO |
| Entrada e saída | fade de ~0,2s (0 → 8933px de amarelo em 3 quadros) | MEDIDO |
| Vida | 0,22s a 3,05s | MEDIDO |

Essa geometria é idêntica à cartela de abertura já documentada em `video/ESTILO-EDICAO.md` (62,8%–70,4%, x de 144 a 945). É componente estável da marca, não improviso da peça.

**Cartela de número** (só 1116, 2 ocorrências):

| Parâmetro | "20 anos" (4,0s) | "+1.000" (24,3s) | Origem |
|---|---|---|---|
| Número, faixa vertical | 49,0–56,4% | 50,7–56,4% | MEDIDO |
| Número, largura | 763px | 612px | MEDIDO |
| Altura do glifo | ~143px | ~111px | MEDIDO |
| Cor do número | #FFB90E | #FFB90E | MEDIDO |
| Sublinha branca | y 1114–1151 (58,0–59,9%), altura 38px | idem | MEDIDO |
| Fonte | Zalando Sans Expanded Black, oblíqua ~8° | ESTIMATIVA por comparação de renderização |
| Vida | ~2,0s | ~2,0s | MEDIDO |

Confirmação de fonte: renderizar "20 anos" em `ZalandoSansExpanded-Black.ttf` a 150px reproduz a forma do 2, do 0 e do a de olho único do vídeo. É a fonte display da Metta, não a da legenda.

**Mock de conversa de WhatsApp** (só 1127):

| Parâmetro | Valor | Origem |
|---|---|---|
| Faixa vertical | y 140–623, ou 7,3% a 32,4% | MEDIDO |
| Faixa horizontal | x 99–1007 | MEDIDO |
| Conteúdo | 5 balões recebidos + 1 balão de áudio enviado | MEDIDO |
| Animação | o balão de áudio toca: o cursor da onda avança ao longo dos 33s | MEDIDO nas folhas |
| Opacidade | levemente translúcida, o cenário aparece por trás | MEDIDO |
| Vida | peça inteira | MEDIDO |

**Sticker de pergunta do Instagram** (só 1115): y 241–481 (12,6% a 25,1%), x 245–834, largura 590px, fundo branco, texto escuro. Vive de 0 a 4,0s (MEDIDO).

### 5.3 Falso positivo importante

O arco amarelo que aparece no canto superior direito da 1115 em quase todos os quadros **não é grafismo sobreposto**. É o símbolo Metta pintado na parede do estúdio: ele muda de tamanho e de posição junto com o recorte do plano (medido em 5 tempos: y de 566 a 889, x de 520 a 853), o que um overlay não faria. Não replicar isso como camada.

---

## 6. Áudio

| Parâmetro | 1113 | 1115 | 1116 | 1127 | Origem |
|---|---|---|---|---|---|
| Loudness integrado | −15,7 LUFS | −15,6 LUFS | −15,3 LUFS | −15,9 LUFS | MEDIDO |
| LRA | 1,1 LU | 1,4 LU | 3,1 LU | 1,5 LU | MEDIDO |
| Pico real | −0,8 dBTP | −0,3 dBTP | −1,4 dBTP | 0,0 dBTP | MEDIDO |
| RMS mediano em 50ms | −17,4 dBFS | −16,6 | −18,2 | −18,6 | MEDIDO |
| Maior pausa da peça | 0,40s | 0,20s | 0,60s | 0,35s | MEDIDO |
| Nível na pausa | −40,6 dBFS | −44,5 | −36,1 | −44,8 | MEDIDO |
| % de quadros abaixo de −40dB | 2,0% | 1,4% | 1,6% | 6,9% | MEDIDO |

**Alvo de loudness: −15,5 LUFS ±0,3, pico real entre −1,4 e 0,0 dBTP.** A convergência das 4 peças numa janela de 0,6 LU não é coincidência, é preset de masterização.

**LRA de 1,1 a 1,5 LU em 3 de 4** é faixa dinâmica quase nula. Vem de duas coisas somadas: compressão pesada da voz e corte apertado das respirações.

**Não há cama musical.** 4 de 4. A maior pausa de cada peça fica entre −36 e −45 dBFS, e o espectro dessas pausas não tem estrutura harmônica estável: os picos caem em 465/585/700/1865 Hz, os mesmos em peças gravadas em dias e cenários diferentes, o que é assinatura de ruído de sala, não de trilha. Uma cama musical num programa a −15,5 LUFS apareceria por volta de −25 a −30 dBFS nas pausas, ou seja 10 a 15 dB acima do que foi medido.

**Não há efeito sonoro nos cortes.** Procurei transientes de +9 dB em 50ms: aparecem 37 a 59 por peça, espaçados de 0,5 a 1s de forma regular ao longo de toda a duração, e **não** coincidem com os timecodes de corte. São sílabas da fala. Um whoosh de transição apareceria como evento isolado exatamente sobre o corte, e isso não ocorre em nenhuma das 4.

**Silêncio removido de forma agressiva.** Nenhuma pausa passa de 0,6s em 43 segundos de fala. É o que produz, junto com os jump cuts, a sensação de densidade.

---

## 7. Abertura

| Parâmetro | 1113 | 1115 | 1116 | 1127 | Origem |
|---|---|---|---|---|---|
| Primeira fala | 0,24s | 0,20s | 0,20s | 0,08s | MEDIDO |
| Legenda no quadro 1 | sim | não (entra ~2,2s) | não (entra ~3,1s) | sim | MEDIDO |
| Grafismo no quadro 1 | barra branca | sticker de pergunta | nada (cartela entra em 0,22s) | mock de WhatsApp | MEDIDO |
| Cartela de gancho | não | não | 0,22–3,05s | não | MEDIDO |
| Primeiro corte | 4,83s | 4,17s | 4,03s | não há | MEDIDO |

**O gancho é sempre a primeira frase falada, e ela começa antes de 0,25s.** 4 de 4. Não existe respiro de entrada, contagem, logo, black ou pré-rolo. O apresentador já está no meio do gesto no quadro 1.

**3 de 4 têm alguma coisa na tela no primeiro quadro além da imagem** (barra, sticker, mock). A quarta coloca a cartela em 0,22s. Ou seja: **em todas, o primeiro segundo já carrega uma camada gráfica.**

**O primeiro plano é o mais longo do bloco de abertura em 3 de 4**: primeiro corte em 4,0 a 4,8s, contra média de plano de 2,6 a 3,3s. A peça assenta o rosto e a primeira ideia antes de começar a cortar.

Quando existe cartela de gancho (1116), ela ocupa a janela em que a legenda ainda não entrou: cartela de 0,22 a 3,05s, primeira legenda em 3,1s. **Cartela e legenda não coexistem** (MEDIDO).

---

## 8. Receita para o pipeline

Parâmetros prontos para implementação. Onde as 4 peças divergem, a coluna diz quantas seguem o padrão.

### 8.1 Obrigatório (4 de 4)

| Parâmetro | Valor |
|---|---|
| Saída | 1080×1920, 30fps, H.264, AAC 48 kHz estéreo |
| Duração | 34s a 46s |
| Legenda | queimada, 92% a 100% do tempo |
| Fatia | 1 linha, 2 a 4 palavras, troca a cada 0,7 ±0,15s |
| Karaokê | não usar |
| Cor da legenda | #FDFDFD (branco) |
| Sombra da legenda | preta, opacidade 55%, desfoque 8px, offset 0/+2px |
| Caixa de fundo | nenhuma |
| Corpo da legenda | 57px em 1080 de largura (cap 39px) |
| Fonte da legenda | Inter Bold, caixa de sentença |
| Largura máxima da linha | 820px |
| Transição da legenda | corte seco, sem fade e sem animação |
| Loudness | −15,5 LUFS, pico real ≤ −0,3 dBTP |
| Trilha musical | nenhuma |
| SFX de corte | nenhum |
| Pausa máxima na fala | 0,6s |
| Início da fala | antes de 0,25s |
| Pílula de CTA | amarelo #FFC531, 777×85px, raio total, texto preto caixa alta em Zalando Sans Expanded Bold, cap 32px |
| Entrada do CTA | nos últimos 4 a 9 segundos, logo abaixo da legenda |
| Fecho | sem logo, sem vinheta, sem cartela final |

### 8.2 Por peça (escolher no início do job)

| Parâmetro | Opções observadas | Distribuição |
|---|---|---|
| Altura da legenda | 55,3% · 60,1% · 62,7% · 67,2% | 1 peça cada |
| Centro horizontal da legenda | 50% ou 30% | 3 e 1 |
| Cortes | jump cut a cada 2,6–3,3s, ou plano único | 3 e 1 |
| Zoom lento dentro do plano | 0,3 a 1,5%/s, in ou out, ou nenhum | 3 e 1 |
| Camada gráfica persistente | barra branca · mock de WhatsApp · nenhuma | 2 · 1 · 1 |
| Cartela de gancho no início | sim (2,8s) ou não | 1 e 3 |
| Cartela de número no meio | sim (2s cada) ou não | 1 e 3 |

Regra de decisão da altura da legenda (ESTIMATIVA, coerente com as 4): posicionar o centro do texto no primeiro terço livre abaixo do queixo do apresentador e acima de qualquer camada gráfica fixa. Se houver camada no topo, descer a legenda; se houver barra embaixo, subir.

### 8.3 Escala de plano

| Parâmetro | Valor |
|---|---|
| Escalas distintas | 3, do plano médio ao primeiríssimo |
| Origem | recorte digital do mesmo bruto, sem segunda câmera |
| Sequência | irregular; alternar blocos de 4 a 7s com batidas de 0,6 a 1,7s |
| Rampa | não existe; ritmo não acelera para o fim |
| Primeiro corte | 4,0 a 4,8s |
| Transição | corte seco; nunca dissolve |

### 8.4 Cor

| Parâmetro | Valor |
|---|---|
| Preto | ancorado em 0; 15% a 35% do quadro abaixo de Y=25 |
| Branco | até 253; 2% a 6% do quadro acima de Y=235 |
| Contraste p5–p95 | 190 a 253 |
| Saturação média | 21% a 31% |
| Temperatura | quente, R−B de +15 a +30 nos meios-tons |

---

## 9. Método e limites

Como cada número foi obtido:

- **Posição e cor de legenda**: quadros extraídos com `ffmpeg -ss T -frames:v 1`, máscara de pixel quase branco (min>228 e amplitude RGB<16), estatística de linha e coluna. 68 a 90 amostras por peça a 2 Hz.
- **Sombra**: dilatação binária iterativa da máscara do glifo, luminância média por anel.
- **Corpo e família**: comparação de largura e altura de uma string real do vídeo contra a mesma string renderizada em `Inter-Bold.ttf` e `Inter-ExtraBold.ttf` do design system, varrendo corpos de 46 a 60px.
- **Cortes**: diferença absoluta quadro a quadro em 180×320, restrita à faixa de fundo estático de cada peça, com limiar de 4× a mediana. O detector `select='gt(scene,…)'` do ffmpeg sozinho perde os jump cuts e não foi usado como fonte.
- **Zoom**: busca de escala de 0,95 a 1,45 em passos de 0,005 com deslocamento de ±3px, minimizando erro absoluto contra a faixa de fundo estático do primeiro quadro do plano.
- **Cor**: amostragem a 2 Hz em 180×320, percentis de luma BT.709 e saturação HSV sobre o quadro inteiro.
- **Áudio**: `ebur128=peak=true` para loudness; PCM mono 22,05 kHz para RMS em janelas de 50ms, espectro FFT das janelas mais silenciosas e derivada de RMS para transientes.

Limites conhecidos:

1. A identificação de família tipográfica é ESTIMATIVA. Inter bate em métrica e em desenho, mas Helvetica Now Display e SF Pro Display são metricamente próximas e não dá para separá-las com certeza a 39px de altura de maiúscula.
2. A medição de zoom lento tem ruído alto quando o apresentador ocupa muito quadro. Reportei só janelas com erro residual baixo, então a faixa de 0,3 a 1,5%/s pode estar subestimando os extremos.
3. R−B nos meios-tons mistura tratamento e cenário. A direção quente é confiável em 4 de 4; a magnitude por peça não é comparável entre cenários diferentes.
4. A contagem de palavras por fatia veio das 24 amostras de cada folha de contato, não de transcrição completa. A moda de 3 palavras é sólida; os extremos podem ser mais largos.
5. A 1116 tem perfil técnico de reexportação (29,97fps, 11,7 Mbps, preto em 15, alta em 204). Os números de cor dela não devem entrar na média do look.
