import { describe, expect, it } from "vitest";
import { checkIfReadOnly } from "../src/modules/fetchers";

describe("checkIfReadOnly", () => {
	it("shall report the 2025-2026 V5RC Q&A as readonly", async () => {
		const readOnly = await checkIfReadOnly("V5RC", "2025-2026");
		expect(readOnly).toBe(true);
	});
});
