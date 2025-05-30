import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { ConnectionOptions } from 'mysql2';
import express from 'express';
import cors from 'cors';

dotenv.config({ path: '../.env' });

// Create Express app
const app = express();
app.use(cors());
app.use(express.json());

const dbConfig: ConnectionOptions = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER ,
    password: process.env.DB_PASSWORD,
};

// Function to create a server instance
function getServer() {
  const server = new McpServer({
    name: "sid-mcp",
    version: "1.0.0",
    capabilities: {
      resources: {},
      tools: {},
    },
  });

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
  );

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

  return server;
}

async function main() {
  const port = parseInt(process.env.PORT || '5000', 10);

  // Add a health check endpoint
  app.get('/health', (req, res) => {
    console.log(process.env.ENV)
    res.status(200).send('OK');
  });

  app.post('/mcp', async (req: express.Request, res: express.Response) => {
    // In stateless mode, create a new instance of transport and server for each request
    // to ensure complete isolation. A single instance would cause request ID collisions
    // when multiple clients connect concurrently.
    
    try {
      const server = getServer(); 
      const transport: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      }); 
      
      res.on('close', () => {
        console.log('Request closed');
        transport.close();
        server.close();
      });
      
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error('Error handling MCP request:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error',
          },
          id: null,
        });
      }
    }
  });

  app.get('/mcp', async (req: express.Request, res: express.Response) => {
    console.log('Received GET MCP request');
    res.writeHead(405).end(JSON.stringify({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Method not allowed."
      },
      id: null
    }));
  });

  app.delete('/mcp', async (req: express.Request, res: express.Response) => {
    console.log('Received DELETE MCP request');
    res.writeHead(405).end(JSON.stringify({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Method not allowed."
      },
      id: null
    }));
  });

  // Listen on all interfaces
  app.listen(port, '0.0.0.0', () => {
    console.log(`SID nav running on port ${port}`);
  });
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
