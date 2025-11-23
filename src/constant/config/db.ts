// config/db.js
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// 加载 .env 文件
dotenv.config();

const client = mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: parseInt(process.env.MYSQL_PORT || '3306'),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
});

export default client;