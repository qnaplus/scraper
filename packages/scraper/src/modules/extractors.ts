import * as cheerio from "cheerio";
import SELECTORS from "../selectors";
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
): string;
function selectHtml(
	$: cheerio.CheerioAPI,
	selectorKey: keyof typeof SELECTORS,
	required: false,
	raw?: boolean,
): string | null;
function selectHtml(
	$: cheerio.CheerioAPI,
	selectorKey: keyof typeof SELECTORS,
	required: boolean,
	raw?: boolean,
): string | null {
	const selector = SELECTORS[selectorKey];
	const text = raw ? unleak(unformat($(selector).html())) : unleak(unformat($(selector).text()));
	const isEmptyString = text.trim() === "";
	if (required && isEmptyString) {
		throw new Error(`Failed to get required selector '${selectorKey}'`);
	}
	return isEmptyString ? null : text;
}

export const extractPageQuestions = ({ html }: ScrapedPage<QnaPageUrl>): QnaIdUrl[] => {
	const $ = cheerio.load(html);
	return $(SELECTORS.URLS)
		.toArray()
		.map((el) => $(el).attr("href"))
		.filter((s): s is QnaIdUrl => s !== undefined);
};

export const extractPageCount = ({ html }: ScrapedPage<QnaHomeUrl>): number => {
	const $ = cheerio.load(html);
	const el = $(SELECTORS.PAGE_COUNT);
	return Number.isNaN(Number.parseInt(el.text())) ? 1 : Number.parseInt(el.text());
};

export const extractQuestion = ({ html, url }: ScrapedPage<QnaIdUrl>): Question => {
	const $ = cheerio.load(html);

	const { id, program, season } = parseQnaUrlWithId(url);
	const author = selectHtml($, "AUTHOR", true);
	const title = selectHtml($, "TITLE", true);
	const question = selectHtml($, "QUESTION", true);
	const questionRaw = selectHtml($, "QUESTION", true, true);
	const answer = selectHtml($, "ANSWER", false);
	const answerRaw = selectHtml($, "ANSWER", false, true);
	const askedTimestamp = selectHtml($, "ASKED_TIMESTAMP", true);
	const askedTimestampMs = new Date(askedTimestamp).getTime();
	const answeredTimestamp = selectHtml($, "ANSWERED_TIMESTAMP", false);
	const answeredTimestampMs =
		answeredTimestamp !== null ? new Date(answeredTimestamp).getTime() : null;
	const answered = answer !== null;
	const tags = $(SELECTORS.TAGS)
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

export const extractReadOnly = ({ html }: ScrapedPage<QnaHomeUrl>): boolean => {
	const $ = cheerio.load(html);
	return selectHtml($, "READONLY", false) !== null;
};
