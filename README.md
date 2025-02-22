# mcp-server-mysql
[![CI Status](https://github.com/yuru-sha/mcp-server-mysql/actions/workflows/ci.yml/badge.svg)](https://github.com/yuru-sha/mcp-server-mysql/actions)
[![smithery badge](https://smithery.ai/badge/@yuru-sha/mcp-server-mysql)](https://smithery.ai/server/@yuru-sha/mcp-server-mysql)

Model Context Protocol Server for MySQL databases. This server enables LLMs to inspect database schemas and execute read-only queries.

## Features

- Read-only access to MySQL databases
- Schema inspection capabilities
- Safe query execution within READ ONLY transactions
- Docker support
- NPM package available

## Installation

### Using Docker

```bash
# Build the Docker image
make docker

# Run with Docker
docker run -i --rm mcp/mysql mysql://host:port/dbname
```

### Using NPM

```bash
npm install @modelcontextprotocol/server-mysql
```

### Installing via Smithery

To install MySQL Database Server for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@yuru-sha/mcp-server-mysql):

```bash
npx -y @smithery/cli install @yuru-sha/mcp-server-mysql --client claude
```

## Usage

### With Claude Desktop

Add the following configuration to your `claude_desktop_config.json`:

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

Note: When using Docker on macOS, use `host.docker.internal` if the MySQL server is running on the host network.

### Connection URL Format

```
mysql://[user][:password]@host[:port]/database
```

## Development

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

## License

MIT License - see LICENSE file for details.

## Security

This server enforces read-only access to protect your database. All queries are executed within READ ONLY transactions.

For enhanced security, we recommend creating a read-only user.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
