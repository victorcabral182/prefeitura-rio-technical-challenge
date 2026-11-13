-- CreateTable
CREATE TABLE `usuarios` (
    `id` CHAR(36) NOT NULL,
    `nome` VARCHAR(100) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `senha_hash` VARCHAR(255) NOT NULL,
    `tipo` ENUM('passageiro', 'motorista') NOT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    UNIQUE INDEX `usuarios_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `corridas` (
    `id` CHAR(36) NOT NULL,
    `origem` VARCHAR(255) NOT NULL,
    `destino` VARCHAR(255) NOT NULL,
    `status` ENUM('solicitada', 'aceita', 'em_andamento', 'finalizada') NOT NULL DEFAULT 'solicitada',
    `passageiro_id` CHAR(36) NOT NULL,
    `motorista_id` CHAR(36) NULL,
    `criada_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizada_em` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `corridas` ADD CONSTRAINT `corridas_passageiro_id_fkey` FOREIGN KEY (`passageiro_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `corridas` ADD CONSTRAINT `corridas_motorista_id_fkey` FOREIGN KEY (`motorista_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

