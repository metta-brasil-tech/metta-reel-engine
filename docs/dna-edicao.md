# DNA de edição — vídeos verticais Metta

Extraído por inspeção real de duas peças de referência do Drive (31/jul/2026), medindo pixel a pixel, não por descrição.

Referências analisadas:
- `PP-SE-1038` "Sua empresa não precisa de você" (26,7s)
- `PP-SE-1046` "No varejo as pessoas se enganam" (49,6s)

## 1. Formato

| Parâmetro | Valor |
|---|---|
| Resolução | 1080×1920 (9:16) |
| Taxa de quadros | 30 fps |
| Codec | H.264 + AAC 48 kHz estéreo |
| Bitrate de vídeo | ~25 Mbps na referência |
| Duração | 26s a 50s nas duas peças |

## 2. Legenda corrida

O elemento mais constante das duas peças.

| Parâmetro | Valor medido |
|---|---|
| Cor | branco puro, sem preenchimento de caixa |
| Contorno | sombra escura suave, não é contorno duro |
| Alinhamento | centralizado na horizontal |
| Altura na tela | centro do texto a **53–55%** da altura (y ≈ 1035 de 1920) |
| Altura da letra maiúscula | 41–46 px |
| Corpo equivalente | ~60 px |
| Fatiamento | **frase curta, 2 a 5 palavras**, uma linha só |
| Quebra | em fronteira natural de fala, respeitando vírgula |

**Não é karaokê palavra a palavra.** Não há palavra ativa em amarelo na legenda corrida. O amarelo que aparece nessa faixa nas medições é o objeto de cena (o alvo amarelo que ele segura), não a legenda.

A legenda não começa junto com o vídeo. Na 1038 ela entra em **4,5s**, depois das cartelas de abertura.

## 3. Cartelas de abertura (opcional)

Presente na 1038, ausente na 1046. Duas caixas empilhadas de canto arredondado:

| Camada | Fundo | Texto | Faixa vertical |
|---|---|---|---|
| Headline | amarelo Metta | escuro | 62,8% – 70,4% |
| Subheadline | branco | escuro | 70,4% – 75,8% |

Largura útil x de 144 a 945 (≈ 800 px), ou seja, margem lateral de ~13%.

## 4. Pílula de palavra-chave

Retângulo arredondado amarelo com texto escuro em caixa alta, flutuando no terço superior. Aparece pontualmente para carimbar uma palavra que ele acabou de falar (na 1038, "META" entre ~7,5s e 11s). É ênfase, não legenda.

## 5. Pílula de CTA

No fecho, retângulo arredondado amarelo com texto escuro em caixa alta, logo abaixo da legenda corrida:

| Parâmetro | Valor medido |
|---|---|
| Faixa vertical | 58,5% – 63,1% |
| Largura | ~777 px, centralizado |
| Texto na referência | "CLIQUE EM SAIBA MAIS" (peça de Facebook) |

Para Reels o texto muda, porque o destino é o perfil e não um botão de anúncio.

## 6. Ritmo de corte

Na 1038, cortes em 10,7s / 16,3s / 19,3s. Quatro blocos em 26,7s, média de 6,7s por bloco. Não é corte frenético.

O que varia entre blocos é a **escala do plano**: a 1046 alterna plano médio e primeiríssimo plano. Como o bruto é 4K, esse zoom é recorte, não ampliação. É o recurso que dá dinâmica sem precisar de B-roll.

## 7. B-roll

A 1038 corta para uma captura de tela do diagnóstico Metta rodando no notebook (~16s a 19s). Insere prova de produto no meio da fala.

## 8. Tipografia

Fontes estáticas geradas a partir do Inter variável do design system, porque o libass não instancia eixo variável:

- `video/assets/fonts/Inter-Bold.ttf` (wght 700, opsz 32)
- `video/assets/fonts/Inter-ExtraBold.ttf` (wght 800, opsz 32)

Família interna: `Inter Legenda`.
