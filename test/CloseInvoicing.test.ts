import Mediator from "../src/application/mediator/Mediator";
import ContractRepository from "../src/application/repository/ContractRepository";
import InvoiceRepository from "../src/application/repository/InvoiceRepository";
import CloseInvoicing from "../src/application/usecase/CloseInvoicing";
import Contract from "../src/domain/Contract";
import PresenterFactory from "../src/infra/presenter/PresenterFactory";

const date = new Date("2022-01-01T13:00:00Z");
const input = { month: 1, year: 2022, type: "accrual" };
let contractRepository: ContractRepository;
let invoiceRepository: InvoiceRepository;
let mediator: Mediator;
let closeInvoicing: CloseInvoicing;

beforeEach(function () {
	contractRepository = { list: jest.fn().mockResolvedValue([
		new Contract("first", "", 6000, 12, date),
		new Contract("second", "", 12000, 12, date)
	]) };
	invoiceRepository = { replacePeriod: jest.fn().mockResolvedValue(undefined) };
	mediator = { publish: jest.fn().mockResolvedValue(undefined) };
	closeInvoicing = new CloseInvoicing(contractRepository, invoiceRepository, new PresenterFactory(), mediator);
});

test.each([undefined, "json"])("closes invoices with their contract IDs and returns JSON for %s", async function (format) {
	const output = await closeInvoicing.execute({ ...input, format });
	expect(invoiceRepository.replacePeriod).toHaveBeenCalledWith(1, 2022, "accrual", [
		{ idContract: "first", date, amount: 500 },
		{ idContract: "second", date, amount: 1000 }
	]);
	expect(output).toEqual([{ date, amount: 500 }, { date, amount: 1000 }]);
	expect(mediator.publish).toHaveBeenCalledTimes(1);
	expect(mediator.publish).toHaveBeenCalledWith("InvoicesClosed", { ...input, invoices: 2, total: 1500 });
});

test("returns the persisted batch as CSV", async function () {
	expect(await closeInvoicing.execute({ ...input, format: "csv" })).toBe("2022-01-01;500\n2022-01-01;1000");
});

test("replaces the period with an empty batch when no invoices are generated", async function () {
	const emptyPeriod = { month: 3, year: 2023, type: "cash" };
	expect(await closeInvoicing.execute(emptyPeriod)).toEqual([]);
	expect(invoiceRepository.replacePeriod).toHaveBeenCalledWith(3, 2023, "cash", []);
	expect(mediator.publish).toHaveBeenCalledWith("InvoicesClosed", { ...emptyPeriod, invoices: 0, total: 0 });
});

test("closes an empty batch when there are no contracts", async function () {
	contractRepository.list = jest.fn().mockResolvedValue([]);
	expect(await closeInvoicing.execute(input)).toEqual([]);
	expect(invoiceRepository.replacePeriod).toHaveBeenCalledWith(1, 2022, "accrual", []);
});

test("rejects an invalid format before any work", async function () {
	await expect(closeInvoicing.execute({ ...input, format: "xml" })).rejects.toThrow(new Error("Invalid format"));
	expect(contractRepository.list).not.toHaveBeenCalled();
	expect(invoiceRepository.replacePeriod).not.toHaveBeenCalled();
	expect(mediator.publish).not.toHaveBeenCalled();
});

test("rejects an invalid type even when there are no contracts", async function () {
	contractRepository.list = jest.fn().mockResolvedValue([]);
	await expect(closeInvoicing.execute({ ...input, type: "unknown" })).rejects.toThrow(new Error("Invalid type"));
	expect(invoiceRepository.replacePeriod).not.toHaveBeenCalled();
	expect(mediator.publish).not.toHaveBeenCalled();
});

test("waits for persistence before publishing the summary", async function () {
	let persisted = false;
	invoiceRepository.replacePeriod = jest.fn(async function () {
		await Promise.resolve();
		persisted = true;
	});
	mediator.publish = jest.fn(async function () {
		expect(persisted).toBe(true);
	});
	await closeInvoicing.execute(input);
	expect(mediator.publish).toHaveBeenCalledTimes(1);
});

test("does not publish a closing event when persistence fails", async function () {
	invoiceRepository.replacePeriod = jest.fn().mockRejectedValue(new Error("Persistence failed"));
	await expect(closeInvoicing.execute(input)).rejects.toThrow("Persistence failed");
	expect(mediator.publish).not.toHaveBeenCalled();
});
