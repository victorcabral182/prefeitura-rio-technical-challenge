-- AlterTable
ALTER TABLE `corridas` ADD COLUMN `chave_idempotencia` VARCHAR(255) NOT NULL,
    ADD COLUMN `hash_idempotencia` CHAR(64) NOT NULL,
    ADD COLUMN `versao` INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE `outbox_eventos` (
    `id` CHAR(36) NOT NULL,
    `tipo` VARCHAR(64) NOT NULL,
    `payload` JSON NOT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `publicado_em` DATETIME(3) NULL,

    INDEX `outbox_eventos_publicado_em_idx`(`publicado_em`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `corridas_passageiro_id_chave_idempotencia_key` ON `corridas`(`passageiro_id`, `chave_idempotencia`);
