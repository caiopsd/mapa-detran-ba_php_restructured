<?php
// public/router.php

$uri = $_SERVER['REQUEST_URI'];
$path = parse_url($uri, PHP_URL_PATH);

// Diretório público
$publicDir = __DIR__;

// Caminho completo para o arquivo solicitado
// Usar realpath para resolver caminhos como .. e garantir que está dentro do esperado
$requestedFilePath = realpath($publicDir . $path);

// Log para depuração (pode ser removido depois)
// error_log("Router: URI={$uri}, Path={$path}, RequestedFile={$publicDir . $path}, RealPath={$requestedFilePath}");

// Verifica se é uma chamada para a API (começa com /api/)
if (strpos($path, '/api/') === 0) {
    // error_log("Router: Roteando para API...");
    // Roteia para a API
    require_once $publicDir . '/../backend_php/routes/api.php';
    exit;
}

// Verifica se o arquivo solicitado existe DENTRO do diretório público
// e NÃO é um arquivo PHP
if ($requestedFilePath && strpos($requestedFilePath, $publicDir) === 0 && is_file($requestedFilePath) && pathinfo($requestedFilePath, PATHINFO_EXTENSION) !== 'php') {
    // error_log("Router: Servindo arquivo estático: {$requestedFilePath}");
    // Deixa o servidor embutido servir o arquivo estático
    // Retornar false é a chave para o servidor embutido servir o arquivo
    return false;
}

// Se não for API nem arquivo estático válido, serve o index.html (SPA-like)
// error_log("Router: Servindo index.html");
if (file_exists($publicDir . '/index.html')) {
    readfile($publicDir . '/index.html');
} else {
    http_response_code(404);
    echo "Página não encontrada.";
}

?>
