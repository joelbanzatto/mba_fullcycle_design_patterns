import CloseInvoicing from "../src/application/usecase/CloseInvoicing";
import Contract from "../src/domain/Contract";
import DatabaseConnection from "../src/infra/database/DatabaseConnection";
import PgPromiseAdapter from "../src/infra/database/PgPromiseAdapter";
import Mediator from "../src/infra/mediator/Mediator";
import PresenterFactory from "../src/infra/presenter/PresenterFactory";
import InvoiceDatabaseRepository from "../src/infra/repository/InvoiceDatabaseRepository";

const idContract = "4224a279-c162-4283-86f5-1095f559b08c";
const date = new Date("2031-01-01T13:00:00Z");
const input = { month: 1, year: 2031, type: "accrual" };
let connection: DatabaseConnection;
let contracts: Contract[];
let closeInvoicing: CloseInvoicing;
let onClosed: jest.Mock;

beforeEach(async function () {
	connection = new PgPromiseAdapter();
	await connection.query("delete from branas.invoice where year = $1", [2031]);
	contracts = [new Contract(idContract, "", 6000, 12, date)];
	const mediator = new Mediator();
	onClosed = jest.fn();
	mediator.on("InvoicesClosed", onClosed);
	closeInvoicing = new CloseInvoicing(
		{ list: async () => contracts }, new InvoiceDatabaseRepository(connection), new PresenterFactory(), mediator
	);
});

afterEach(async function () {
	await connection.query("delete from branas.invoice where year = $1", [2031]);
	await connection.close();
});

function failingContracts(): Contract[] {
	return [
		new Contract(idContract, "", 12000, 12, date),
		new Contract("00000000-0000-0000-0000-000000000000", "", 18000, 12, date)
	];
}

test("rolls back the deletion and first insert when the second invoice fails", async function () {
	await closeInvoicing.execute(input);
	const previous = await connection.query("select * from branas.invoice where year = $1", [2031]);
	expect(previous).toHaveLength(1);
	expect(onClosed).toHaveBeenCalledWith({ ...input, invoices: 1, total: 500 });
	contracts = failingContracts();
	onClosed.mockClear();
	await expect(closeInvoicing.execute(input)).rejects.toMatchObject({ code: "23503" });
	expect(await connection.query("select * from branas.invoice where year = $1", [2031])).toEqual(previous);
	expect(onClosed).not.toHaveBeenCalled();
});

test("leaves no invoices after a failed first closing", async function () {
	contracts = failingContracts();
	await expect(closeInvoicing.execute(input)).rejects.toMatchObject({ code: "23503" });
	expect(await connection.query("select * from branas.invoice where year = $1", [2031])).toEqual([]);
	expect(onClosed).not.toHaveBeenCalled();
});

test.each([
	{ type: "accrual", format: "xml", message: "Invalid format" },
	{ type: "unknown", format: "json", message: "Invalid type" }
])("preserves the previous closing on $message", async function ({ type, format, message }) {
	await closeInvoicing.execute(input);
	const previous = await connection.query("select * from branas.invoice where year = $1", [2031]);
	onClosed.mockClear();
	await expect(closeInvoicing.execute({ ...input, type, format })).rejects.toThrow(new Error(message));
	expect(await connection.query("select * from branas.invoice where year = $1", [2031])).toEqual(previous);
	expect(onClosed).not.toHaveBeenCalled();
});
