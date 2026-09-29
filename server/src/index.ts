import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import express from "express";
import { rateLimit } from "express-rate-limit";
import mammoth from "mammoth";
import { AnalysisError, analyzeDocument, type DocumentInput } from "./analyze.js";

const PORT = Number(process.env.PORT ?? 3000);
const APP_TOKEN = process.env.APP_TOKEN;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// What the mobile app sends: one or more files, base64-encoded.
interface UploadBody {
  files?: { name?: string; mimeType?: string; data?: string }[];
  /** Pro feature: include web sources. TODO before launch: verify Pro status with RevenueCat server-side. */
  advanced?: boolean;
}

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "30mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use(
  "/analyze",
  rateLimit({ windowMs: 60 * 60 * 1000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false }),
  (req, res, next) => {
    if (APP_TOKEN && req.get("authorization") !== `Bearer ${APP_TOKEN}`) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    next();
  },
);

async function toDocumentInput(body: UploadBody): Promise<DocumentInput> {
  const files = body.files ?? [];
  if (files.length === 0 || files.some((f) => !f.data || !f.mimeType)) {
    throw new AnalysisError("No file was uploaded.");
  }

  if (files.every((f) => IMAGE_TYPES.has(f.mimeType!))) {
    if (files.length > 20) throw new AnalysisError("Please scan 20 pages or fewer.");
    return {
      kind: "images",
      images: files.map((f) => ({ mediaType: f.mimeType as any, data: f.data! })),
    };
  }

  if (files.length > 1) throw new AnalysisError("Multiple files are only supported for scanned pages.");
  const [file] = files;
  const buffer = Buffer.from(file.data!, "base64");

  switch (file.mimeType) {
    case "application/pdf":
      return { kind: "pdf", data: file.data! };
    case DOCX_TYPE: {
      const { value } = await mammoth.extractRawText({ buffer });
      return { kind: "text", text: value };
    }
    case "text/plain":
    case "text/markdown":
      return { kind: "text", text: buffer.toString("utf8") };
    default:
      throw new AnalysisError(
        file.mimeType?.startsWith("image/")
          ? "That image format isn't supported. Use JPEG or PNG."
          : "Unsupported file type. Upload a PDF, Word (.docx), text file or photos.",
      );
  }
}

app.post("/analyze", async (req, res) => {
  try {
    const input = await toDocumentInput(req.body as UploadBody);
    if (input.kind === "text" && input.text.trim().length < 50) {
      throw new AnalysisError("That file doesn't contain enough text to analyse.");
    }
    res.json(await analyzeDocument(input, { advanced: (req.body as UploadBody).advanced === true }));
  } catch (err) {
    if (err instanceof AnalysisError) {
      res.status(400).json({ error: err.message });
    } else if (err instanceof Anthropic.RateLimitError) {
      res.status(503).json({ error: "The service is busy. Please try again in a minute." });
    } else if (err instanceof Anthropic.BadRequestError) {
      console.error("Claude rejected the request:", err.message);
      res.status(400).json({ error: "The document couldn't be processed. It may be too large or unreadable." });
    } else {
      console.error("analysis failed:", err);
      res.status(500).json({ error: "Something went wrong analysing the document." });
    }
  }
});

app.listen(PORT, () => {
  console.log(`CiteScan server listening on http://localhost:${PORT}`);
  if (!APP_TOKEN) console.warn("APP_TOKEN is not set - /analyze is open to anyone who can reach this server.");
});
