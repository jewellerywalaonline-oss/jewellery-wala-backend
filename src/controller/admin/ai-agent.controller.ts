import type { Request, Response } from "express";
import {
  streamText,
  isStepCount,
  toUIMessageStream,
  pipeUIMessageStreamToResponse,
} from "ai";
import type { UIMessage } from "ai";
import { resolveModel, listConfiguredProviders, type AiProviderName } from "../../lib/ai-providers.js";
import { logger } from "../../lib/logger.js";
import AiResponse from "../../models/aiResponse.js";
import { agentTools } from "./ai-agent/tools.js";
import { SYSTEM_PROMPT } from "./ai-agent/system-prompt.js";
/// <reference path="../../types/express.d.ts" />

export const listProviders = async (_req: Request, res: Response): Promise<Response> => {
  return res.status(200).json({ _status: true, _data: listConfiguredProviders() });
};

export const listHistory = async (req: Request, res: Response): Promise<Response> => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 20)));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      AiResponse.find({ page: "ai-agent", adminId: req.user?._id })
        .select("messages createdAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AiResponse.countDocuments({ page: "ai-agent", adminId: req.user?._id }),
    ]);

    return res.status(200).json({
      _status: true,
      _data: {
        items: items.map((i) => ({
          _id: i._id,
          messages: i.messages,
          createdAt: i.createdAt,
        })),
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (err) {
    logger.error({ err }, "Error listing AI agent history");
    return res.status(500).json({ _status: false, _message: "Failed to fetch history" });
  }
};

export const deleteConversation = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ _status: false, _message: "Conversation ID is required" });
    const deleted = await AiResponse.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ _status: false, _message: "Conversation not found" });
    return res.status(200).json({ _status: true, _message: "Conversation deleted" });
  } catch (err) {
    logger.error({ err }, "Delete conversation error");
    return res.status(500).json({ _status: false, _message: "Failed to delete conversation" });
  }
};

const STREAM_TIMEOUT_MS = 300_000;

/**
 * Convert UIMessage[] to the format expected by streamText / the model provider.
 *
 * The AI SDK's own convertToModelMessages was producing messages with
 * `content` as an array (from UIMessage.parts) which OpenRouter's provider
 * rejects. This helper flattens text parts into a plain string and strips
 * dynamic-tool parts that are internal to the AI SDK UI streaming format.
 */
function convertToModelFormat(
  messages: UIMessage[],
): { role: "user" | "assistant"; content: string }[] {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => {
      // Flatten parts into plain text. The OpenRouter-free model and similar
      // providers only accept `content` as a plain string (not an array).
      const textParts: string[] = [];
      for (const p of m.parts ?? []) {
        if (p.type === "text") {
          textParts.push(p.text);
        } else if (p.type === "tool-call") {
          // Serialise tool calls as pseudo-text so the model can "see" them
          const tc = p as unknown as { toolName: string; args: unknown };
          textParts.push(
            `[Tool call: ${tc.toolName}(${JSON.stringify(tc.args)})]`,
          );
        } else if (p.type === "tool-result") {
          // Truncate large results to avoid blowing the context window
          const tr = p as unknown as { result: unknown };
          const result =
            typeof tr.result === "object"
              ? JSON.stringify(tr.result).slice(0, 500)
              : String(tr.result).slice(0, 500);
          textParts.push(`[Tool result: ${result}]`);
        }
        // dynamic-tool parts — AI SDK internal, skip
      }
      return {
        role: m.role as "user" | "assistant",
        content: textParts.join("\n"),
      };
    })
    .filter((m) => m.content.length > 0);
}

export const chat = async (req: Request, res: Response): Promise<void> => {
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    abortController.abort(new Error("Stream timeout"));
  }, STREAM_TIMEOUT_MS);

  try {
    const { messages, provider, conversationId } = req.body as {
      messages?: UIMessage[];
      provider?: AiProviderName;
      conversationId?: string;
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ _status: false, _message: "Messages array is required" });
      return;
    }

    const configured = listConfiguredProviders();
    if (configured.length === 0) {
      res.status(503).json({ _status: false, _message: "AI is not configured on the server" });
      return;
    }

    let model;
    try {
      model = resolveModel(provider);
    } catch (err) {
      res.status(400).json({
        _status: false,
        _message: err instanceof Error ? err.message : "Selected AI provider is not available",
      });
      return;
    }

    const result = streamText({
      model,
      system: SYSTEM_PROMPT,
      messages: convertToModelFormat(messages),
      tools: agentTools,
      stopWhen: isStepCount(20),
      temperature: 0.2,
      maxOutputTokens: 8192,
      abortSignal: abortController.signal,
    });

    const adminId = req.user?._id;

    const uiStream = toUIMessageStream({
      stream: result.stream,
      originalMessages: messages,
      onEnd: async ({ messages: finalMessages }) => {
        const text = finalMessages
          .flatMap((m) => m.parts?.filter((p) => p.type === "text").map((p) => (p as { text: string }).text))
          .join("") || "";
        const promptText = messages[0]?.parts?.filter((p) => p.type === "text").map((p) => (p as { text: string }).text).join("").slice(0, 500) || "";
        const historyData = {
          page: "ai-agent" as const,
          adminId,
          prompt: promptText,
          response: text.slice(0, 10000) || "...",
          messages: finalMessages,
          conversationId: conversationId || null,
        };

        const saveConversation = () =>
          conversationId
            ? AiResponse.findOneAndUpdate(
                { conversationId },
                { $set: historyData },
                { upsert: true, new: true },
              )
            : new AiResponse(historyData).save();

        try {
          await saveConversation();
        } catch (saveErr) {
          logger.error({ err: saveErr, conversationId, adminId }, "Failed to save AI response, retrying once");
          try {
            await saveConversation();
          } catch (retryErr) {
            logger.error({ err: retryErr, conversationId, adminId }, "AI response save failed after retry");
          }
        }
      },
    });

    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    // pipeUIMessageStreamToResponse writes the AI SDK data-format and calls
    // res.end() when done. Await it so the handler stays alive for the whole
    // streaming session — otherwise the finally block would tear things down.
    await pipeUIMessageStreamToResponse({ response: res, stream: uiStream });
  } catch (err) {
    logger.error({ err }, "AI agent chat error");
    if (!res.headersSent) {
      res.status(500).json({ _status: false, _message: err instanceof Error ? err.message : "Internal server error" });
    }
  } finally {
    clearTimeout(timeoutId);
    // No abortController.abort() — the controller was only needed for the
    // timeout. Calling it here would kill the stream response.
  }
};
