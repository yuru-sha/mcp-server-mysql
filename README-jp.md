# mcp-server-mysql
[![CI Status](https://github.com/yuru-sha/mcp-server-mysql/actions/workflows/ci.yml/badge.svg)](https://github.com/yuru-sha/mcp-server-mysql/actions)
[![smithery badge](https://smithery.ai/badge/@yuru-sha/mcp-server-mysql)](https://smithery.ai/server/@yuru-sha/mcp-server-mysql)

MySQLデータベース用のModel Context Protocolサーバー。このサーバーは、LLMがデータベーススキーマを検査し、読み取り専用クエリを実行できるようにします。

## 機能

- MySQLデータベースへの読み取り専用アクセス
- データベーススキーマの検査
- 読み取り専用SQLクエリの実行
- Dockerサポート
- NPMパッケージ利用可能

## インストール

### Dockerを使用する場合

```bash
# Dockerイメージのビルド
make docker

# コンテナの起動
docker run -i --rm mcp/mysql mysql://host:port/dbname
```

### NPMを使用する場合

```bash
npm install @modelcontextprotocol/server-mysql
```

### Smithery経由でのインストール

Claude Desktop用MySQLデータベースサーバーをSmithery経由で自動的にインストールするには：

```bash
npx -y @smithery/cli install @yuru-sha/mcp-server-mysql --client claude
```

## 使い方

### Claude Desktopとの連携

claude_desktop_config.jsonに以下の設定を追加してください：

```json
{
  "mcpServers": {
    "mysql": {
      "command": "docker",
      "args": [
        "run", 
        "-i", 
        "--rm", 
        "mcp/mysql", 
        "mysql://host:port/dbname"
      ]
    }
  }
}
```

Note：macOSでDockerを使用する場合、MySQLサーバーがホストネットワーク上で動作している場合は、host.docker.internalを使用してください。

## 開発

```bash
# Initial setup
make setup

# Build the project
make build

# Format code
make format

# Run linter
make lint
```

## ライセンス

このプロジェクトは[MITライセンス](LICENSE)の下で公開されています。

## セキュリティ

このサーバーは、データベースを保護するために読み取り専用アクセスを強制します。すべてのクエリはREAD ONLYトランザクション内で実行されます。

より安全に利用するために読み取り専用のユーザーを作成することをおすすめします。

## 貢献

貢献を歓迎します！ぜひプルリクエストを送ってください。
