# Trilhas para reel

Biblioteca compartilhada. Todas do [Mixkit](https://mixkit.co/license/), cuja
licença free cobre **anúncio online comercial sem exigir atribuição**. A licença
proíbe TV, rádio, CD/DVD e games, o que não afeta Instagram, YouTube e Meta Ads.

## Critério de escolha

Trilha de reel falado não se escolhe por gosto: se escolhe por **quanto da energia
dela cai na banda em que a voz vive** (300 a 3400 Hz). Quanto menos, mais a música
cabe embaixo da fala sem precisar de ducking agressivo.

Para medir:

```bash
node .scripts/reel/avaliar-musica.js video/assets/musica
```

Abaixo de 6% cabe bem sob a voz. Acima de 10% disputa espaço e a fala fica abafada
nos trechos densos, mesmo com sidechain.

## Em uso

| Faixa | Duração | Na banda da voz | Nos graves | Onde |
|---|---|---|---|---|
| `mix-267` | 105s | **5,4%** | 93,3% | C7179 e C7182 |

## Aprovadas para uso, ainda não usadas

| Faixa | Nome no Mixkit | Duração | Na banda da voz | Observação |
|---|---|---|---|---|
| `mix-723` | Other World | 96s | **5,6%** | praticamente empatada com a atual; a alternativa mais direta |
| `mix-282` | Sweet September | 99s | 6,9% | lo-fi, mesma pegada, um pouco mais presente |
| `mix-685` | R&B vibes 1 | 181s | 9,5% | no limite; serve para peça com menos fala |
| `mix-281` | (hip hop) | 109s | 6,9% | levantada em ago/2026, mesma família da 267 |
| `mix-400` | (hip hop) | 99s | 8,0% | 99 BPM, mais lenta |

## Medidas e descartadas

Batida boa, mas ocupam a faixa da voz. Ficam registradas para não serem
reavaliadas do zero:

| Faixa | Nome | Na banda da voz |
|---|---|---|
| `mix-175` | Digital Clouds | 12,3% |
| `mix-480` | Curiosity | 13,8% |
| `mix-1009` | Slow Walk | 17,8% |
| `mix-135` | Sleepy Cat | 21,9% |
| `mix-485` | Green Chair RnB | 23,4% |
| `mix-234` | Thinking About You | 38,9% |
| `mix-443` | Serene View | 43,7% |
| `mix-439` | Tides Turning | 47,9% |
| `mix-988` | Day Dreamin' with U | 57,5% |

## Como baixar outra

O download direto segue o padrão `https://assets.mixkit.co/music/<id>/<id>.mp3`.
As categorias que mais rendem batida leve são
[lo-fi beats](https://mixkit.co/free-stock-music/lo-fi-beats/),
[chillout](https://mixkit.co/free-stock-music/chillout/) e
[hip hop](https://mixkit.co/free-stock-music/hip-hop/).

Baixe, meça com `avaliar-musica.js` e só então ouça as que passarem no corte.

## Como usar numa peça

Copie o mp3 para `video/work/<PEÇA>/musica/` e aponte em `plano-visual.json`:

```json
"musica": { "arquivo": "mix-723.mp3", "volume": 0.14, "fade_in": 0.6, "fade_out": 2.0,
            "ducking": { "threshold": 0.035, "ratio": 8, "attack": 20, "release": 350 } }
```

Alvo depois de montado: cama de **-13 a -18 dB sob a voz**.
