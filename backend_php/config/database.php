<?php
// backend_php/config/database.php

// Função simples para carregar variáveis de um arquivo .env
function loadEnv($path)
{
    // Adiciona um log para verificar o caminho do .env
    error_log("Tentando carregar .env de: " . $path);
    if (!file_exists($path) || !is_readable($path)) {
        error_log(".env não encontrado ou ilegível em: " . $path);
        return; // Não faz nada se o arquivo não existir ou não for legível
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        // Ignora comentários e linhas inválidas
        if (strpos(trim($line), "#") === 0 || strpos($line, "=") === false) {
            continue;
        }
        list($name, $value) = explode("=", $line, 2);
        $name = trim($name);
        $value = trim($value);

        // Remove aspas (opcional, mas comum em .env)
        if (strlen($value) > 1 && $value[0] == "\"" && $value[strlen($value) - 1] == "\"") {
            $value = substr($value, 1, -1);
        }
        if (strlen($value) > 1 && $value[0] == "'" && $value[strlen($value) - 1] == "'") {
            $value = substr($value, 1, -1);
        }

        // Define como variável de ambiente e superglobal $_ENV
        // Usar getenv() é geralmente mais confiável
        if (getenv($name) === false) { // Verifica se já não está definida via sistema
             putenv(sprintf("%s=%s", $name, $value));
             $_ENV[$name] = $value; // $_ENV pode não ser populado automaticamente por putenv em algumas configs
        }
    }
    error_log(".env carregado com sucesso de: " . $path);
}

// Carrega o .env da raiz do projeto (dois níveis acima do diretório atual 'config')
$projectRoot = dirname(__DIR__, 2); // Vai para backend_php, depois para a raiz
$dotenvPath = $projectRoot . DIRECTORY_SEPARATOR . ".env";

// Adiciona log para verificar o caminho calculado
error_log("Calculado projectRoot: " . $projectRoot);
error_log("Calculado dotenvPath: " . $dotenvPath);

if (file_exists($dotenvPath) && is_readable($dotenvPath)) {
    loadEnv($dotenvPath);
} else {
    error_log(".env não encontrado ou ilegível em: " . $dotenvPath);
}

// Configurações do banco de dados (lendo do .env via getenv() ou usando padrões)
$db_host = getenv("DB_HOST") ?: "127.0.0.1";
$db_port = getenv("DB_PORT") ?: "3306";
$db_name = getenv("DB_NAME") ?: "mapa_detran_ba";
$db_user = getenv("DB_USERNAME") ?: "root";
$db_pass = getenv("DB_PASSWORD") ?: "";

// Adiciona log para verificar o host lido
error_log("DB_HOST lido do ambiente: " . $db_host);

$config = [
    "host" => $db_host,
    "port" => $db_port,
    "dbname" => $db_name,
    "user" => $db_user,
    "password" => $db_pass,
    "charset" => "utf8mb4"
];

// Conexão PDO (agora feita sob demanda em api.php)
$pdo = null; // Inicializa como null, a conexão será feita em api.php

// Retorna a configuração para ser usada em api.php se necessário recarregar
return $config;

?>

