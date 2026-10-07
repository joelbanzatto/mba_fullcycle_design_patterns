import axios from "axios";
import DatabaseConnection from "../src/infra/database/DatabaseConnection";
import PgPromiseAdapter from "../src/infra/database/PgPromiseAdapter";

const url = "http://localhost:3000/close_invoicing";
const queryUrl = "http://localhost:3000/invoices";
const input = { month: 1, year: 2022, type: "accrual" };
const idContract = "4224a279-c162-4283-86f5-1095f559b08c";
let connection: DatabaseConnection;

beforeEach(async function () {
	connection = new PgPromiseAdapter();
	await connection.query("delete from branas.invoice where year = $1", [2022]);
});

afterEach(async function () {
	await connection.query("delete from branas.invoice where year = $1", [2022]);
	await connection.close();
});

test("closes and queries the seeded accrual invoice through the API", async function () {
	const response = await axios.post(url, input);
	expect(response.status).toBe(200);
	expect(response.data).toEqual([{ date: "2022-01-01T13:00:00.000Z", amount: 500 }]);
	const rows = await connection.query("select * from branas.invoice where year = $1", [2022]);
	expect(rows).toHaveLength(1);
	expect(rows[0]).toMatchObject({
		id_contract: idContract, month: 1, year: 2022, type: "accrual", date: new Date("2022-01-01T13:00:00Z")
	});
	expect(Number(rows[0].amount)).toBe(500);
	const query = await axios.get(queryUrl, { params: input });
	expect(query.data).toEqual(response.data);
	expect(query.headers["content-type"]).toContain("application/json");
});

test("replaces the previous closing without duplicating invoices", async function () {
	const first = await axios.post(url, input);
	const previous = await connection.query("select * from branas.invoice where year = $1", [2022]);
	const second = await axios.post(url, input);
	const rows = await connection.query("select * from branas.invoice where year = $1", [2022]);
	expect(second.data).toEqual(first.data);
	expect(rows).toHaveLength(1);
	expect(rows[0].id_invoice).not.toBe(previous[0].id_invoice);
	const query = await axios.get(queryUrl, { params: { ...input, format: "json" } });
	expect(query.data).toEqual(first.data);
});

test("returns plain CSV for a cash closing and preserves the accrual closing", async function () {
	await axios.post(url, input);
	const previous = await connection.query("select * from branas.invoice where year = $1 and type = $2", [2022, "accrual"]);
	const response = await axios.post<string>(url, { ...input, type: "cash", format: "csv" }, {
		responseType: "text", transformResponse: []
	});
	expect(response.data).toBe("2022-01-05;6000");
	expect(response.headers["content-type"]).toContain("text/plain");
	const cash = await connection.query("select * from branas.invoice where year = $1 and type = $2", [2022, "cash"]);
	expect(cash).toHaveLength(1);
	expect(Number(cash[0].amount)).toBe(6000);
	expect(await connection.query("select * from branas.invoice where year = $1 and type = $2", [2022, "accrual"])).toEqual(previous);
	const query = await axios.get<string>(queryUrl, {
		params: { ...input, type: "cash", format: "csv" }, responseType: "text", transformResponse: []
	});
	expect(query.data).toBe("2022-01-05;6000");
	expect(query.headers["content-type"]).toContain("text/plain");
});

test("clears the old closing when the period generates no invoices", async function () {
	await connection.query(
		"insert into branas.invoice (id_contract, month, year, type, date, amount) values ($1, $2, $3, $4, $5, $6)",
		[idContract, 3, 2022, "cash", new Date("2022-03-01T13:00:00Z"), 100]
	);
	const response = await axios.post(url, { month: 3, year: 2022, type: "cash" });
	expect(response.data).toEqual([]);
	expect(await connection.query("select * from branas.invoice where year = $1", [2022])).toEqual([]);
});

test("keeps simulation read-only after a closing", async function () {
	await axios.post(url, input);
	const previous = await connection.query("select * from branas.invoice where year = $1", [2022]);
	const response = await axios.post<string>("http://localhost:3000/generate_invoices", { ...input, format: "csv" }, {
		responseType: "text", transformResponse: []
	});
	expect(response.data).toBe("2022-01-01;500");
	expect(await connection.query("select * from branas.invoice where year = $1", [2022])).toEqual(previous);
	const query = await axios.get(queryUrl, { params: input });
	expect(query.data).toEqual([{ date: "2022-01-01T13:00:00.000Z", amount: 500 }]);
});

test("queries stored invoices in date order without recalculating them", async function () {
	await connection.query(
		"insert into branas.invoice (id_contract, month, year, type, date, amount) values ($1, $2, $3, $4, $5, $6), ($1, $2, $3, $4, $7, $8)",
		[idContract, 1, 2022, "cash", new Date("2022-01-20T13:00:00Z"), 200, new Date("2022-01-05T13:00:00Z"), 100]
	);
	const response = await axios.get(queryUrl, { params: { ...input, type: "cash" } });
	expect(response.data).toEqual([
		{ date: "2022-01-05T13:00:00.000Z", amount: 100 },
		{ date: "2022-01-20T13:00:00.000Z", amount: 200 }
	]);
});

test("returns an empty list when the queried period has no closing", async function () {
	const response = await axios.get(queryUrl, { params: { month: 3, year: 2023, type: "cash" } });
	expect(response.data).toEqual([]);
});
