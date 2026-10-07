import Mediator from "../src/application/mediator/Mediator";
import PresenterFactoryPort from "../src/application/presenter/PresenterFactory";
import ContractRepository from "../src/application/repository/ContractRepository";
import GenerateInvoices from "../src/application/usecase/GenerateInvoices";
import Contract from "../src/domain/Contract";
import PresenterFactory from "../src/infra/presenter/PresenterFactory";

let contractRepository: ContractRepository;
let mediator: Mediator;
let generateInvoices: GenerateInvoices;

beforeEach(function () {
	const contract = new Contract("contract", "", 6000, 12, new Date("2022-01-01T13:00:00Z"));
	contractRepository = { list: jest.fn().mockResolvedValue([contract]) };
	mediator = { publish: jest.fn().mockResolvedValue(undefined) };
	generateInvoices = new GenerateInvoices(contractRepository, new PresenterFactory(), mediator);
});

test("keeps invoice DTOs in the event when presenting CSV", async function () {
	const output = await generateInvoices.execute({ month: 1, year: 2022, type: "accrual", format: "csv" });
	expect(output).toBe("2022-01-01;500");
	expect(mediator.publish).toHaveBeenCalledTimes(1);
	expect(mediator.publish).toHaveBeenCalledWith("InvoicesGenerated", [
		{ date: new Date("2022-01-01T13:00:00Z"), amount: 500 }
	]);
});

test("rejects invalid formats before loading contracts or publishing events", async function () {
	await expect(generateInvoices.execute({ month: 1, year: 2022, type: "accrual", format: "xml" }))
		.rejects.toThrow(new Error("Invalid format"));
	expect(contractRepository.list).not.toHaveBeenCalled();
	expect(mediator.publish).not.toHaveBeenCalled();
});

test("supports another format through the injected factory", async function () {
	const presenterFactory: PresenterFactoryPort = {
		create: jest.fn().mockReturnValue({ present: () => "Invoice summary" })
	};
	const usecase = new GenerateInvoices(contractRepository, presenterFactory, mediator);
	const output = await usecase.execute({ month: 1, year: 2022, type: "accrual", format: "summary" });
	expect(presenterFactory.create).toHaveBeenCalledWith("summary");
	expect(output).toBe("Invoice summary");
});
