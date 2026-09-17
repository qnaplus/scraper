import * as cheerio from "cheerio";
import SELECTORS, { ScrapingSelectors } from "../selectors";
import type { Question } from "../types";
import { type QnaHomeUrl, type QnaIdUrl, type QnaPageUrl, parseQnaUrlWithId } from "./parsing";

export interface ScrapedPage<U extends string = string> {
	url: U;
	html: string;
}

const unformat = (str: string | undefined | null): string => {
	return (str ?? "")
		.split(/\n/g)
		.map((n) => n.trim())
		.filter(Boolean)
		.join("");
};

// https://bugs.chromium.org/p/v8/issues/detail?id=2869
export const unleak = (str: string | undefined | null): string => {
	// biome-ignore lint: style/useTemplate
	return (" " + (str ?? "")).slice(1);
};

function selectHtml(
	$: cheerio.CheerioAPI,
	selectorKey: keyof typeof SELECTORS,
	required: true,
	raw?: boolean,
	selectorOverrides?: Partial<ScrapingSelectors>,
): string;
function selectHtml(
	$: cheerio.CheerioAPI,
	selectorKey: keyof typeof SELECTORS,
	required: false,
	raw?: boolean,
	selectorOverrides?: Partial<ScrapingSelectors>,
): string | null;
function selectHtml(
	$: cheerio.CheerioAPI,
	selectorKey: keyof typeof SELECTORS,
	required: boolean,
	raw?: boolean,
	selectorOverrides?: Partial<ScrapingSelectors>,
): string | null {
	const selector = selectorOverrides?.[selectorKey] ?? SELECTORS[selectorKey];
	const text = raw ? unleak(unformat($(selector).html())) : unleak(unformat($(selector).text()));
	const isEmptyString = text.trim() === "";
	if (required && isEmptyString) {
		throw new Error(`Failed to get required selector '${selectorKey}'`);
	}
	return isEmptyString ? null : text;
}

export const extractPageQuestions = (
	{ html }: ScrapedPage<QnaPageUrl>,
	selectorOverrides?: Partial<ScrapingSelectors>,
): QnaIdUrl[] => {
	const $ = cheerio.load(html);
	return $(selectorOverrides?.URLS ?? SELECTORS.URLS)
		.toArray()
		.map((el) => $(el).attr("href"))
		.filter((s): s is QnaIdUrl => s !== undefined);
};

export const extractPageCount = (
	{ html }: ScrapedPage<QnaHomeUrl>,
	selectorOverrides?: Partial<ScrapingSelectors>,
): number => {
	const $ = cheerio.load(html);
	const el = $(selectorOverrides?.PAGE_COUNT ?? SELECTORS.PAGE_COUNT);
	return Number.isNaN(Number.parseInt(el.text())) ? 1 : Number.parseInt(el.text());
};

export const extractQuestion = (
	{ html, url }: ScrapedPage<QnaIdUrl>,
	selectorOverrides?: Partial<ScrapingSelectors>,
): Question => {
	const $ = cheerio.load(html);

	const { id, program, season } = parseQnaUrlWithId(url);
	const author = selectHtml($, "AUTHOR", true, false, selectorOverrides);
	const title = selectHtml($, "TITLE", true, false, selectorOverrides);
	const question = selectHtml($, "QUESTION", true, false, selectorOverrides);
	const questionRaw = selectHtml($, "QUESTION", true, true, selectorOverrides);
	const answer = selectHtml($, "ANSWER", false, false, selectorOverrides);
	const answerRaw = selectHtml($, "ANSWER", false, true, selectorOverrides);
	const askedTimestamp = selectHtml($, "ASKED_TIMESTAMP", true, false, selectorOverrides);
	const askedTimestampMs = new Date(askedTimestamp).getTime();
	const answeredTimestamp = selectHtml($, "ANSWERED_TIMESTAMP", false, false, selectorOverrides);
	const answeredTimestampMs =
		answeredTimestamp !== null ? new Date(answeredTimestamp).getTime() : null;
	const answered = answer !== null;
	const tags = $(selectorOverrides?.TAGS ?? SELECTORS.TAGS)
		.map((_i, el) => unleak($(el).text().trim()))
		.get();

	return {
		id,
		url,
		program,
		season,
		author,
		title,
		question,
		questionRaw,
		answer,
		answerRaw,
		askedTimestamp,
		askedTimestampMs,
		answeredTimestamp,
		answeredTimestampMs,
		answered,
		tags,
	};
};

export const extractReadOnly = (
	{ html }: ScrapedPage<QnaHomeUrl>,
	selectorOverrides?: Partial<ScrapingSelectors>,
): boolean => {
	const $ = cheerio.load(html);
	return selectHtml($, "READONLY", false, false, selectorOverrides) !== null;
};
