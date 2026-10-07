import axios from "axios";

const url = "http://localhost:3000/generate_invoices";

test.each([
	["cash", "2022-01-05;6000"],
	["accrual", "2022-01-01;500"]
])("returns unquoted CSV over HTTP for %s", async function (type, expected) {
	const response = await axios.post<string>(url, {
		month: 1, year: 2022, type, format: "csv"
	}, { responseType: "text", transformResponse: [] });
	expect(response.status).toBe(200);
	expect(response.data).toBe(expected);
	expect(response.headers["content-type"]).toContain("text/plain");
});

test("returns JSON when explicitly requested over HTTP", async function () {
	const response = await axios.post(url, { month: 1, year: 2022, type: "accrual", format: "json" });
	expect(response.status).toBe(200);
	expect(response.data).toEqual([{ date: "2022-01-01T13:00:00.000Z", amount: 500 }]);
	expect(response.headers["content-type"]).toContain("application/json");
});

test("returns an empty text body when no invoices match a CSV request", async function () {
	const response = await axios.post<string>(url, {
		month: 3, year: 2023, type: "cash", format: "csv"
	}, { responseType: "text", transformResponse: [] });
	expect(response.status).toBe(200);
	expect(response.data).toBe("");
	expect(response.headers["content-type"]).toContain("text/plain");
});
