# Apuração 2º turno 2026

Projeto de estudo feito durante o 2º turno da eleição presidencial de 2026. Tem duas partes:

- **Pesquisas e projeção** (`pesquisas.html`): as 53 pesquisas divulgadas entre os turnos, a média dos últimos 7 dias, a comparação de chances entre fontes e a projeção registrada na véspera da votação, com a explicação de como ela foi feita.
- **Apuração ao vivo** (`index.html`): o resultado lido da API pública do TSE a cada 30 segundos, com mapa por estado, comparação com o 1º turno, evolução da apuração e a projeção da véspera ao lado do resultado.

Sem vínculo com candidatos, partidos ou institutos de pesquisa.

## O que eu quis praticar

- Ler dados abertos oficiais (TSE e IBGE) e lidar com mudanças de formato sem aviso.
- Visualizar dados ao vivo com acessibilidade: tabela completa como alternativa ao mapa, estados navegáveis por teclado, nomes acessíveis com os números, cores com contraste AA nos temas claro e escuro, sem depender só da cor. Testado com o axe, sem violações.
- Registrar uma projeção antes do resultado e comparar com o que aconteceu, de forma honesta sobre os limites.

## De onde vêm os dados

| Dado | Fonte |
| --- | --- |
| Apuração | API pública de resultados do TSE (`resultados.tse.jus.br`), via `api/apuracao.js` |
| 1º turno por estado | A mesma API, eleição 6257 |
| Mapa dos estados | IBGE, API de malhas v3 (`data/mapa-uf.json`, gerado uma vez) |
| Pesquisas | Reportagens com pesquisas registradas no TSE (`data/pesquisas.json`) |
| Projeção e comparação de chances | `data/projecao.json` |

### O que mudou na API do TSE em 2026

O código de 2022 parou de funcionar. Em 2026:

- o endereço dos resultados passou de `dados-simplificados/<uf>/<uf>-c0001-e<código>-r.json` para `dados/<uf>/<uf>-c0001-e<código>-u.json` (o antigo dá 404, até para o 1º turno);
- os candidatos ficam em `carg[0].agr[].par[].cand[]`, a apuração em `s.pst`, a abstenção em `e.pa`, brancos e nulos em `v.pvb` e `v.ptvn`;
- o site oficial passou a ler arquivos `.jws` (o mesmo JSON, assinado), mas os `.json` continuam publicados.

O código da eleição é descoberto sozinho em `comum/config/ele-c.json` (2º turno federal de 2026: 6258).

## Como a projeção foi feita

As pesquisas foram reunidas a partir de reportagens, sempre em votos válidos; quando a notícia só trazia votos totais, o número foi convertido (a coluna "obs" indica). Na véspera, a leitura juntou a média recente, o resultado do 1º turno, o histórico de que nunca houve virada no 2º turno presidencial desde 1989 e o fato de as pesquisas já terem errado disputas apertadas nas duas direções.

O resultado foi uma faixa para Flávio: 51,5% no centro, 50% de chance entre 49,8% e 53,2%, 80% de chance entre 48,3% e 54,7%.

**Limites:** é uma estimativa subjetiva feita com ajuda de IA, não um modelo estatístico calibrado. As pesquisas vieram de notícias e podem ter erros de transcrição. Ficaram de fora a linha do tempo da campanha e os comentários diários do acompanhamento, porque citavam acusações entre candidatos que não foram verificadas.

## Rodar

    npx vercel dev

Ou publique com `npx vercel --prod`. A função `api/apuracao.js` faz a ponte com o TSE; a CDN da Vercel guarda a resposta por 20 segundos, então o TSE recebe poucas consultas, não importa quantas pessoas abram.

Se o código da eleição não for encontrado: teste `/api/apuracao?e=6258` ou defina a variável de ambiente `TSE_ELEICAO=6258`.
