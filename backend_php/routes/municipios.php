<?php
require_once __DIR__ . '/init.php';

try {
    $pdo = get_pdo();
    $stmt = $pdo->query("SELECT id_municipio AS id, Nome AS nome FROM Municipios ORDER BY Nome");
    send_json($stmt->fetchAll());
} catch (PDOException $e) {
    error_log("Erro ao buscar municípios: " . $e->getMessage());
    send_json(['error' => 'Erro ao buscar municípios'], 500);
}
