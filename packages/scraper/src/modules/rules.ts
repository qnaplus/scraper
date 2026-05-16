import { getDefaultFetcherOptions } from "../clients";
import type { FetcherOptions } from "./fetchers";

export const RULE_TABLE_PATTERN = /(?<name><[A-Z]+\d+>) (?<summary>[A-Z](?:.+\.?))+?/g;

export interface Rule {
    name: string;
    summary: string;
}

async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await getDocument({ data: new Uint8Array(buffer) }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        let pageText = "";
        for (const item of content.items) {
            if ("str" in item) {
                pageText += item.str;
                if (item.hasEOL) pageText += "\n";
            }
        }
        pages.push(pageText);
    }
    return pages.join("\n");
}

export const extractRules = async (
    url: string,
    options?: FetcherOptions,
): Promise<Rule[] | null> => {
    const logger = options?.logger?.child({ label: "extractRules" });
    const { client, teardown } = await getDefaultFetcherOptions(options);
    const buffer = await client.buffer(url);
    if (buffer === null) {
        return null;
    }
    const text = await extractPdfText(buffer);
    const matches = Array.from(text.matchAll(RULE_TABLE_PATTERN));
    const rules: Rule[] = [];
    for (const match of matches) {
        const name = match.groups?.name;
        const summary = match.groups?.summary;
        if (name === undefined || summary === undefined || rules.find((r) => r.name === name)) {
            logger?.trace(`Already added rule ${name}, skipping.`);
            continue;
        }
        logger?.debug({ name, summary }, `Adding new rule: ${name}`);
        rules.push({ name, summary });
    }
    if (teardown) {
        await client.teardown();
    }
    logger?.debug(`Found ${rules.length} rules.`);
    return rules;
};
