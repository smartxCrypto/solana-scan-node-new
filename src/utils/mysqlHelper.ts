import client from "../constant/config/db";
import { RowDataPacket, ResultSetHeader } from 'mysql2';

/**
 * 通用 MySQL 查询函数，支持占位参数绑定。
 * @param sql SQL 查询语句
 * @param params 占位符参数数组
 * @returns 查询结果（SELECT 返回数组，其它返回执行信息）
 */
export async function commonQuery<T = unknown>(
    sql: string,
    params: (string | number | null | boolean | Date)[] = []
): Promise<T[]> {
    try {
        const [rows] = await client.execute(sql, params);
        return rows as T[];
    } catch (err) {
        console.error("MySQL 执行失败:", err);
        console.error("SQL:", sql);
        console.error("参数:", params);
        throw err;
    }
}

/**
 * 专门处理分页查询的函数，避免LIMIT/OFFSET参数化查询问题
 * @param sql SQL 查询语句（不包含LIMIT/OFFSET）
 * @param params 占位符参数数组
 * @param limit 限制数量
 * @param offset 偏移量
 * @returns 查询结果
 */
export async function commonQueryWithPagination<T = unknown>(
    sql: string,
    params: (string | number | null | boolean | Date)[] = [],
    limit: number = 10,
    offset: number = 0
): Promise<T[]> {
    try {
        // 确保limit和offset是安全的整数
        const safeLimit = Math.max(1, Math.min(1000, Math.floor(Number(limit))));
        const safeOffset = Math.max(0, Math.floor(Number(offset)));
        
        // 直接拼接LIMIT和OFFSET到SQL中
        const finalSql = `${sql} LIMIT ${safeLimit} OFFSET ${safeOffset}`;
        
        const [rows] = await client.execute(finalSql, params);
        return rows as T[];
    } catch (err) {
        console.error("MySQL 分页查询失败:", err);
        console.error("SQL:", sql);
        console.error("参数:", params);
        console.error("LIMIT:", limit, "OFFSET:", offset);
        throw err;
    }
}

/**
 * 执行插入操作，返回插入的ID和影响的行数
 * @param sql SQL 插入语句
 * @param params 占位符参数数组
 * @returns 插入结果信息
 */
export async function commonInsert(
    sql: string,
    params: (string | number | null | boolean | Date)[] = []
): Promise<{ insertId: number; affectedRows: number }> {
    try {
        const [result] = await client.execute(sql, params);
        const header = result as ResultSetHeader;
        return {
            insertId: header.insertId,
            affectedRows: header.affectedRows
        };
    } catch (err) {
        console.error("MySQL 插入失败:", err);
        console.error("SQL:", sql);
        console.error("参数:", params);
        throw err;
    }
}

/**
 * 执行更新操作，返回影响的行数
 * @param sql SQL 更新语句
 * @param params 占位符参数数组
 * @returns 影响的行数
 */
export async function commonUpdate(
    sql: string,
    params: (string | number | null | boolean | Date)[] = []
): Promise<number> {
    try {
        const [result] = await client.execute(sql, params);
        const header = result as ResultSetHeader;
        return header.affectedRows;
    } catch (err) {
        console.error("MySQL 更新失败:", err);
        console.error("SQL:", sql);
        console.error("参数:", params);
        throw err;
    }
}

/**
 * 执行删除操作，返回影响的行数
 * @param sql SQL 删除语句
 * @param params 占位符参数数组
 * @returns 影响的行数
 */
export async function commonDelete(
    sql: string,
    params: (string | number | null | boolean | Date)[] = []
): Promise<number> {
    try {
        const [result] = await client.execute(sql, params);
        const header = result as ResultSetHeader;
        return header.affectedRows;
    } catch (err) {
        console.error("MySQL 删除失败:", err);
        console.error("SQL:", sql);
        console.error("参数:", params);
        throw err;
    }
}

/**
 * 执行事务操作
 * @param operations 事务操作数组
 * @returns 所有操作的结果
 */
export async function commonTransaction<T = unknown>(
    operations: Array<{
        sql: string;
        params?: (string | number | null | boolean | Date)[];
    }>
): Promise<T[]> {
    const connection = await client.getConnection();
    
    try {
        await connection.beginTransaction();
        
        const results: T[] = [];
        for (const operation of operations) {
            const [result] = await connection.execute(operation.sql, operation.params || []);
            results.push(result as T);
        }
        
        await connection.commit();
        return results;
    } catch (err) {
        await connection.rollback();
        console.error("MySQL 事务执行失败:", err);
        throw err;
    } finally {
        connection.release();
    }
}