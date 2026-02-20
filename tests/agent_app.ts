import * as os from "os";
import { initChatModel } from "langchain";
import { createAgent } from "langchain";
import { tool } from "@langchain/core/tools";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
// import { DuckDuckGoSearch } from "@langchain/community/tools/duckduckgo_search"
import { BingSearchTool } from '../src/tools/bingSearchTool';
import { WebpageLoaderTool } from '../src/tools/webpageLoaderTool';
import { z } from "zod";

const llmApiKey = process.env.LLM_API_KEY || "12321";

// const tool = new DuckDuckGoSearch({ maxResults: 1 })
const bing_search = new BingSearchTool({ maxResults: 3 });
const webpage_loader = new WebpageLoaderTool();

// Define playwright search tool
const bingSearch = tool(
    async (input: { query: string }): Promise<string> => {
        return await bing_search.search(input.query);
    },
    {
        name: "bing_search",
        description:
            "指定されたクエリでBingを検索して結果を返します。",
        schema: z.object({
            query: z.string().describe("検索クエリやキーワード")
        }),
    }
);

// Define a tool for loading webpages
const webpageLoader = tool(
    async (input: { url: string }): Promise<string> => {
        return await webpage_loader.loadWebpage(input.url);
    },
    {
        name: "webpage_loader",
        description:
            "Bing検索からもらったURLを指定し、ウェブページの内容を返します。",
        schema: z.object({
            url: z.string().describe("ウェブページのURL")
        }),
    }
);

const systemPrompt = `
あなたは日本の法律に特化した役立つ弁護士アシスタントです。
すべての回答は真実でなければならず、回答を作成してはいけません。
質問に正確に答えるため、知識がない場合は、ツールを使用して関連する回答を検索してください。
必要に応じて、指定されたURLからウェブページを読み込んで情報を取得できます。
`;

// Example usage
async function main() {
    try {
        console.log("Initializing LLM...");
        // Initialize LLM and agent
        const llm = await initChatModel(
            "gpt-oss:20b",
            // "olmo-3:7b-instruct",
            // "qwen3-vl:2b",
            // "lfmj125",
            // "lfm",
            {
                modelProvider: "ollama",
                baseURL: "http://localhost:11434/v1", // vLLM server endpoint
                apiKey: llmApiKey, // vLLM doesn't require a real API key by default
                maxTokens: 8192,
            }
        );
        // llm.bindTools([playwrightSearch]);
        console.log("LLM initialized, creating agent...");
        const agent = createAgent({
            model: llm,
            tools: [bingSearch, webpageLoader],
            systemPrompt,
        });
        console.log("Agent created, invoking...");

        console.log("Agent Response:");

        // 使用流式输出
        const stream = await agent.stream({
            messages: [
                new HumanMessage({
                    content: "日本の法律に窃盗罪が定義されていますか？",
                }),
            ],
        }, {
            streamMode: "messages"
        });

        // 实时打印流式输出
        for await (const chunk of stream) {
            if (Array.isArray(chunk) && chunk.length > 0) {
                const [message, metadata] = chunk;
                if (message && typeof message.content === 'string') {
                    process.stdout.write(message.content);
                }
            }
        }
        console.log(); // 添加换行
    } catch (error) {
        console.error("Error:", error);
    }
}

main();