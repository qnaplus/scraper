import {
	BrowserPresets,
	type BrowserType,
	type ChromePresetVersion,
	type CurlResultOk,
	type FirefoxPresetVersion,
	RequestBuilder,
	type RequestPreset,
	type SafariPresetVersion,
	getCompatibleBrowsers,
} from "@qnaplus/node-curl-impersonate";
import { FetchClient, type FetchClientResponse } from "@qnaplus/scraper";

export class CurlImpersonateScrapingClient extends FetchClient<FetchClientResponse> {
	async fetch(url: string): Promise<FetchClientResponse> {
		const browsers = getCompatibleBrowsers();
		const badStatusCodes = [403];
		let latestResponse: FetchClientResponse = {
			ok: false,
			body: "",
			status: -1,
			url: "",
		};

		// TODO: when a bad status code is not recieved, cache the preset that was used.
		// Continue using that preset until failure, then search again for another working preset.
		for (const browser of browsers) {
			for (const version of Object.keys(BrowserPresets[browser.name])) {
				const { response, details } = await this.doPresetRequest(url, {
					name: browser.name,
					version: version as
						| ChromePresetVersion
						| FirefoxPresetVersion
						| SafariPresetVersion,
				});
				latestResponse = {
					body: response,
					ok: details.response_code === 200,
					url: details.url_effective,
					status: details.response_code,
				};
				if (!badStatusCodes.includes(details.response_code)) {
					return latestResponse;
				}
				this.logger?.trace(
					`Request did not return an accepted response code (preset: ${browser.name} v${version})`,
				);
			}
		}
		this.logger?.trace(
			`All presets failed (latest response: ${latestResponse}`,
		);
		return latestResponse;
	}

	async buffer(): Promise<ArrayBufferLike | null> {
		// TODO: implement reading response buffer
		return null;
	}

	teardown(): Promise<void> | void {}

	private async doPresetRequest<T extends BrowserType>(
		url: string,
		preset: RequestPreset<T>,
	): Promise<CurlResultOk> {
		const response = await new RequestBuilder()
			.url(url)
			.preset(preset)
			.follow()
			.send();
		if (response.stderr !== undefined) {
			throw new Error(response.stderr); // TODO figure out how to handle this
		}
		return response;
	}
}
