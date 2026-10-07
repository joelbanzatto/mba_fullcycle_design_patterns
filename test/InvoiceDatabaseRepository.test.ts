import DatabaseConnection from "../src/infra/database/DatabaseConnection";
import PgPromiseAdapter from "../src/infra/database/PgPromiseAdapter";
import InvoiceDatabaseRepository from "../src/infra/repository/InvoiceDatabaseRepository";

const idContract = "4224a279-c162-4283-86f5-1095f559b08c";
const invoice = { idContract, date: new Date("2030-06-01T13:00:00Z"), amount: 500 };
let connection: DatabaseConnection;
let repository: InvoiceDatabaseRepository;

beforeEach(async function () {
	connection = new PgPromiseAdapter();
	repository = new InvoiceDatabaseRepository(connection);
	await connection.query("delete from branas.invoice where year in ($1, $2)", [2029, 2030]);
});

afterEach(async function () {
	await connection.query("delete from branas.invoice where year in ($1, $2)", [2029, 2030]);
	await connection.close();
});

test("persists every invoice with its contract and period", async function () {
	await repository.replacePeriod(6, 2030, "cash", [invoice, { ...invoice, amount: 700 }]);
	const rows = await connection.query("select * from branas.invoice where year = $1 order by amount", [2030]);
	expect(rows).toHaveLength(2);
	expect(rows.map((row: any) => ({
		idContract: row.id_contract, month: row.month, year: row.year, type: row.type, date: row.date, amount: Number(row.amount)
	}))).toEqual([
		{ ...invoice, month: 6, year: 2030, type: "cash" },
		{ ...invoice, month: 6, year: 2030, type: "cash", amount: 700 }
	]);
});

test("replaces a batch without changing other months or regimes", async function () {
	await repository.replacePeriod(6, 2030, "cash", [invoice, invoice]);
	await repository.replacePeriod(6, 2030, "accrual", [invoice]);
	await repository.replacePeriod(7, 2030, "cash", [{ ...invoice, date: new Date("2030-07-01T13:00:00Z") }]);
	const otherPeriods = await connection.query(
		"select * from branas.invoice where year = $1 and (month <> $2 or type <> $3) order by month, type", [2030, 6, "cash"]
	);
	await repository.replacePeriod(6, 2030, "cash", [{ ...invoice, amount: 900 }]);
	const replacement = await connection.query("select * from branas.invoice where year = $1 and month = $2 and type = $3", [2030, 6, "cash"]);
	expect(replacement).toHaveLength(1);
	expect(Number(replacement[0].amount)).toBe(900);
	expect(await connection.query(
		"select * from branas.invoice where year = $1 and (month <> $2 or type <> $3) order by month, type", [2030, 6, "cash"]
	)).toEqual(otherPeriods);
});

test("restores the previous batch when a later insert fails", async function () {
	await repository.replacePeriod(6, 2030, "cash", [invoice]);
	const previous = await connection.query("select * from branas.invoice where year = $1", [2030]);
	await expect(repository.replacePeriod(6, 2030, "cash", [
		{ ...invoice, amount: 900 },
		{ ...invoice, idContract: "00000000-0000-0000-0000-000000000000" }
	])).rejects.toMatchObject({ code: "23503" });
	expect(await connection.query("select * from branas.invoice where year = $1", [2030])).toEqual(previous);
});

test("removes the previous batch when the replacement is empty", async function () {
	await repository.replacePeriod(6, 2030, "cash", [invoice]);
	await repository.replacePeriod(6, 2030, "cash", []);
	expect(await connection.query("select * from branas.invoice where year = $1", [2030])).toEqual([]);
});

test("lists only the requested month, year, and regime in date order", async function () {
	const earlier = new Date("2030-06-05T13:00:00Z");
	const later = new Date("2030-06-20T13:00:00Z");
	await repository.replacePeriod(6, 2030, "cash", [
		{ ...invoice, date: later, amount: 700 },
		{ ...invoice, date: earlier, amount: 500 }
	]);
	await repository.replacePeriod(6, 2030, "accrual", [invoice]);
	await repository.replacePeriod(7, 2030, "cash", [{ ...invoice, date: new Date("2030-07-01T13:00:00Z") }]);
	await repository.replacePeriod(6, 2029, "cash", [{ ...invoice, date: new Date("2029-06-01T13:00:00Z") }]);
	expect(await repository.listByPeriod(6, 2030, "cash")).toEqual([
		{ date: earlier, amount: 500 },
		{ date: later, amount: 700 }
	]);
});

test("returns an empty list when the period has no persisted invoices", async function () {
	expect(await repository.listByPeriod(6, 2030, "cash")).toEqual([]);
});
