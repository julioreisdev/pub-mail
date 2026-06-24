-- CreateIndex
CREATE INDEX `idx_webchats_org_created_at` ON `webchats`(`organization_id`, `created_at`);
