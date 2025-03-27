#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createPool, PoolConnection } from "mysql2/promise";

const server = new Server(
  {
    name: "mcp-server-mysql",
    version: "0.1.2",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Please provide a database URL as a command-line argument");
  process.exit(1);
}

const databaseUrl = args[0];

const resourceBaseUrl = new URL(databaseUrl);
resourceBaseUrl.protocol = "mysql:";
resourceBaseUrl.password = "";

const pool = createPool({
  uri: databaseUrl,
});

const SCHEMA_PATH = "schema";

// 禁止されたSQLキーワードのリスト
const FORBIDDEN_KEYWORDS = [
  // DDL
  "CREATE", "ALTER", "DROP", "TRUNCATE", "RENAME",
  // DCL
  "GRANT", "REVOKE",
  // TCL
  "BEGIN", "START TRANSACTION", "COMMIT", "ROLLBACK", "SAVEPOINT",
  // DML
  "INSERT", "UPDATE", "DELETE", "MERGE", "UPSERT",
  // その他の危険な操作
  "SET", "RESET", "LOCK", "UNLOCK", "VACUUM", "CLUSTER",
  "REINDEX", "ANALYZE", "EXPLAIN", "EXECUTE", "PREPARE",
  "DEALLOCATE", "DECLARE", "FETCH", "MOVE", "CLOSE",
  "LISTEN", "NOTIFY", "LOAD", "COPY"
];

// トランザクションを開始し、READ ONLYモードを設定する関数
async function beginReadOnlyTransaction(connection: PoolConnection): Promise<void> {
  await connection.beginTransaction();
  await connection.query('SET SESSION TRANSACTION READ ONLY');
  await connection.query('SET SESSION max_execution_time = 5000'); // 5秒でタイムアウト
}

// SQLクエリが安全かどうかをチェックする関数
function isQuerySafe(sql: string): boolean {
  const normalizedSql = sql.toUpperCase().replace(/\s+/g, ' ').trim();

  // SELECTで始まることを確認
  if (!normalizedSql.startsWith('SELECT ')) {
    return false;
  }

  // 禁止キーワードのチェック
  return !FORBIDDEN_KEYWORDS.some(keyword => {
    const pattern = new RegExp(`(^|\\s)${keyword}(\\s|$)`);
    return pattern.test(normalizedSql);
  });
}

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const connection = await pool.getConnection();
  try {
    await beginReadOnlyTransaction(connection);
    const [rows] = await connection.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()"
    );
    await connection.commit();
    return {
      resources: (rows as any[]).map((row) => ({
        uri: new URL(`${row.TABLE_NAME}/${SCHEMA_PATH}`, resourceBaseUrl).href,
        mimeType: "application/json",
        name: `"${row.TABLE_NAME}" database schema`,
      })),
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const resourceUrl = new URL(request.params.uri);

  const pathComponents = resourceUrl.pathname.split("/");
  const schema = pathComponents.pop();
  const tableName = pathComponents.pop();

  if (schema !== SCHEMA_PATH) {
    throw new Error("Invalid resource URI");
  }

  const connection = await pool.getConnection();
  try {
    await beginReadOnlyTransaction(connection);
    const [rows] = await connection.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = ? AND table_schema = DATABASE()",
      [tableName]
    );
    await connection.commit();
    return {
      contents: [
        {
          uri: request.params.uri,
          mimeType: "application/json",
          text: JSON.stringify(rows, null, 2),
        },
      ],
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "query",
        description: "Run a read-only SQL query",
        inputSchema: {
          type: "object",
          properties: {
            sql: { type: "string" },
          },
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "query") {
    const sql = request.params.arguments?.sql as string;

    if (!isQuerySafe(sql)) {
      throw new Error("Only simple SELECT queries are allowed for security reasons");
    }

    const connection = await pool.getConnection();
    try {
      await beginReadOnlyTransaction(connection);
      const [rows] = await connection.query(sql);
      await connection.commit();
      return {
        content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
        isError: false,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  throw new Error(`Unknown tool: ${request.params.name}`);
});

async function runServer(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

process.on('exit', () => {
  pool.end();
});

runServer().catch(console.error);