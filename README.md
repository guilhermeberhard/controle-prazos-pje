# Controle de Prazos e Diligências – PJE (PCES)

Sistema web simples para a autoridade policial controlar, **por conta própria**, os prazos e as diligências requisitadas pelo Juízo e pelo Ministério Público no PJE do TJES, e para manter um **quadro de respostas padrão** prontas para colar no sistema.

Funciona inteiramente no navegador: não precisa de servidor, banco de dados nem instalação.

## Funcionalidades

- **Painel** com prazos vencidos, que vencem hoje e nos próximos dias, diligências cumpridas que ainda precisam ser respondidas no PJE e alerta de **quando pedir dilação de prazo** (quando o seu prazo interno ultrapassa o prazo do PJE ou a diligência depende de terceiros).
- **Cadastro de diligências**: nº do processo, nº do IP, tipo (intimação, juntada de laudo, oitiva etc.), requisitante (Juiz/MP), vara, descrição, data de recebimento, **prazo PJE** e **prazo interno** separados, responsável, status, réu preso (prioridade) e **histórico de andamentos**.
- **Calculadora de prazos** em dias corridos ou úteis (exclui o dia do começo e inclui o do vencimento; prorroga para o próximo dia útil se cair em fim de semana/feriado, configurável). Feriados nacionais, Carnaval, Sexta-feira Santa e Corpus Christi são calculados automaticamente; feriados estaduais/municipais e suspensões podem ser adicionados.
- **Calendário** mensal com os prazos PJE e internos.
- **Respostas padrão**: 12 modelos iniciais (diligência cumprida, juntada de laudo, laudo pendente, intimação cumprida/frustrada, pedido de dilação – art. 10, §3º, CPP, relatório final etc.), totalmente editáveis, com **preenchimento automático** dos dados da diligência (`{{processo}}`, `{{inquerito}}`, `{{autoridade}}`, `{{data_extenso}}`...). Botão para copiar e colar no PJE.
- Filtros e busca, exportação para planilha (CSV/Excel), impressão, backup e restauração (JSON).

## Importar do PJE (sem digitar)

Botão **⇩ Importar do PJE** (no Painel e em Diligências). Três formas, todas processadas **apenas no seu navegador**:

1. **Copiar e colar** – na lista de expedientes/intimações do PJE, `Ctrl+A`, `Ctrl+C` e cole na tela de importação. Vários processos de uma vez.
2. **PDF do expediente** – arraste os PDFs de despachos/ofícios baixados do PJE. Cada PDF vira uma diligência (somente PDFs com texto; escaneados não são lidos). O leitor de PDF (pdf.js) é baixado do cdnjs na primeira vez – exige internet.
3. **Botão de favorito** – na aba "Botão no navegador", arraste o botão para a barra de favoritos. Com o PJE aberto, um clique envia o conteúdo da tela para o sistema (via `postMessage`, de janela para janela, sem servidor). O favorito é gerado com o endereço onde o sistema está publicado; se mudar o endereço, reinstale-o.

O sistema reconhece automaticamente: nº CNJ do processo, nº do IP/TCO/APF, vara, datas de ciência/expedição, data limite ou prazo em dias/horas (calculado com as regras de contagem configuradas), tipo de diligência, se o requisitante é o MP e se há investigado preso. Tudo aparece numa **prévia editável** antes de gravar; processos já cadastrados com o mesmo prazo vêm desmarcados.

A leitura é feita por regras de texto (`js/importar-pje.js`). Se o layout da tela do PJE/TJES for diferente do previsto, ajuste as expressões regulares nesse arquivo.

> Integração direta (automática, sem abrir o PJE) só é possível por convênio institucional com o TJES, usando o webservice MNI (Modelo Nacional de Interoperabilidade) com credenciais da instituição — caminho que deve ser tratado pela área de TI da PCES.

## Como publicar no GitHub (GitHub Pages)

1. Crie um repositório no GitHub (ex.: `controle-prazos-pje`).
2. Envie os arquivos desta pasta (pelo botão **Add file › Upload files** ou via `git`):
   ```bash
   git init
   git add .
   git commit -m "Sistema de controle de prazos PJE"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/controle-prazos-pje.git
   git push -u origin main
   ```
3. No repositório, acesse **Settings › Pages**, em *Source* escolha **Deploy from a branch**, branch `main`, pasta `/ (root)` e salve.
4. Após alguns minutos o sistema estará em `https://SEU_USUARIO.github.io/controle-prazos-pje/`.

Também é possível usar sem GitHub: basta abrir o arquivo `index.html` no navegador (Chrome/Edge/Firefox).

## Logotipo da Polícia Civil

Salve o brasão oficial da PCES (obtido em fonte institucional) com o nome **`assets/logo-pces.png`** antes de enviar ao GitHub. Ele aparece no cabeçalho e como ícone da aba. Alternativamente, carregue a imagem em **Configurações › Logotipo** (fica salva apenas naquele navegador). Enquanto não houver imagem, é exibido um selo provisório "PC ES".

## Onde ficam os dados (importante)

- Os dados são gravados **somente no navegador do computador em uso** (localStorage). **Nada é enviado ao GitHub ou a qualquer servidor** – o repositório contém apenas o código.
- Por isso, o repositório pode ser público sem expor informações dos procedimentos. Ainda assim, **nunca faça commit dos arquivos de backup** (o `.gitignore` já bloqueia `backup-*.json` e `*.csv`).
- Limpar os dados de navegação, usar janela anônima ou trocar de computador/navegador faz com que os dados não apareçam. **Faça backup periodicamente** (Configurações › Baixar backup); o sistema lembra você após 7 dias sem backup.
- Para usar em outro computador, baixe o backup em um e restaure no outro.
- Os dados de inquéritos são sigilosos: utilize em computador institucional, com usuário protegido por senha, e guarde os backups em local seguro, observando a LGPD e as normas internas da PCES.

## Estrutura

```
index.html              página principal
css/style.css           aparência
js/app.js               lógica do sistema
js/modelos-padrao.js    textos das respostas padrão iniciais
js/importar-pje.js      importação do PJE (colar, PDF, favorito)
assets/logo-pces.png    brasão (adicionar)
```

## Personalização rápida

- **Tipos de diligência / requisitantes / status**: listas no início de `js/app.js`.
- **Modelos iniciais**: `js/modelos-padrao.js` (ou edite diretamente pela interface).
- **Cores**: variáveis no início de `css/style.css`.

> Os modelos de resposta são sugestões de redação e devem ser revisados pela autoridade policial antes do uso.
