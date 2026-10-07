import InvoiceRepository from "../src/application/repository/InvoiceRepository";
import GetInvoices from "../src/application/usecase/GetInvoices";
import PresenterFactory from "../src/infra/presenter/PresenterFactory";

const input = { month: 1, year: 2022, type: "cash" };
const invoices = [{ date: new Date("2022-01-05T13:00:00Z"), amount: 6000 }];
let repository: InvoiceRepository;
let getInvoices: GetInvoices;

beforeEach(function () {
	repository = {
		replacePeriod: jest.fn(),
		listByPeriod: jest.fn().mockResolvedValue(invoices)
	};
	getInvoices = new GetInvoices(repository, new PresenterFactory());
});

test.each([undefined, "json"])("presents persisted invoices as JSON for %s", async function (format) {
	expect(await getInvoices.execute({ ...input, format })).toEqual(invoices);
	expect(repository.listByPeriod).toHaveBeenCalledWith(1, 2022, "cash");
	expect(repository.replacePeriod).not.toHaveBeenCalled();
});

test("presents persisted invoices as CSV", async function () {
	expect(await getInvoices.execute({ ...input, format: "csv" })).toBe("2022-01-05;6000");
});

test.each([
	{ format: "json", expected: [] },
	{ format: "csv", expected: "" }
])("presents an empty period as $format", async function ({ format, expected }) {
	repository.listByPeriod = jest.fn().mockResolvedValue([]);
	expect(await getInvoices.execute({ ...input, format })).toEqual(expected);
});

test.each([
	{ type: "cash", format: "xml", message: "Invalid format" },
	{ type: "unknown", format: "json", message: "Invalid type" }
])("rejects $message before reading invoices", async function ({ type, format, message }) {
	await expect(getInvoices.execute({ ...input, type, format })).rejects.toThrow(new Error(message));
	expect(repository.listByPeriod).not.toHaveBeenCalled();
	expect(repository.replacePeriod).not.toHaveBeenCalled();
});
