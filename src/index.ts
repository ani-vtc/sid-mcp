import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { ConnectionOptions } from 'mysql2';
import express from 'express';
import cors from 'cors';
import { anyQuery, getDatabases, getTables } from "./functions/queryFunctions.js";
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
        console.log(process.env.ENV)
        if (process.env.ENV === 'dev') {
          const connection = await mysql.createConnection(dbConfig);
          const [rows] = await connection.execute('SELECT * FROM ' + database + '.' + table + ' LIMIT 20') as any;
          await connection.end();
          return {
            content: [{ type: "text", text: JSON.stringify({ rows: rows })}]
          };
        } else {
          const rows = await anyQuery({
            prj: process.env.PRJ,
            ds: database,
            tbl: table,
            select: "*",
            conditions: ["limit 20"]
          });
          return {
            content: [{ type: "text", text: JSON.stringify({ rows: rows })}]
          };
        }
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
            if (process.env.ENV === 'dev') {
              const connection = await mysql.createConnection(dbConfig);
              const [rows] = await connection.execute('SHOW TABLES IN ' + database) as any;
              await connection.end();
              return {
                  content: [{ type: "text", text: JSON.stringify({ tables: rows })}]
              };
            } else {
              const rows = await getTables({
                prj: process.env.PRJ,
                ds: database,
              });
              return {
                content: [{ type: "text", text: JSON.stringify({ tables: rows })}]
              };
            }
          } catch (error: any) {
              console.error('Error fetching tables:', error);
              return {
                  content: [{ type: "text", text: JSON.stringify({ error: 'Failed to fetch tables', details: error.message })}]
              };
          }
      }
  );

  server.tool(
    "getDatabases", 
    "Get the list of databases on the server", 
    {
        
    }, 
    async () => {
      try {
        if (process.env.ENV === 'dev') {
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
        } else {
          const rows = await getDatabases();
          return {
            content: [{
              type: "text",
              text: JSON.stringify({ databases: rows })
            }]
          };
        }
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

server.tool(
  "changeDatabase",
  "Change the database selected to the one provided",
  {
    database: z.string().describe("The name of the database to change to"),
  },
  async ({database}) => {
    try {
      const rows = await getDatabases();
      if (rows.includes(database)) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ message: 'Database changed to ' + database })
          }]
        }
      } else {
        throw new Error('Database not found');
      }
    } catch (error: any) {
      console.error('Error changing database:', error);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ error: 'Failed to change database', details: error.message })
        }]
      };
    }
  })

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
    // res.writeHead(405).end(JSON.stringify({
    //   jsonrpc: "2.0",
    //   error: {
    //     code: -32000,
    //     message: "Method not allowed."
    //   },
    //   id: null
    // }));
    res.status(200).send('OK');
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
