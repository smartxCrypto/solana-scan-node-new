#!/bin/bash
# =============================================================================
# PostgreSQL 数据库部署脚本
# 使用方法: 
#   部署: ./deploy_postgresql.sh [数据库名] [用户名] [--clean]
#   清理: ./deploy_postgresql.sh --drop [数据库名] [用户名]
# =============================================================================

# 设置错误时退出
set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# 显示使用说明
show_usage() {
    echo "使用方法:"
    echo "  部署数据库: ./deploy_postgresql.sh [数据库名] [用户名] [--clean]"
    echo "  删除数据库: ./deploy_postgresql.sh --drop [数据库名] [用户名]"
    echo ""
    echo "参数说明:"
    echo "  --clean    删除现有数据库和用户后重新创建"
    echo "  --drop     仅删除数据库和用户"
    echo ""
    echo "密码处理:"
    echo "  1. 优先使用环境变量 PGPASSWORD"
    echo "  2. 其次使用 ~/.pgpass 文件"
    echo "  3. 最后提示交互式输入"
    echo ""
    echo "示例:"
    echo "  export PGPASSWORD='your_password'"
    echo "  ./deploy_postgresql.sh smartx_data smartx_anlytics"
    echo ""
    echo "  或创建 ~/.pgpass 文件:"
    echo "  echo 'localhost:5432:smartx_data:smartx_anlytics:your_password' > ~/.pgpass"
    echo "  chmod 600 ~/.pgpass"
    echo "  ./deploy_postgresql.sh smartx_data smartx_anlytics"
}

# 检查是否为删除模式
if [ "$1" == "--drop" ] || [ "$1" == "-d" ]; then
    DROP_MODE=true
    DB_NAME="${2:-smartx_data}"
    DB_USER="${3:-smartx_anlytics}"
    DB_HOST="${4:-localhost}"
    DB_PORT="${5:-5432}"
else
    DROP_MODE=false
    DB_NAME="${1:-solana_scan}"
    DB_USER="${2:-solana_user}"
    CLEAN_MODE=false
    if [ "$3" == "--clean" ] || [ "$3" == "-c" ]; then
        CLEAN_MODE=true
        DB_HOST="${4:-localhost}"
        DB_PORT="${5:-5432}"
    else
        DB_HOST="${3:-localhost}"
        DB_PORT="${4:-5432}"
    fi
fi

# SQL 文件目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_DIR="${SCRIPT_DIR}"

# 密码处理函数
setup_password() {
    if [ -n "$PGPASSWORD" ]; then
        log_info "使用环境变量 PGPASSWORD"
        export PGPASSWORD
        return 0
    fi
    
    # 检查 .pgpass 文件
    if [ -f ~/.pgpass ]; then
        # 检查 .pgpass 文件权限
        PERMS=$(stat -c "%a" ~/.pgpass 2>/dev/null || stat -f "%OLp" ~/.pgpass 2>/dev/null)
        if [ "$PERMS" != "600" ]; then
            log_warn ".pgpass 文件权限不正确，正在修复..."
            chmod 600 ~/.pgpass
        fi
        
        # 检查是否包含当前数据库的密码
        if grep -q "${DB_HOST}:${DB_PORT}:${DB_NAME}:${DB_USER}:" ~/.pgpass 2>/dev/null; then
            log_info "使用 ~/.pgpass 文件中的密码"
            return 0
        fi
    fi
    
    # 提示输入密码
    log_warn "未找到密码配置，请输入数据库密码:"
    read -sp "密码: " DB_PASSWORD
    echo
    export PGPASSWORD="${DB_PASSWORD}"
    return 0
}

# 删除数据库和用户
drop_database() {
    log_step "删除数据库和用户..."
    
    # 断开所有连接
    log_info "断开所有活动连接..."
    sudo -u postgres psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();" 2>/dev/null || true
    
    # 删除数据库
    if sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw "${DB_NAME}"; then
        log_info "删除数据库: ${DB_NAME}"
        sudo -u postgres psql -c "DROP DATABASE IF EXISTS ${DB_NAME};"
        log_info "数据库已删除"
    else
        log_warn "数据库 ${DB_NAME} 不存在"
    fi
    
    # 删除用户
    if sudo -u postgres psql -t -c "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}';" | grep -q 1; then
        log_info "删除用户: ${DB_USER}"
        sudo -u postgres psql -c "DROP USER IF EXISTS ${DB_USER};"
        log_info "用户已删除"
    else
        log_warn "用户 ${DB_USER} 不存在"
    fi
    
    log_info "清理完成！"
}

# 如果是删除模式，执行删除后退出
if [ "$DROP_MODE" = true ]; then
    log_info "==================================================================="
    log_info "删除 PostgreSQL 数据库"
    log_info "==================================================================="
    log_info "数据库名: ${DB_NAME}"
    log_info "用户名: ${DB_USER}"
    log_info "==================================================================="
    
    read -p "确认删除数据库 ${DB_NAME} 和用户 ${DB_USER}? (yes/no): " CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
        log_info "操作已取消"
        exit 0
    fi
    
    drop_database
    exit 0
fi

# 部署模式
log_info "==================================================================="
log_info "PostgreSQL 数据库部署开始"
log_info "==================================================================="
log_info "数据库名: ${DB_NAME}"
log_info "用户名: ${DB_USER}"
log_info "主机: ${DB_HOST}:${DB_PORT}"
if [ "$CLEAN_MODE" = true ]; then
    log_warn "清理模式: 将删除现有数据库和用户后重新创建"
fi
log_info "==================================================================="

# 检查 PostgreSQL 是否已安装
if ! command -v psql &> /dev/null; then
    log_error "PostgreSQL 未安装，请先安装 PostgreSQL"
    log_info "Ubuntu/Debian: sudo apt-get install postgresql postgresql-contrib"
    log_info "CentOS/RHEL: sudo yum install postgresql-server postgresql-contrib"
    exit 1
fi

log_info "检测到 PostgreSQL 版本: $(psql --version)"

# 检查 PostgreSQL 服务是否运行
if ! pg_isready -h ${DB_HOST} -p ${DB_PORT} > /dev/null 2>&1; then
    log_error "PostgreSQL 服务未运行"
    log_info "启动服务: sudo systemctl start postgresql"
    exit 1
fi

log_info "PostgreSQL 服务运行正常"

# 清理模式：删除现有数据库和用户
if [ "$CLEAN_MODE" = true ]; then
    drop_database
    sleep 2  # 等待连接完全关闭
fi

# 设置密码
setup_password

# 创建数据库和用户（需要 postgres 用户权限）
log_step "步骤 1: 创建数据库和用户..."
if sudo -u postgres psql -t -c "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}';" | grep -q 1; then
    log_warn "用户 ${DB_USER} 已存在，跳过创建"
else
    log_info "创建用户: ${DB_USER}"
    sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${PGPASSWORD}';"
fi

if sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw "${DB_NAME}"; then
    log_warn "数据库 ${DB_NAME} 已存在，跳过创建"
else
    log_info "创建数据库: ${DB_NAME}"
    sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
fi

sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"
log_info "数据库和用户创建完成"

# 执行初始化脚本
log_step "步骤 2: 执行数据库初始化脚本..."
psql -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME} -f "${SQL_DIR}/00_init_database.sql" 2>&1 || log_warn "初始化脚本执行出现警告"
log_info "数据库初始化完成"

# 创建主要业务表
log_step "步骤 3: 创建主要业务表..."
psql -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME} -f "${SQL_DIR}/01_create_tables.sql"
log_info "主要业务表创建完成"

# 创建快照表
log_step "步骤 4: 创建快照表..."
psql -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME} -f "${SQL_DIR}/02_create_snapshot_tables.sql"
log_info "快照表创建完成"

# 验证安装
log_step "步骤 5: 验证安装..."

# 统计所有表（包括分区表）
TABLE_COUNT=$(psql -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME} -t -c "
    SELECT COUNT(*) 
    FROM information_schema.tables 
    WHERE table_schema IN ('public', 'snapshot', 'trading', 'analytics')
    AND table_type = 'BASE TABLE';
")
log_info "已创建 ${TABLE_COUNT} 个表"


# 显示表列表
log_info "表列表:"
psql -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME} -t -c "
    SELECT schemaname || '.' || tablename as table_name
    FROM pg_tables
    WHERE schemaname IN ('public', 'snapshot', 'trading', 'analytics')
    ORDER BY schemaname, tablename;
" 2>/dev/null | sed 's/^/  /' || log_warn "无法获取表列表"

# 显示数据库连接信息（不显示密码）
log_info "==================================================================="
log_info "部署完成！"
log_info "==================================================================="
log_info "数据库连接信息:"
log_info "  Host: ${DB_HOST}"
log_info "  Port: ${DB_PORT}"
log_info "  Database: ${DB_NAME}"
log_info "  Username: ${DB_USER}"
log_info "  Password: [已设置，未显示]"
log_info ""
log_info "连接字符串:"
log_info "  postgresql://${DB_USER}:***@${DB_HOST}:${DB_PORT}/${DB_NAME}"
log_info ""
log_info "Node.js 配置 (.env):"
log_info "  PG_HOST=${DB_HOST}"
log_info "  PG_PORT=${DB_PORT}"
log_info "  PG_DATABASE=${DB_NAME}"
log_info "  PG_USER=${DB_USER}"
log_info "  PG_PASSWORD=[从环境变量或 .pgpass 读取]"
log_info "==================================================================="

# 生成 .env 配置文件（不包含密码）
cat > "${SCRIPT_DIR}/.env.postgresql" << EOF
# PostgreSQL 配置
# 注意：密码请从环境变量 PGPASSWORD 或 ~/.pgpass 文件读取
PG_HOST=${DB_HOST}
PG_PORT=${DB_PORT}
PG_DATABASE=${DB_NAME}
PG_USER=${DB_USER}
# PG_PASSWORD=请手动设置或使用 .pgpass 文件
PG_MAX_CONNECTIONS=20
PG_IDLE_TIMEOUT=30000
PG_CONNECTION_TIMEOUT=10000
EOF

log_info "已生成 .env.postgresql 配置文件（不包含密码）"
log_info "复制到项目根目录: cp ${SCRIPT_DIR}/.env.postgresql /path/to/your/project/.env"

# 测试连接
log_info "测试数据库连接..."
if psql -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME} -c "SELECT 1;" > /dev/null 2>&1; then
    log_info "数据库连接测试成功！"
else
    log_error "数据库连接测试失败"
    exit 1
fi

log_info "==================================================================="
log_info "下一步操作："
log_info "1. 配置应用程序使用新的数据库连接"
log_info "2. 在应用程序代码中实现快照归档逻辑"
log_info "3. 执行初始数据迁移（如果需要）"
log_info "==================================================================="

# 清理环境变量
unset PGPASSWORD


