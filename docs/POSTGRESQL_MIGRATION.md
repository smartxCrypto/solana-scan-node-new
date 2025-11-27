# PostgreSQL 迁移指南

## 概述

本项目已从 MySQL 迁移到 PostgreSQL。所有数据库相关的代码已更新以支持 PostgreSQL。

## 主要更改

### 1. 新增文件

- **`src/utils/postgresqlHelper.ts`**: PostgreSQL 数据库操作辅助函数
  - 自动将 MySQL 风格的 `?` 占位符转换为 PostgreSQL 的 `$1, $2, ...` 格式
  - 提供与 `mysqlHelper.ts` 相同的 API，保持代码兼容性

### 2. 修改的文件

#### 数据库配置
- **`src/constant/config/db.ts`**: 
  - 支持 PostgreSQL 和 MySQL 双模式
  - 通过环境变量 `USE_POSTGRESQL` 或 `PG_HOST` 启用 PostgreSQL
  - 使用 `pg` 库创建连接池

#### 服务文件（全部从 `mysqlHelper` 改为 `postgresqlHelper`）

1. **`src/service/TokenInfoService.ts`**
   - `ON DUPLICATE KEY UPDATE` → `ON CONFLICT ... DO UPDATE`
   - `VALUES()` → `EXCLUDED.`

2. **`src/service/lpInfo.ts`**
   - `ON DUPLICATE KEY UPDATE` → `ON CONFLICT ... DO UPDATE`
   - `VALUES()` → `EXCLUDED.`
   - `NOW()` → `CURRENT_TIMESTAMP`

3. **`src/service/snapshot/token_ss.ts`**
   - 导入改为 `postgresqlHelper`

4. **`src/service/snapshot/wallet_trading_ss.ts`**
   - 导入改为 `postgresqlHelper`
   - MySQL `JSON_CONTAINS` → PostgreSQL JSONB `@>` 操作符
   - JSON 查询参数需要传入 JSON 字符串格式

5. **`src/service/snapshot/snapshot.ts`**
   - 导入改为 `postgresqlHelper`
   - 字段名从 camelCase 改为 snake_case（`blockHeight` → `block_height`）
   - 使用 `RETURNING id` 获取插入的 ID
   - 使用 `commonUpdate` 和 `commonDelete` 替代 `commonQuery`

6. **`src/service/smart_money/address.ts`**
   - 导入改为 `postgresqlHelper`
   - MySQL `JSON_TABLE` → PostgreSQL `jsonb_array_elements`
   - 字段名映射（`address` → `wallet_address`）
   - 时间戳处理（Date → Unix timestamp）

## SQL 语法差异

### 1. 占位符
- **MySQL**: `?`
- **PostgreSQL**: `$1, $2, $3, ...`
- **处理**: `postgresqlHelper.ts` 自动转换

### 2. UPSERT 操作
- **MySQL**: 
  ```sql
  INSERT ... ON DUPLICATE KEY UPDATE col = VALUES(col)
  ```
- **PostgreSQL**: 
  ```sql
  INSERT ... ON CONFLICT (unique_col) DO UPDATE SET col = EXCLUDED.col
  ```

### 3. JSON 查询
- **MySQL**: 
  ```sql
  JSON_CONTAINS(column, JSON_OBJECT('key', value))
  ```
- **PostgreSQL**: 
  ```sql
  column::jsonb @> '{"key": "value"}'::jsonb
  ```

### 4. JSON 数组展开
- **MySQL**: 
  ```sql
  CROSS JOIN JSON_TABLE(column, '$[*]' COLUMNS (...))
  ```
- **PostgreSQL**: 
  ```sql
  jsonb_array_elements(column::jsonb)
  ```

### 5. 获取插入的 ID
- **MySQL**: `result.insertId`
- **PostgreSQL**: `INSERT ... RETURNING id`

## 环境变量配置

在 `.env` 文件中添加以下 PostgreSQL 配置：

```env
# PostgreSQL 配置
USE_POSTGRESQL=true
PG_HOST=localhost
PG_PORT=5432
PG_USER=your_user
PG_PASSWORD=your_password
PG_DATABASE=your_database
PG_MAX_CONNECTIONS=20
PG_IDLE_TIMEOUT=30000
PG_CONNECTION_TIMEOUT=10000
```

或者保留 MySQL 配置（向后兼容）：

```env
# MySQL 配置（如果 USE_POSTGRESQL 未设置）
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=your_user
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=your_database
```

## 数据库表结构

所有表结构已在 `db/postgresql/` 目录下定义：
- `00_init_database.sql`: 初始化数据库、扩展、Schema
- `01_create_tables.sql`: 创建主要业务表
- `02_create_snapshot_tables.sql`: 创建快照表

## 部署步骤

1. **安装 PostgreSQL 依赖**:
   ```bash
   npm install pg @types/pg
   ```

2. **运行数据库部署脚本**:
   ```bash
   cd db/postgresql
   ./deploy_postgresql.sh your_database your_user
   ```

3. **配置环境变量**:
   在项目根目录的 `.env` 文件中添加 PostgreSQL 配置

4. **测试连接**:
   确保应用可以正常连接到 PostgreSQL 数据库

## 注意事项

1. **字段名映射**: PostgreSQL 表使用 snake_case，代码中通过 SQL 别名处理
2. **JSON 类型**: PostgreSQL 使用 JSONB 类型，性能更好
3. **时间戳**: 某些字段使用 BIGINT 存储 Unix 时间戳，而非 TIMESTAMP
4. **事务**: PostgreSQL 事务语法略有不同，已在 `postgresqlHelper.ts` 中处理
5. **分页**: LIMIT/OFFSET 语法相同，但参数化方式不同，已在 helper 中处理

## 向后兼容性

- 代码保持与 MySQL helper 相同的 API
- 可以通过环境变量切换数据库类型
- 如果未设置 PostgreSQL 配置，将使用 MySQL（如果配置存在）

## 测试建议

1. 测试所有 CRUD 操作
2. 测试 JSON 查询功能
3. 测试事务操作
4. 测试分页查询
5. 测试 UPSERT 操作

## 故障排查

如果遇到问题，检查：
1. PostgreSQL 服务是否运行
2. 数据库连接配置是否正确
3. 表结构是否已创建
4. 字段名是否匹配（snake_case vs camelCase）
5. JSON 查询参数格式是否正确

