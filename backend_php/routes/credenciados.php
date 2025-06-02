<?php
require_once __DIR__ . '/init.php';

try {
    $pdo = get_pdo();
    $sql = "
        SELECT DISTINCT
            c.id_municipio,
            c.cnpj,
            c.razao_social,
            m.Nome AS nome_municipio
        FROM Credenciados c
        JOIN Municipios m ON c.id_municipio = m.id_municipio
        ORDER BY c.razao_social;
    ";
    $stmt = $pdo->query($sql);
    send_json($stmt->fetchAll());
} catch (PDOException $e) {
    error_log("Erro ao buscar credenciados: " . $e->getMessage());
    send_json(['error' => 'Erro ao buscar credenciados'], 500);
}
