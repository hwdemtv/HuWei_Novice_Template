#!/bin/bash
# ============================================================
# 📦 互为螺旋·知识操作系统 — 分发打包脚本（Windows 原生版）
# 用法: ./pack-release.sh [输出目录]
# 默认输出到 ../dist/
#
# 依赖（均为 Windows 自带或已装）:
#   • robocopy    — Windows 自带，带排除的目录复制
#   • PowerShell  — Windows 自带，Compress-Archive 打 zip
#   • python3     — 清理敏感配置（本机已装）
#   • cygpath     — Git Bash 自带，Unix↔Windows 路径转换
#   不再依赖 rsync / zip
# ============================================================

set -euo pipefail

# ── 配置
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SOURCE_DIR="$SCRIPT_DIR"
SOURCE_DIR="${SOURCE_DIR%/}"
VAULT_NAME="$(basename "$SOURCE_DIR")"
OUTPUT_DIR="${1:-$SCRIPT_DIR/../dist}"
VERSION=$(date +"%Y%m%d")
ZIP_NAME="${VAULT_NAME}-v${VERSION}.zip"
STAGE_DIR="/tmp/pack-stage-$$"

# Windows 路径（robocopy / PowerShell / python3 需要正反斜杠 Windows 路径）
SOURCE_WIN=$(cygpath -w "$SOURCE_DIR")

# ── 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}📦 互为螺旋·知识操作系统 — 分发打包（Windows 原生）${NC}"
echo -e "${CYAN}======================================${NC}"
echo ""

# ── 检查源目录
if [ ! -f "$SOURCE_DIR/首页.md" ]; then
    echo -e "${RED}❌ 错误：找不到 首页.md，请确认脚本在仓库根目录运行${NC}"
    exit 1
fi

# ── 检查依赖
for cmd in robocopy.exe powershell.exe python3 cygpath; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo -e "${RED}❌ 缺少依赖：$cmd${NC}"
        exit 1
    fi
done

echo -e "${GREEN}✅ 源目录：$SOURCE_DIR${NC}"
echo -e "${GREEN}✅ 输出到：$OUTPUT_DIR${NC}"
echo -e "${GREEN}✅ 文件名：$ZIP_NAME${NC}"
echo ""

# ── 清理旧 stage
rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR/$VAULT_NAME"

# ── Step 1: 复制（robocopy 粗排 + rm 精排）
echo -e "${YELLOW}📋 Step 1: 复制文件（robocopy + 精确排除）...${NC}"

STAGE_WIN=$(cygpath -w "$STAGE_DIR/$VAULT_NAME")

# robocopy:粗排大目录 + 无歧义的垃圾/产物文件（任意层级安全）
# 退出码 0-7 都算成功，≥8 才是错误，需绕过 set -e
set +e
# MSYS_NO_PATHCONV=1 阻止 Git Bash 把 /E /XD 等开关当 Unix 路径转成 E:/ 之类
# /R:1 /W:1 覆盖 robocopy 默认的百万次重试，避免遇锁定文件卡死
MSYS_NO_PATHCONV=1 robocopy.exe "$SOURCE_WIN" "$STAGE_WIN" /E /R:1 /W:1 \
    /XD .git .trash .stfolder .codex .agents \
    /XF .DS_Store Thumbs.db Desktop.ini "*.zip" "*.rar" "*.7z" "*sync-conflict*" \
    /NFL /NDL /NJH /NJS /NP
RC=$?
set -e
if [ "$RC" -ge 8 ]; then
    echo -e "${RED}❌ robocopy 失败（退出码 $RC）${NC}"
    exit 1
fi

# 精排:删除 robocopy 名字匹配处理不了的「特定路径」或「会误伤同名文件」的项
# • README.md 只排根目录（robocopy /XF README.md 会误杀所有子目录的模板 README.md）
# • .git/.codex/.agents 等再兜一次底，防 robocopy /XD 对带点目录名没生效
rm -rf "$STAGE_DIR/$VAULT_NAME/.git"
rm -rf "$STAGE_DIR/$VAULT_NAME/.trash"
rm -rf "$STAGE_DIR/$VAULT_NAME/.stfolder"
rm -rf "$STAGE_DIR/$VAULT_NAME/.codex"
rm -rf "$STAGE_DIR/$VAULT_NAME/.agents"
rm -f  "$STAGE_DIR/$VAULT_NAME/README.md"
rm -f  "$STAGE_DIR/$VAULT_NAME/.gitignore"
rm -f  "$STAGE_DIR/$VAULT_NAME/pack-release.sh"
rm -f  "$STAGE_DIR/$VAULT_NAME/.stignore"
rm -f  "$STAGE_DIR/$VAULT_NAME/.obsidian/workspace.json"
rm -f  "$STAGE_DIR/$VAULT_NAME/.obsidian/workspace-mobile.json"
rm -f  "$STAGE_DIR/$VAULT_NAME/.obsidian/workspaces.json"
rm -rf "$STAGE_DIR/$VAULT_NAME/.claudian/sessions"
rm -rf "$STAGE_DIR/$VAULT_NAME/.claude/sessions"
rm -rf "$STAGE_DIR/$VAULT_NAME/.claude/agents"
rm -rf "$STAGE_DIR/$VAULT_NAME/00_万法 (开箱即用·Hub)/06_课程/_视频脚本"

echo -e "${GREEN}   ✅ 文件复制完成${NC}"
echo ""

# ── Step 2: 清理敏感配置
echo -e "${YELLOW}🔧 Step 2: 清理敏感配置...${NC}"

CLAUDIAN_SETTINGS="$STAGE_DIR/$VAULT_NAME/.claudian/claudian-settings.json"
if [ -f "$CLAUDIAN_SETTINGS" ]; then
    CLAUDIAN_WIN=$(cygpath -m "$CLAUDIAN_SETTINGS")
    PYTHONIOENCODING=utf-8 python3 -c "
import json

with open('$CLAUDIAN_WIN', 'r', encoding='utf-8') as f:
    data = json.load(f)

data['userName'] = ''
data['permissionMode'] = 'default'
data['systemPrompt'] = ''
data['persistentExternalContextPaths'] = []
data['sharedEnvironmentVariables'] = ''
data['envSnippets'] = []

for provider in ['claude', 'codex', 'opencode', 'pi']:
    if provider in data.get('providerConfigs', {}):
        pc = data['providerConfigs'][provider]
        if 'environmentVariables' in pc:
            pc['environmentVariables'] = ''
        if 'environmentHash' in pc:
            pc['environmentHash'] = ''

with open('$CLAUDIAN_WIN', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print('   ✅ claudian-settings.json 已清理')
"
else
    echo "   ⚠️ 未找到 claudian-settings.json，跳过"
fi

# 清理 realclaudian 插件数据（可能含 API Key）
REALCLAUDIAN_DATA="$STAGE_DIR/$VAULT_NAME/.obsidian/plugins/realclaudian/data.json"
if [ -f "$REALCLAUDIAN_DATA" ]; then
    echo '{}' > "$REALCLAUDIAN_DATA"
    echo "   ✅ realclaudian/data.json 已重置"
else
    echo "   ⚠️ 未找到 realclaudian/data.json，跳过"
fi

echo ""

# ── Step 3: 确保 .gitkeep 存在（空目录不进 ZIP）
echo -e "${YELLOW}📁 Step 3: 确保空目录有 .gitkeep...${NC}"

KEEP_DIRS=(
    "10_一心 (随手丢·Inbox)/_候选记忆"
    "10_一心 (随手丢·Inbox)/周回顾"
    "00_万法 (开箱即用·Hub)/08_长期记忆/people"
    "00_万法 (开箱即用·Hub)/08_长期记忆/projects"
    "00_万法 (开箱即用·Hub)/08_长期记忆/wiki"
    "00_万法 (开箱即用·Hub)/08_长期记忆/decisions"
    "00_万法 (开箱即用·Hub)/07_第二大脑/profile"
    "纳戒"
)

for dir in "${KEEP_DIRS[@]}"; do
    full_path="$STAGE_DIR/$VAULT_NAME/$dir"
    if [ -d "$full_path" ]; then
        touch "$full_path/.gitkeep"
    fi
done

echo -e "${GREEN}   ✅ 空目录已保留${NC}"
echo ""

# ── Step 4: 统计
echo -e "${YELLOW}📊 Step 4: 统计...${NC}"

FILE_COUNT=$(find "$STAGE_DIR/$VAULT_NAME" -type f | wc -l)
DIR_COUNT=$(find "$STAGE_DIR/$VAULT_NAME" -type d | wc -l)
TOTAL_SIZE=$(du -sh "$STAGE_DIR/$VAULT_NAME" | cut -f1)

echo -e "   📄 文件数：$FILE_COUNT"
echo -e "   📁 目录数：$DIR_COUNT"
echo -e "   💾 总大小：$TOTAL_SIZE"
echo ""

# ── Step 5: 打包（PowerShell Compress-Archive）
echo -e "${YELLOW}📦 Step 5: 打包 ZIP（PowerShell）...${NC}"

mkdir -p "$OUTPUT_DIR"
OUTPUT_ZIP="$OUTPUT_DIR/$ZIP_NAME"
STAGE_PARENT_WIN=$(cygpath -m "$STAGE_DIR")
ZIP_WIN=$(cygpath -m "$OUTPUT_ZIP")

# Set-Location 到 stage 父目录，-Path 用相对目录名 → zip 内保留 VAULT_NAME 顶层
MSYS_NO_PATHCONV=1 powershell.exe -NoProfile -ExecutionPolicy Bypass -Command \
    "Set-Location -LiteralPath '$STAGE_PARENT_WIN'; Compress-Archive -Path '$VAULT_NAME' -DestinationPath '$ZIP_WIN' -Force"

ZIP_SIZE=$(du -sh "$OUTPUT_ZIP" | cut -f1)

echo -e "${GREEN}   ✅ 打包完成：$OUTPUT_ZIP ($ZIP_SIZE)${NC}"
echo ""

# ── Step 6: 清理 stage
rm -rf "$STAGE_DIR"

# ── 汇总
echo -e "${CYAN}======================================${NC}"
echo -e "${GREEN}✅ 打包完成！${NC}"
echo -e ""
echo -e "   📦 文件：${OUTPUT_ZIP}"
echo -e "   💾 大小：${ZIP_SIZE}"
echo -e "   📄 文件数：${FILE_COUNT}"
echo -e ""
echo -e "   分发方式："
echo -e "   • 网盘上传：直接传 ZIP"
echo -e "   • GitHub：先推 git，用户下载 ZIP（不含隐私文件）"
echo -e "   • 社群：直接发文件"
echo -e "${CYAN}======================================${NC}"
