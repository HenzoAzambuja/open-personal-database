# Open Personal Database — versão Web/Docker

## Executar

Requer Docker Desktop com Docker Compose.

```bash
docker compose up --build -d
```

Acesse http://localhost:8080. Para parar: `docker compose down`.

## Armazenamento

A versão web prioriza a File System Access API para ler e gravar Markdown, pastas e imagens diretamente no diretório que você escolher. O suporte completo a seleção de diretórios é esperado em versões atuais do Chrome e Edge, em `localhost` (contexto seguro). O navegador pedirá permissão de leitura/gravação. Nesse modo, os arquivos ficam no computador e não no container Docker.

Se o navegador não oferecer a File System Access API, o aplicativo usa IndexedDB como alternativa persistente. Nesse modo, as wikis, páginas, pastas e imagens ficam no armazenamento local do perfil do navegador e podem ser abertas pelo botão **Abrir Wiki**. Os dados não são compartilhados entre navegadores ou perfis e podem ser removidos ao limpar os dados do site; exporte um arquivo `.opd` regularmente para manter uma cópia independente. O espaço disponível depende das cotas do navegador.

As permissões de diretório do modo File System Access são gerenciadas pelo navegador e podem precisar ser concedidas novamente depois de fechar a sessão ou reiniciar o navegador.

## Busca e edição

O campo de busca filtra páginas pelo nome e também procura o texto dentro dos arquivos Markdown da wiki aberta. Resultados encontrados no conteúdo exibem um trecho correspondente na árvore lateral.

Na barra de ferramentas do editor, use **Imagem**, **Infobox**, **Aviso**, **Citação** e **Galeria** para inserir os respectivos blocos na página. As imagens importadas são armazenadas em `assets/`; os blocos são exibidos na prévia e permanecem como Markdown no arquivo.

## Arquivos .opd

O formato `.opd` continua sendo um arquivo ZIP. A exportação web gera ZIP sem compressão para compatibilidade. A importação aceita entradas ZIP armazenadas ou com deflate quando o navegador oferece `DecompressionStream('deflate-raw')`. Importe um pacote selecionando a pasta de destino e depois o arquivo `.opd`.

## Limitações da versão web

- O aplicativo não pode acessar silenciosamente qualquer caminho do sistema operacional; o usuário concede acesso por meio do seletor do navegador.
- Como o seletor do navegador não expõe um caminho absoluto, a interface mostra o nome da pasta, não o caminho completo.
- Esta versão adapta as operações de arquivos no frontend; os comandos Rust/Tauri originais continuam no repositório, mas não são usados na versão web.
- No modo IndexedDB, os arquivos não aparecem diretamente em uma pasta do computador; use **Exportar .opd** para gerar um arquivo portátil.
