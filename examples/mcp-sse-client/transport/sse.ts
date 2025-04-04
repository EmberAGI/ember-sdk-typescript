import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import setupServer from "./tools.js";


/**
 * Sets up an SSE (Server-Sent Events) endpoint for communication.
 */
function setupSSE(app: express.Application, server: McpServer) {
    setupServer(server);

    // Store active SSE connections
    const sseConnections = new Set();

    let transport: SSEServerTransport;

    /**
     * Establishes an SSE connection.
     * Clients can connect to this endpoint to receive real-time updates.
     */
    app.get("/sse", async (_req, res) => {
        transport = new SSEServerTransport("/messages", res);
        await server.connect(transport);

        // Add connection to active set
        sseConnections.add(res);

        // Setup keepalive interval
        const keepaliveInterval = setInterval(() => {
            if (res.writableEnded) {
                clearInterval(keepaliveInterval);
                return;
            }
            res.write(':keepalive\n\n');
        }, 30000); // Send keepalive every 30 seconds

        // Handle client disconnect
        _req.on('close', () => {
            clearInterval(keepaliveInterval);
            sseConnections.delete(res);
            transport.close?.();
        });

        // Handle errors
        res.on('error', (err) => {
            console.error('SSE Error:', err);
            clearInterval(keepaliveInterval);
            sseConnections.delete(res);
            transport.close?.();
        });
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