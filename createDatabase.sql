CREATE DATABASE drug_tracker;

USE drug_tracker;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL
);

CREATE TABLE drugs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  drug_name VARCHAR(100),
  dosage VARCHAR(100),
  timestamp DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
