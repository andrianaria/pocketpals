USE `pocketpals`;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  clerk_user_id VARCHAR(191) NOT NULL,
  email VARCHAR(255) NULL,
  display_name VARCHAR(191) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY users_clerk_user_id_unique (clerk_user_id),
  KEY users_email_index (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS statement_uploads (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  bank_key VARCHAR(80) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(20) NOT NULL,
  file_size_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'processed',
  parsed_rows INT UNSIGNED NOT NULL DEFAULT 0,
  warning_count INT UNSIGNED NOT NULL DEFAULT 0,
  period_start DATE NULL,
  period_end DATE NULL,
  storage_key VARCHAR(512) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY statement_uploads_user_created_index (user_id, created_at),
  CONSTRAINT statement_uploads_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS wallets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  statement_upload_id BIGINT UNSIGNED NULL,
  bank_key VARCHAR(80) NOT NULL,
  account_name VARCHAR(191) NOT NULL,
  account_masked VARCHAR(80) NULL,
  currency CHAR(3) NOT NULL DEFAULT 'IDR',
  ending_balance DECIMAL(19,2) NOT NULL DEFAULT 0,
  statement_date DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY wallets_user_bank_index (user_id, bank_key),
  CONSTRAINT wallets_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT wallets_upload_fk FOREIGN KEY (statement_upload_id) REFERENCES statement_uploads (id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS transactions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  statement_upload_id BIGINT UNSIGNED NULL,
  wallet_id BIGINT UNSIGNED NULL,
  bank_key VARCHAR(80) NULL,
  transaction_date DATE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  remarks TEXT NULL,
  meta VARCHAR(255) NULL,
  amount DECIMAL(19,2) NOT NULL,
  direction VARCHAR(10) NOT NULL DEFAULT 'debit',
  category VARCHAR(80) NOT NULL DEFAULT 'Lainnya',
  icon VARCHAR(16) NULL,
  color VARCHAR(24) NULL,
  auto_tagged TINYINT(1) NOT NULL DEFAULT 0,
  source_file VARCHAR(255) NULL,
  source_reference VARCHAR(191) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY transactions_user_date_index (user_id, transaction_date),
  KEY transactions_user_category_index (user_id, category),
  KEY transactions_upload_index (statement_upload_id),
  CONSTRAINT transactions_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT transactions_upload_fk FOREIGN KEY (statement_upload_id) REFERENCES statement_uploads (id) ON DELETE SET NULL,
  CONSTRAINT transactions_wallet_fk FOREIGN KEY (wallet_id) REFERENCES wallets (id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS auto_tag_rules (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  rule_name VARCHAR(191) NOT NULL,
  match_pattern VARCHAR(255) NOT NULL,
  category VARCHAR(80) NOT NULL,
  icon VARCHAR(16) NULL,
  color VARCHAR(24) NULL,
  is_enabled TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY auto_tag_rules_user_enabled_index (user_id, is_enabled),
  CONSTRAINT auto_tag_rules_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;
