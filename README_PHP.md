# Mapa Detran BA - Versão Reestruturada (Backend PHP)

Este pacote contém a aplicação Mapa Detran BA reestruturada com o backend em PHP.

## Estrutura de Diretórios

*   `backend_php/`: Contém o código do backend em PHP.
    *   `config/`: Arquivos de configuração (ex: `database.php`).
    *   `routes/`: Arquivos que definem os endpoints da API (ex: `api.php`).
    *   `models/`: (Opcional, pode ser adicionado se modelos mais complexos forem criados).
*   `public/`: Diretório raiz para o servidor web. Contém o frontend e o roteador PHP.
    *   `index.html`: Arquivo principal do frontend.
    *   `css/`: Arquivos CSS.
    *   `js/`: Arquivos JavaScript (incluindo `mapa.js`).
    *   `data/`: Arquivos de dados (ex: `geo-ba.json`).
    *   `router.php`: Roteador simples para o servidor embutido do PHP, direciona requisições para a API ou serve arquivos estáticos.
*   `api_documentation.md`: Documentação detalhada dos endpoints da API que foram migrados.

## Como Executar Localmente

1.  **Pré-requisitos:**
    *   PHP instalado (versão 8.1+ recomendada).
    *   Extensão PHP PDO MySQL (`php-mysql` ou similar) habilitada.
    *   Servidor MySQL ou MariaDB instalado e em execução.
2.  **Banco de Dados:**
    *   Crie um banco de dados (ex: `mapa_detran_ba`).
    *   Importe a estrutura das tabelas e os dados necessários (não fornecidos neste pacote, você precisará usar os dados originais do seu projeto). As tabelas esperadas são: `Municipio`, `Credenciado`, `ServicoCFC`, `ServicoClinica`, `ServicoECV`, `ServicoEPIV`, `ServicoPatio`, `PopulacaoMunicipio`, `FrotaMunicipio`, `User`.
    *   Ajuste as credenciais de acesso ao banco de dados no arquivo `backend_php/config/database.php` (usuário, senha, nome do banco, host, porta). Você pode usar variáveis de ambiente ou editar diretamente o arquivo para testes.
3.  **Servidor PHP:**
    *   Navegue até o diretório raiz do projeto (`mapa-detran-ba_restructured`) no seu terminal.
    *   Inicie o servidor embutido do PHP usando o roteador fornecido:
        ```bash
        php -S localhost:8000 -t public public/router.php
        ```
    *   Acesse a aplicação no seu navegador em `http://localhost:8000`.

## Observações

*   O backend PHP implementado é básico e pode precisar de refatoramentos ou adição de um framework (como Laravel ou Symfony) para um ambiente de produção mais robusto.
*   A gestão de erros e segurança pode precisar de aprimoramentos.
*   Os endpoints de usuário (`/users`) foram implementados assumindo uma tabela `User` simples. Adapte conforme sua necessidade.

