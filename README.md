# Calendário Acadêmico 2027

Site com calendário anual, módulo vigente, próximos prazos, tabela de início e término e Gantt. Os prazos do módulo 54 que avançam até fevereiro de 2028 permanecem na página de 2027. Cores dos módulos, provas, substitutivas, publicação de notas e semanas dos módulos seguem a primeira aba da planilha.

## Publicar no Cloudflare Pages

1. Entre no painel do Cloudflare e abra **Workers & Pages → Create application → Pages → Connect to Git**.
2. Conecte o GitHub e autorize o acesso ao repositório **Avaliacao-NAP/calend-rio_acad-mico_2027**. Ele pode permanecer privado.
3. Selecione o repositório e a branch **main**.
4. Configure os campos abaixo.
5. Clique em **Save and Deploy**. O endereço público aparece quando a publicação termina.

| Campo | Valor |
| --- | --- |
| Project name | `calendario-academico-ead` (sujeito à disponibilidade) |
| Production branch | `main` |
| Framework preset | `None` |
| Build command | `pnpm build` |
| Build output directory | `out` |
| Root directory | Deixar em branco |
| Environment variable: `NODE_VERSION` | `24` |
| Environment variable: `PNPM_VERSION` | `11.25.0` |

O nome escolhido define o subdomínio `pages.dev`. Caso precise de outro nome, ajuste também `name` em `wrangler.toml`. A publicação do código no GitHub, por si só, ainda não cria o projeto no Cloudflare.

A pasta `functions` fica na raiz do repositório e é compilada pelo Cloudflare. Não use apenas o envio da pasta `out` pelo painel, pois a sincronização depende dessa função. Não é necessário habilitar GitHub Pages nem cadastrar tokens no código.

Depois de conectar a hospedagem, cada alteração enviada à branch `main` gera uma nova publicação automaticamente.

## Atualização da planilha

- A página consulta `/api/calendar-source` a cada **20 segundos** enquanto está visível, e também ao voltar para a aba ou recuperar a conexão.
- A função consulta o arquivo original com cache de até **60 segundos**. As alterações normalmente aparecem na consulta seguinte após o vencimento desse cache, além de eventuais atrasos do Google ou da rede. Não é uma conexão instantânea.
- **Alterar a planilha não exige novo commit nem nova publicação do site.**
- Quando o arquivo está igual, uma resposta `304` evita baixar e interpretar a planilha novamente.
- A interpretação acontece no navegador e utiliza somente a primeira aba. A função transmite o arquivo XLSX original; o restante das abas não é utilizado no calendário.
- O ícone de sincronização usa o horário verdadeiro da leitura. Se ocorrer falha ou esse horário tiver mais de dois minutos, indica que os dados estão desatualizados. A interface mantém a última leitura válida da sessão.
- A primeira aba e a estrutura dos cabeçalhos precisam ser mantidas; o arquivo original deve continuar disponível para leitura pública. A interface não exibe links para ele.
- O layout é estático. Apenas a rota de atualização utiliza Pages Functions, sujeita à franquia gratuita do Cloudflare. A arquitetura evita republicações periódicas e não utiliza GitHub Actions para consultar a planilha.

## Desenvolvimento e testes

Requisitos: Node.js 24 e pnpm 11.25.0.

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm build
pnpm test:export
pnpm preview
```

`pnpm preview` inicia o ambiente local do Cloudflare com a função de atualização. `pnpm preview:static` serve somente o layout, sem sincronização. O comando de build também verifica as regras do calendário, a leitura da primeira aba, as mudanças na planilha, o cache, a recuperação de falhas e o horário de sincronização.

`pnpm sync:data` atualiza manualmente o JSON de referência em `public/data/calendar.json`. Esse arquivo é auxiliar; a atualização em produção utiliza a função, não uma agenda de builds.

## Simulação de data

Foi preservado o teste solicitado de **06/10/2027**. Use **Voltar à data real** para encerrar a simulação no navegador.

## Arquivos principais

- `app/calendar-app.tsx`: interface, filtros e ícone de sincronização.
- `app/academic-gantt.tsx`: Gantt com a continuação do módulo 54 em 2028.
- `lib/calendar-source.ts`: interpretação da primeira aba, cores e datas.
- `lib/calendar-client.ts`: consulta automática e validação da atualização.
- `functions/api/calendar-source.js`: consulta à origem com cache de um minuto.
- `public/_routes.json`: limita a função à rota de atualização.
- `wrangler.toml`: configuração do Cloudflare Pages.

Documentação oficial: [Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/), [Functions](https://developers.cloudflare.com/pages/functions/get-started/), [Build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/).
