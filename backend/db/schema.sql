-- Agri Monitor - Schema
-- Web-Based POS + Inventory System for Mitch Agri Supply

CREATE DATABASE IF NOT EXISTS agri_monitor
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE agri_monitor;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS activity_logs;
DROP TABLE IF EXISTS sale_items;
DROP TABLE IF EXISTS sales;
DROP TABLE IF EXISTS stock_movements;
DROP TABLE IF EXISTS batches;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS suppliers;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

-- ── Users ─────────────────────────────────────────────
CREATE TABLE users (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name          VARCHAR(100)    NOT NULL,
  username      VARCHAR(50)     NOT NULL UNIQUE,
  password_hash VARCHAR(255)    NOT NULL,
  role          ENUM('admin','staff') NOT NULL DEFAULT 'staff',
  is_active     TINYINT(1)      NOT NULL DEFAULT 1,
  created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- ── Categories ────────────────────────────────────────
CREATE TABLE categories (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(100)    NOT NULL UNIQUE,
  description TEXT            NULL,
  created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- ── Suppliers ─────────────────────────────────────────
CREATE TABLE suppliers (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(150)    NOT NULL,
  contact    VARCHAR(100)    NULL,
  created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- ── Customers ─────────────────────────────────────────
CREATE TABLE customers (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(150)    NOT NULL,
  phone      VARCHAR(40)     NULL,
  created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_customers_name (name)
) ENGINE=InnoDB;

-- ── Products ──────────────────────────────────────────
CREATE TABLE products (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  category_id   BIGINT UNSIGNED NOT NULL,
  supplier_id   BIGINT UNSIGNED NULL,
  name          VARCHAR(150)    NOT NULL,
  sku           VARCHAR(50)     NOT NULL UNIQUE,
  unit          VARCHAR(20)     NOT NULL DEFAULT 'piece',
  cost_price    DECIMAL(10,2)   NOT NULL DEFAULT 0,
  selling_price DECIMAL(10,2)   NOT NULL DEFAULT 0,
  reorder_level INT             NOT NULL DEFAULT 5,
  is_active     TINYINT(1)      NOT NULL DEFAULT 1,
  created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_products_category (category_id),
  KEY idx_products_active (is_active),
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id),
  CONSTRAINT fk_products_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ── Batches (stock with expiry) ───────────────────────
CREATE TABLE batches (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id  BIGINT UNSIGNED NOT NULL,
  supplier_id BIGINT UNSIGNED NULL,
  batch_no    VARCHAR(50)     NOT NULL,
  quantity_in INT             NOT NULL DEFAULT 0,
  remaining   INT             NOT NULL DEFAULT 0,
  expiry_date DATE            NULL,
  received_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_batches_product (product_id),
  KEY idx_batches_expiry (expiry_date),
  CONSTRAINT fk_batches_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_batches_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ── Stock movements (audit trail) ─────────────────────
CREATE TABLE stock_movements (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id BIGINT UNSIGNED NOT NULL,
  batch_id   BIGINT UNSIGNED NULL,
  type       ENUM('stock_in','sale','adjustment','damaged','expired') NOT NULL,
  quantity   INT             NOT NULL,
  reference  VARCHAR(100)    NULL,
  user_id    BIGINT UNSIGNED NULL,
  created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_movements_product (product_id),
  KEY idx_movements_type (type),
  KEY idx_movements_created (created_at),
  CONSTRAINT fk_movements_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_movements_batch FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE SET NULL,
  CONSTRAINT fk_movements_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ── Sales ─────────────────────────────────────────────
CREATE TABLE sales (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  invoice_no     VARCHAR(30)     NOT NULL UNIQUE,
  user_id        BIGINT UNSIGNED NOT NULL,
  customer_id    BIGINT UNSIGNED NULL,
  total_amount   DECIMAL(10,2)   NOT NULL DEFAULT 0,
  payment_method VARCHAR(20)     NOT NULL DEFAULT 'cash',
  payment_status ENUM('paid','unpaid') NOT NULL DEFAULT 'paid',
  amount_paid    DECIMAL(10,2)   NOT NULL DEFAULT 0,
  paid_at        TIMESTAMP       NULL DEFAULT NULL,
  created_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sales_created (created_at),
  CONSTRAINT fk_sales_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_sales_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ── Sale items ────────────────────────────────────────
CREATE TABLE sale_items (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sale_id    BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  batch_id   BIGINT UNSIGNED NULL,
  quantity   INT             NOT NULL,
  unit_price DECIMAL(10,2)   NOT NULL,
  subtotal   DECIMAL(10,2)   NOT NULL,
  PRIMARY KEY (id),
  KEY idx_items_sale (sale_id),
  KEY idx_items_product (product_id),
  CONSTRAINT fk_items_sale FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  CONSTRAINT fk_items_product FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT fk_items_batch FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ── Activity logs ─────────────────────────────────────
CREATE TABLE activity_logs (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    BIGINT UNSIGNED NULL,
  action     VARCHAR(100)    NOT NULL,
  details    JSON            NULL,
  created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_logs_created (created_at),
  CONSTRAINT fk_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;
