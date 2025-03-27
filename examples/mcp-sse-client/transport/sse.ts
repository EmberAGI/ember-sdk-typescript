import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import setupServer from "./tools.js";


/**
 * Sets up an SSE (Server-Sent Events) endpoint for communication.
 */
function setupSSE(app: express.Application, server: McpServer) {
    setupServer(server);

    let transport: SSEServerTransport;

    /**
     * Establishes an SSE connection.
     * Clients can connect to this endpoint to receive real-time updates.
     */
    app.get("/sse", async (req, res) => {
        transport = new SSEServerTransport("/messages", res);
        await server.connect(transport);
    });

    /**
     * Handles incoming messages from clients.
     * Messages are sent to the SSE transport for processing.
     */
    app.post("/messages", async (req, res) => {
        if (!transport) {
            res.status(400).send("No transport found");
            return;
        }
        await transport.handlePostMessage(req, res);
    });
}


/**
 * Creates and initializes an SSE-enabled MCP server.
 */
export async function createSSEServer() {
    const app = express();
    const server = new McpServer(
        {
            name: 'MCP SSE Chat Server',
            version: '1.0.0',
        },
        {
            capabilities: {
                resources: {},
            },
        }
    );

    // Setup SSE routes for real-time communication
    setupSSE(app, server);

    return app;
}