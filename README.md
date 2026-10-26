# Apuração 2º turno 2026

**In English:** a live dashboard for Brazil's 2026 presidential runoff, built in a day. It reads the official electoral court (TSE) API every 30 seconds behind a CDN cache, shows an accessible map and table by state (keyboard navigable, AA contrast in light and dark themes, no axe violations), estimates the final result state by state as votes come in, and recorded the whole night with GitHub Actions for a replay page. A projection was registered the day before and compared with the result without adjustments. Neutral by design: official data only, same treatment for both candidates, no campaign commentary. The pages are in Portuguese.

Projeto de estudo de visualização de dados ao vivo, feito para acompanhar o 2º turno da eleição presidencial de 25/10/2026 entre Flávio Bolsonaro (PL) e Lula (PT). Ficou no ar durante a apuração em https://apuracao-vini.vercel.app e agora serve de registro de como a noite se desenrolou.

Sem vínculo com candidatos, partidos ou institutos de pesquisa.

## Páginas

- **Apuração ao vivo** (`index.html`): o resultado lido da API pública do TSE a cada 30 segundos, com placar fixo no topo, mapa por estado, comparação com o 1º turno, tendência do resultado final e evolução da apuração.
- **Como foi a noite** (`historico.html`): a apuração do começo ao fim, gravada parcial por parcial, com os momentos que mudaram a noite, uma linha do tempo para voltar a qualquer hora e a comparação entre parcial, tendência e resultado final.
- **Pesquisas e projeção** (`pesquisas.html`): as 53 pesquisas divulgadas entre os turnos, a média dos últimos 7 dias, as chances de cada fonte na véspera e a projeção registrada antes da votação, com a explicação de como ela foi feita.

## O que aconteceu na noite

- A votação terminaria às 17h. Perto desse horário, as duas campanhas pediram mais tempo em cidades diferentes, citando falta de ônibus e chuvas. Uma decisão liminar do STF estendeu a votação até as 19h nas seções que ainda estavam abertas.
- O TSE divulgou 0,25% das seções às 17h06 e retomou a divulgação depois das 19h. O histórico e o gráfico da noite mostram essa pausa.
- Lula venceu com cerca de 51,8% dos votos válidos. O resultado oficial, seção por seção, está no [site de resultados do TSE](https://resultados.tse.jus.br/).

## Imparcialidade

O projeto mostra números, não opiniões. As regras seguidas:

- **Fontes:** a apuração vem só da API oficial do TSE. As pesquisas são as registradas no TSE, como foram noticiadas, com o veículo indicado.
- **Mesmo tratamento:** os dois candidatos aparecem com o mesmo tamanho e cores com o mesmo contraste. Os textos automáticos citam quem está na frente naquele momento, seja quem for.
- **Referência fixa nos gráficos:** com dois candidatos, a parte de um é 100 menos a do outro. Por isso alguns gráficos usam um só número, a parte de Flávio (líder do 1º turno), para o eixo não trocar no meio da noite. Abaixo de 50%, Lula está à frente. Isso é escolha de leitura, não de lado.
- **Sem comentários sobre campanhas:** propostas, acusações e declarações ficaram de fora. A linha do tempo da campanha não entrou porque citava acusações que não foram verificadas.
- **Prorrogação:** a página registra os fatos (quem pediu, quem decidiu e para quais seções valeu), sem juízo sobre a decisão.
- **Projeção:** foi registrada na véspera, antes de qualquer voto, e depois comparada ao resultado sem ajuste. Ela errou o vencedor, assim como a média das pesquisas, e isso aparece nas páginas.

## O que eu quis praticar

- Ler dados abertos oficiais (TSE e IBGE) e lidar com mudanças de formato sem aviso.
- Visualizar dados ao vivo com acessibilidade: tabela completa como alternativa ao mapa, estados navegáveis por teclado, nomes acessíveis com os números, cores com contraste AA nos temas claro e escuro, sem depender só da cor. Testado com o axe, sem violações.
- Registrar uma projeção antes do resultado e comparar com o que aconteceu, de forma honesta sobre os limites.
- Gravar a noite inteira sem depender de um computador ligado.

## De onde vêm os dados

| Dado | Fonte |
| --- | --- |
| Apuração | API pública de resultados do TSE (`resultados.tse.jus.br`), via `api/apuracao.js` |
| 1º turno por estado | A mesma API, eleição 6257 |
| Histórico da noite | Parciais gravadas durante a apuração (`data/historico.json`) |
| Mapa dos estados | IBGE, API de malhas v3 (`data/mapa-uf.json`, gerado uma vez) |
| Pesquisas | Reportagens com pesquisas registradas no TSE (`data/pesquisas.json`) |
| Projeção e chances de cada fonte | `data/projecao.json` |

### O que mudou na API do TSE em 2026

O código de 2022 parou de funcionar. Em 2026:

- o endereço dos resultados passou de `dados-simplificados/<uf>/<uf>-c0001-e<código>-r.json` para `dados/<uf>/<uf>-c0001-e<código>-u.json` (o antigo dá 404, até para o 1º turno);
- os candidatos ficam em `carg[0].agr[].par[].cand[]`, a apuração em `s.pst`, a abstenção em `e.pa`, brancos e nulos em `v.pvb` e `v.ptvn`;
- o site oficial passou a ler arquivos `.jws` (o mesmo JSON, assinado), mas os `.json` continuam publicados.

O código da eleição é descoberto sozinho em `comum/config/ele-c.json` (2º turno federal de 2026: 6258).

## Como a projeção foi feita

As pesquisas foram reunidas a partir de reportagens, sempre em votos válidos; quando a notícia só trazia votos totais, o número foi convertido (a coluna "obs" indica). Na véspera, a leitura juntou a média recente, o resultado do 1º turno, o histórico de que nunca tinha havido virada no 2º turno presidencial desde 1989 e o fato de as pesquisas já terem errado disputas apertadas nas duas direções.

O resultado foi uma faixa para Flávio: 51,5% no centro, 50% de chance entre 49,8% e 53,2%, 80% de chance entre 48,3% e 54,7%. O resultado de Flávio ficou logo abaixo da faixa de 80%.

**Limites:** é uma estimativa subjetiva feita com ajuda de IA, não um modelo estatístico calibrado. As pesquisas vieram de notícias e podem ter erros de transcrição.

## Tendência e histórico

A tendência estima o resultado final estado a estado: em cada estado, o que falta apurar segue o que já foi apurado lá; estados ainda sem votos seguem o 1º turno mais a mudança média dos que já começaram. Corrige a ordem de chegada entre estados (Sul e Sudeste antes do Nordeste), mas não as diferenças dentro de um mesmo estado. O código está em `comum.js`.

O histórico foi gravado no GitHub Actions (`.github/workflows/gravar.yml` e `coleta/gravar-nuvem.mjs`), sem depender de nenhum computador ligado: o job consultou o próprio site a cada 30 segundos (sem consultas extras ao TSE) e publicou `data/historico.json` a cada 6 minutos. `coleta/gravar.mjs` guardou uma cópia local de segurança.

## Rodar

    npx vercel dev

Ou publique com `npx vercel --prod`. A função `api/apuracao.js` faz a ponte com o TSE; a CDN da Vercel guarda a resposta por 20 segundos, então o TSE recebe poucas consultas, não importa quantas pessoas abram.

Se o código da eleição não for encontrado: teste `/api/apuracao?e=6258` ou defina a variável de ambiente `TSE_ELEICAO=6258`.
