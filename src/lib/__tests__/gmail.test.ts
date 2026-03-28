import { describe, it, expect } from "vitest";
import { extractBody } from "../gmail";

function base64Encode(str: string): string {
  return Buffer.from(str, "utf-8").toString("base64");
}

describe("extractBody", () => {
  it("text/html ペイロードからHTMLを抽出する", () => {
    const html = "<html>テスト</html>";
    const result = extractBody({
      mimeType: "text/html",
      body: { data: base64Encode(html) },
    });
    expect(result).toBe(html);
  });

  it("multipart/alternative からHTML部分を抽出する", () => {
    const html = "<html>マルチパート</html>";
    const result = extractBody({
      mimeType: "multipart/alternative",
      parts: [
        { mimeType: "text/plain", body: { data: base64Encode("plain") } },
        { mimeType: "text/html", body: { data: base64Encode(html) } },
      ],
    });
    expect(result).toBe(html);
  });

  it("ネストされたパーツからHTMLを抽出する", () => {
    const html = "<html>ネスト</html>";
    const result = extractBody({
      mimeType: "multipart/mixed",
      parts: [
        {
          mimeType: "multipart/alternative",
          parts: [
            { mimeType: "text/html", body: { data: base64Encode(html) } },
          ],
        },
      ],
    });
    expect(result).toBe(html);
  });

  it("null ペイロードの場合は空文字を返す", () => {
    expect(extractBody(null)).toBe("");
  });

  it("bodyデータがないペイロードの場合は空文字を返す", () => {
    const result = extractBody({
      mimeType: "multipart/mixed",
      parts: [{ mimeType: "text/plain", body: {} }],
    });
    expect(result).toBe("");
  });
});
