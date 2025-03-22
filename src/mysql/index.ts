#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import mysql from "mysql2/promise";

const server = new Server(
  {
    name: "mcp-server-mysql",
    version: "0.1.1",
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

const pool = mysql.createPool(databaseUrl);

const SCHEMA_PATH = "schema";

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()"
    );
    return {
      resources: (rows as any[]).map((row) => ({
        uri: new URL(`${row.TABLE_NAME}/${SCHEMA_PATH}`, resourceBaseUrl).href,
        mimeType: "application/json",
        name: `"${row.TABLE_NAME}" database schema`,
      })),
    };
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
    await connection.query("SET TRANSACTION READ ONLY");
    await connection.beginTransaction();
    const [rows] = await connection.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = ? AND table_schema = DATABASE()",
      [tableName]
    );

    return {
      contents: [
        {
          uri: request.params.uri,
          mimeType: "application/json",
          text: JSON.stringify(rows, null, 2),
        },
      ],
    };
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

    // DDLクエリを検出して実行を防ぐ
    const ddlKeywords = [
      "CREATE", "ALTER", "DROP", "TRUNCATE", "RENAME",
      "GRANT", "REVOKE", "SET PASSWORD", "LOCK TABLES", "UNLOCK TABLES"
    ];
    const upperSql = sql.toUpperCase();
    const containsDDL = ddlKeywords.some(keyword =>
      upperSql.includes(keyword + " ") || upperSql.startsWith(keyword + " ")
    );

    if (containsDDL) {
      throw new Error("DDL queries are not allowed for security reasons");
    }

    const connection = await pool.getConnection();
    try {
      await connection.query("SET TRANSACTION READ ONLY");
      await connection.beginTransaction();
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

runServer().catch(console.error);
