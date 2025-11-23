// config/clickhouse

import { createClient } from "@clickhouse/client";

// 加载 .env 配置
const env = process.env;

const clickhouseClient = createClient({
    url: env.CLICKHOUSE_HOST,
    username: env.CLICKHOUSE_USER ?? "default",
    password: env.CLICKHOUSE_PASSWORD ?? "",
    database: env.CLICKHOUSE_DB ?? "default",
    // optional: add query timeout or compression here
});

export default clickhouseClient;
