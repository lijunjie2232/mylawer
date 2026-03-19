#!/bin/bash

# 部署 Astro 文档到 gh-pages 分支的脚本
# 使用方法：./deploy-gh-pages.sh

set -e

echo "🚀 开始部署文档到 GitHub Pages (gh-pages branch)..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCS_DIR="$SCRIPT_DIR/docs"

# 检查 Node.js 和 pnpm 是否安装
if ! command -v node &> /dev/null; then
    echo -e "${RED}错误：未找到 Node.js，请先安装 Node.js${NC}"
    exit 1
fi

if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}错误：未找到 pnpm，请先安装 pnpm${NC}"
    exit 1
fi

echo -e "${GREEN}✓ 环境检查通过${NC}"

# 进入 docs 目录
cd "$DOCS_DIR"

# 安装依赖
echo -e "${YELLOW}📦 正在安装依赖...${NC}"
pnpm install --frozen-lockfile

# 构建文档
echo -e "${YELLOW}🔨 正在构建文档...${NC}"
pnpm build

# 检查构建输出
if [ ! -d "dist" ]; then
    echo -e "${RED}错误：构建失败，未找到 dist 目录${NC}"
    exit 1
fi

echo -e "${GREEN}✓ 构建完成${NC}"

# 创建 .nojekyll 文件（防止 GitHub Pages 忽略以下划线开头的文件）
touch dist/.nojekyll

# 获取当前分支
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# 使用 git worktree 来管理 gh-pages 分支
echo -e "${YELLOW}📂 设置 worktree...${NC}"

# 清理旧的 worktree（如果存在）
WORKTREE_DIR="../.gh-pages-dist"
if [ -d "$WORKTREE_DIR" ]; then
    echo -e "${YELLOW}清理旧的 worktree...${NC}"
    rm -rf "$WORKTREE_DIR"
fi

# 检查 gh-pages 分支是否存在
if git show-ref --verify --quiet refs/heads/gh-pages; then
    echo -e "${GREEN}✓ gh-pages 分支已存在${NC}"
else
    echo -e "${YELLOW}⚠️  gh-pages 分支不存在，正在创建...${NC}"
    git checkout --orphan gh-pages
    git rm -rf .
    git commit --allow-empty -m "Initial gh-pages branch"
    git push -u origin gh-pages
    git checkout "$CURRENT_BRANCH"
fi

# 添加 worktree
git worktree add -B gh-pages "$WORKTREE_DIR" origin/gh-pages

# 复制构建产物
echo -e "${YELLOW}📋 复制构建文件...${NC}"
cp -r dist/* "$WORKTREE_DIR/"

# 提交并推送
cd "$WORKTREE_DIR"

# 检查是否有变更
if [ -z "$(git status --porcelain)" ]; then
    echo -e "${GREEN}✓ 没有变更，无需部署${NC}"
    git worktree remove "$WORKTREE_DIR"
    cd "$DOCS_DIR"
    exit 0
fi

# 添加所有变更
git add -A

# 创建提交
COMMIT_MSG="docs: deploy documentation update $(date '+%Y-%m-%d %H:%M:%S')"
git commit -m "$COMMIT_MSG"

# 推送到远程
echo -e "${YELLOW}⬆️  正在推送到 GitHub...${NC}"
git push origin gh-pages

# 清理 worktree
cd "$DOCS_DIR"
git worktree remove "$WORKTREE_DIR"

echo -e "${GREEN}✅ 部署成功！${NC}"
echo -e "${GREEN}📄 您的文档将在几分钟后在以下地址可用：${NC}"
echo -e "${GREEN}   https://<username>.github.io/<repo>/ ${NC}"
echo -e "${YELLOW}💡 提示：请确保在 GitHub Settings -> Pages 中设置 Source 为 gh-pages branch${NC}"
