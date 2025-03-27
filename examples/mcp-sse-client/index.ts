#!/usr/bin/env node

import * as dotenv from "dotenv";
import { createSSEServer } from "./transport/sse.js";
import { createStdioServer } from "./transport/stdio.js";

dotenv.config();

const SSE_PORT = process.env.SSE_PORT || 3002;

/**
 * Main function to start the server.
 * It checks for a command-line flag (`--sse`) to determine whether to use SSE transport.
 * If `--sse` is provided, it starts an SSE server; otherwise, it defaults to a Stdio server.
 */
async function main() {
    // Check if SSE transport is requested via command line flag
    const useSSE = process.argv.includes("--sse");
    if (useSSE) {

        // Start the SSE server on the specified port
        await createSSEServer().then((app) =>
            app.listen(SSE_PORT, () => {
                console.log(`SSE server listening on port ${SSE_PORT}`);
            })
        );
    } else {

        // Start the Stdio server
        await createStdioServer();
    }
}

// Execute the main function and handle any errors
main().catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
});