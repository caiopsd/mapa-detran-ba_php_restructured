<?php
require_once __DIR__ . '/init.php';

// Endpoint: /municipio/{id}/detalhes
if (preg_match("|^/municipio/(\d+)/detalhes$|", $path, $matches) && $request_method === 'GET') {
    $id_municipio = (int)$matches[1];
    try {
        $pdo = get_pdo();
        $stmt = $pdo->prepare("SELECT id_municipio, Nome FROM Municipios WHERE id_municipio = ?");
        $stmt->execute([$id_municipio]);
        $municipio = $stmt->fetch();

        if (!$municipio) {
            send_json(['error' => 'Município não encontrado'], 404);
        }

        $detalhes_completos = [
            'id_municipio' => $municipio['id_municipio'],
            'nome' => $municipio['Nome'],
            'credenciados' => [
                'cfc' => get_credenciados_por_tipo($pdo, $id_municipio, 'cfc'),
                'clinicas' => get_credenciados_por_tipo($pdo, $id_municipio, 'clinicas'),
                'ecv' => get_credenciados_por_tipo($pdo, $id_municipio, 'ecv'),
                'epiv' => get_credenciados_por_tipo($pdo, $id_municipio, 'epiv'),
                'patio' => get_credenciados_por_tipo($pdo, $id_municipio, 'patio'),
            ],
            'servicos' => [
                'cfc' => get_servicos_por_tipo($pdo, $id_municipio, 'cfc'),
                'clinicas' => get_servicos_por_tipo($pdo, $id_municipio, 'clinicas'),
                'ecv' => get_servicos_por_tipo($pdo, $id_municipio, 'ecv'),
                'epiv' => get_servicos_por_tipo($pdo, $id_municipio, 'epiv'),
                'patio' => get_servicos_por_tipo($pdo, $id_municipio, 'patio'),
            ]
        ];

        send_json($detalhes_completos);
    } catch (\PDOException $e) {
        error_log("Erro API /municipio/{$id_municipio}/detalhes: " . $e->getMessage());
        send_json(['error' => 'Erro ao buscar detalhes do município'], 500);
    }
    exit;
}
