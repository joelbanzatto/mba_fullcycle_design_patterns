import axios from "axios";
import { once } from "events";
import { Server } from "http";
import { AddressInfo } from "net";
import ExpressAdapter from "../src/infra/http/ExpressAdapter";

let adapter: ExpressAdapter;
let server: Server;
let url: string;

beforeEach(async function () {
	adapter = new ExpressAdapter();
	server = adapter.app.listen(0, "127.0.0.1");
	await once(server, "listening");
	url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async function () {
	await new Promise<void>((resolve, reject) => {
		server.close(error => error ? reject(error) : resolve());
	});
});

test("passes query strings after params, body, and headers without changing JSON responses", async function () {
	adapter.on("post", "/request/:id", async function (params: any, body: any, headers: any, query: any) {
		return { params, body, userAgent: headers["user-agent"], query };
	});
	const response = await axios.post(`${url}/request/contract?month=1&year=2022`, { type: "cash" }, {
		headers: { "User-Agent": "adapter-test" }
	});
	expect(response.data).toEqual({
		params: { id: "contract" },
		body: { type: "cash" },
		userAgent: "adapter-test",
		query: { month: "1", year: "2022" }
	});
	expect(response.headers["content-type"]).toContain("application/json");
});
