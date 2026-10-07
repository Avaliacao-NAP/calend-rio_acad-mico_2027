# Calendário Acadêmico 2027 — GitHub Pages

Calendário anual de 2027, cores originais dos módulos, próximos prazos, tabela de início e término e Gantt. Os prazos de janeiro e fevereiro de 2028 do módulo 54 permanecem na página de 2027. As semanas dos módulos e os destaques de provas, substitutivas e publicação de notas seguem a primeira aba da planilha.

## Ativar a publicação

Repositório: **Avaliacao-NAP/calend-rio_acad-mico_2027**.

1. Para usar **GitHub Pages gratuitamente**, este repositório precisa ser público. A mudança é feita em **Settings → General → Danger Zone → Change repository visibility**. Isso torna o código e o histórico acessíveis ao público. Organizações com GitHub Team ou Enterprise podem utilizar Pages em repositórios privados.
2. Abra **Settings → Pages → Build and deployment → Source** e selecione **GitHub Actions**.
3. Abra **Actions → Publicar e atualizar calendário → Run workflow**, selecione **main** e confirme.
4. Aguarde o job **deploy** terminar. O link confirmado da publicação aparece em **Settings → Pages** e no ambiente **github-pages**.

O endereço padrão esperado após a ativação é:

`https://avaliacao-nap.github.io/calend-rio_acad-mico_2027/`

Esse endereço só funciona depois que a publicação concluir. O workflow verifica se Pages está ativado antes de compilar e publicar. Uma execução sem o job **deploy** concluído não significa que o site esteja no ar.

Não é necessário utilizar Cloudflare nem cadastrar tokens pessoais. O workflow usa as permissões padrão do GitHub Actions para publicar. A ativação inicial do Pages e a visibilidade do repositório são configurações administrativas separadas.

## Atualização automática

- O GitHub Actions consulta a primeira aba da planilha a cada **5 minutos**, pela agenda do workflow. O GitHub pode atrasar execuções; não é sincronização instantânea.
- Cada leitura bem-sucedida é publicada como JSON junto ao site. O navegador consulta esse JSON a cada **20 segundos** enquanto a página está visível e ao retornar à aba.
- A interface compilada é reutilizada enquanto o código permanecer igual; a leitura da planilha é refeita em todas as execuções.
- Se a consulta à planilha falhar, a publicação anterior é preservada. O horário de leitura não é alterado para disfarçar a falha.
- O ícone fica sincronizado quando a leitura publicada tem até **15 minutos**. Dados antigos ou falhas na consulta deixam o ícone no estado de falha, mantendo a última leitura válida na tela.
- Apenas a primeira aba é utilizada. Intervalos entre módulos continuam excluídos. A interface não mostra links para a planilha.
- A planilha original deve continuar disponível para leitura pública.
- Em repositórios públicos sem atividade por 60 dias, o GitHub pode desativar workflows agendados. Reative o workflow em **Actions**, se necessário.
- A agenda só executa em repositório público, evitando consumo recorrente da franquia de Actions enquanto o repositório ainda estiver privado. Execuções manuais e por alteração de código continuam disponíveis.

## Testar localmente

Requisitos: Node.js 24 e pnpm 11.25.0.

```sh
pnpm install --frozen-lockfile
pnpm sync:data
pnpm test
NEXT_PUBLIC_BASE_PATH=/calend-rio_acad-mico_2027 pnpm build:github
pnpm test:export
pnpm preview
```

Abra `http://localhost:4173/calend-rio_acad-mico_2027/`. No PowerShell, defina `$env:NEXT_PUBLIC_BASE_PATH="/calend-rio_acad-mico_2027"` antes de executar o build.

O site compilado fica em `out/`. O teste da exportação confere os 12 meses, semanas dos módulos, cores das provas, prazos de 2028 e caminhos dos recursos no endereço do repositório.

## Data de referência

O calendário, os módulos em foco, os próximos prazos e o Gantt usam a data atual de Brasília e acompanham a mudança dos dias automaticamente. A interface pública não oferece simulação de datas.

## Arquivos principais

- `app/calendar-app.tsx`: interface e ícone de sincronização.
- `app/academic-gantt.tsx`: Gantt com os prazos de 2028 do módulo 54.
- `lib/calendar-source.ts`: interpretação da primeira aba e suas cores.
- `lib/calendar-client.ts`: leitura do JSON publicado e verificação de atualização.
- `scripts/sync-calendar.mjs`: consulta da planilha para publicação.
- `.github/workflows/pages.yml`: publicação e agenda de atualização.

Documentação oficial: [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site), [Workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [Agendas](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).
