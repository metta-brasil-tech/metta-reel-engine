# Fontes

Ambas sob [SIL Open Font License 1.1](https://openfontlicense.org), que permite
uso, modificação e redistribuição, inclusive comercial.

| Arquivo | Origem |
|---|---|
| `Inter-Bold.ttf`, `Inter-ExtraBold.ttf` | [Inter](https://github.com/rsms/inter), de Rasmus Andersson |
| `ZalandoSansExpanded-*.ttf` | [Zalando Sans](https://github.com/zalando/sans), de Jakob Ekelund / KH Type |

## Sobre o nome "Inter Legenda"

Os dois arquivos Inter aqui são instâncias estáticas geradas a partir da Inter
variável, porque o libass não instancia eixo variável: a legenda sairia no peso
errado. A OFL exige que versão modificada não use o nome reservado da original,
por isso a família interna foi renomeada para `Inter Legenda`.

Quem chama a fonte pelo nome (o `.ass` gerado pelo `legendar.js`) usa esse nome.
