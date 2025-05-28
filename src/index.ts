import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HttpServerTransport } from "@modelcontextprotocol/sdk/server/http.js";
import { z } from "zod";
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { ConnectionOptions } from 'mysql2';
import path from 'path';
import express from 'express';
import cors from 'cors';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Create Express app
const app = express();
app.use(cors());
app.use(express.json());

// Create server instance
const server = new McpServer({
  name: "sid-mcp",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

const dbConfig: ConnectionOptions = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'admin',
    password: process.env.DB_PASSWORD || '49-visthinkCo-123!',
  };

//MCP SERVER TOOLS
server.tool(
  "getFirst20Rows",
  "Get the first 20 rows of a table",
  {
    table: z.string().describe("The name of the table to get the first 20 rows from"),
    database: z.string().describe("The name of the database to the table belongs to"),
  },
  async ({table, database}) => {
    try {
      const connection = await mysql.createConnection(dbConfig);
      const [rows] = await connection.execute('SELECT * FROM ' + database + '.' + table + ' LIMIT 20') as any;
      await connection.end();
      return {
        content: [{ type: "text", text: JSON.stringify({ rows: rows })}]
      };
    } catch (error: any) {
      console.error('Error fetching rows:', error);
      return {
        content: [{ type: "text", text: JSON.stringify({ error: 'Failed to fetch rows', details: error.message })}]
      };
    }
  }
)
server.tool(
    "getTables", 
    "Get the list of tables in a database", 
    {
        database: z.string().describe("The name of the database to get the tables from"),
    }, 
    async ({database}) => {
        try {
            const connection = await mysql.createConnection(dbConfig);
            const [rows] = await connection.execute('SHOW TABLES IN ' + database) as any;
            await connection.end();
            return {
                content: [{ type: "text", text: JSON.stringify({ tables: rows })}]
            };
        } catch (error: any) {
            console.error('Error fetching tables:', error);
            return {
                content: [{ type: "text", text: JSON.stringify({ error: 'Failed to fetch tables', details: error.message })}]
            };
        }
    }
);

//Get the list of databases on the server
server.tool(
    "getDatabases",
    "Get the list of databases on the server",
    {
      type: "object",
      properties: {},
      additionalProperties: false
    },
    async () => {
      try {
        const connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.execute('SHOW DATABASES') as any;
        await connection.end();
        if (!rows || rows.length === 0) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({ error: 'No databases found' })
            }]
          };
        }
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ databases: rows })
          }]
        };
      } catch (error: any) {
        console.error('Error fetching databases:', error);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ error: 'Failed to fetch databases', details: error.message})
          }]
        };
      }
    }
  );

async function main() {
  const port = process.env.PORT || 8080;
  const transport = new HttpServerTransport(app);
  await server.connect(transport);
  
  app.listen(port, () => {
    console.log(`SID nav running on port ${port}`);
  });
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
